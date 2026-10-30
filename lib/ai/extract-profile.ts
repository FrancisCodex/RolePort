import { z } from "zod";
import { findCountry } from "@/lib/geo/countries";
import { normalizeProfileDates } from "@/lib/profile/dates";
import { WORK_SETUPS, SKILL_LEVELS, type ProfileInput, type ProfileSection } from "@/lib/profile/schema";
import { tidySections } from "@/lib/profile/sections";
import { profileSystemPrompt } from "./profile-prompt";
import type { AiConfig } from "./settings";
import { generateStructured } from "./structured";

// Structured outputs: keep the schema to plain types (no length/range limits); the
// result is re-validated by profileSchema when the user saves the form.
const extractedProfileSchema = z.object({
  name: z.string(),
  headline: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  links: z.array(z.string()),
  summary: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  desiredRoles: z.array(z.string()),
  workSetups: z.array(z.enum(WORK_SETUPS)),
  skills: z.array(z.object({ name: z.string(), level: z.enum(SKILL_LEVELS) })),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      location: z.string().nullable(),
      highlights: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({ school: z.string(), degree: z.string(), field: z.string().nullable(), year: z.string().nullable() }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  careerGoals: z.array(z.string()),
  // Last, so a model that runs long has already written the core of the profile.
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(
        z.object({
          title: z.string().nullable(),
          subtitle: z.string().nullable(),
          date: z.string().nullable(),
          link: z.string().nullable(),
          details: z.array(z.string()),
        }),
      ),
    }),
  ),
});

type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
type ExtractedSection = ExtractedProfile["sections"][number];
type ExtractedItem = ExtractedSection["items"][number];

const clip = (text: string, max: number) => text.trim().slice(0, max);
const clipOrNull = (text: string | null, max: number) => text && clip(text, max);
const clipList = (list: string[], max: number, count: number) => list.map((t) => clip(t, max)).filter(Boolean).slice(0, count);

/** The profile's limits (lib/profile/schema.ts) applied to what a model wrote, so saving can't fail on it. Exported for tests. */
export function fitProfileLimits<T extends Omit<ExtractedProfile, "country" | "email" | "phone" | "links" | "sections">>(p: T): T {
  return {
    ...p,
    name: clip(p.name, 120),
    headline: clipOrNull(p.headline, 160),
    summary: clipOrNull(p.summary, 2000),
    city: clipOrNull(p.city, 80),
    region: clipOrNull(p.region, 80),
    desiredRoles: clipList(p.desiredRoles, 80, 10),
    skills: p.skills.map((s) => ({ ...s, name: clip(s.name, 60) })).slice(0, 60),
    experience: p.experience.slice(0, 20).map((e) => ({
      ...e,
      company: clip(e.company, 120),
      role: clip(e.role, 120),
      start: clip(e.start, 20),
      end: clipOrNull(e.end, 20),
      location: clipOrNull(e.location, 120),
      highlights: clipList(e.highlights, 400, 10),
    })),
    education: p.education.slice(0, 10).map((e) => ({
      ...e,
      school: clip(e.school, 160),
      degree: clip(e.degree, 160),
      field: clipOrNull(e.field, 120),
      year: clipOrNull(e.year, 20),
    })),
    languages: p.languages.slice(0, 10).map((l) => ({ name: clip(l.name, 40), level: clip(l.level, 40) })),
    careerGoals: clipList(p.careerGoals, 200, 8),
  };
}

const PROJECTS = /\bprojects?\b/i;
const ROLE_TITLE = /\b(developer|engineer|designer|architect|analyst|intern|founder|owner|maintainer|contributor|consultant|programmer|lead|project manager)$/i;

/** Projects have a name and no role: a role is dropped, and a name filed as the subtitle moves back. */
function fixProject(item: ExtractedItem): ExtractedItem {
  const subtitle = item.subtitle?.trim();
  if (!subtitle) return item;
  const title = item.title?.trim() ?? "";
  const swapped = ROLE_TITLE.test(title) && !ROLE_TITLE.test(subtitle) && !subtitle.includes(",");
  if (!title || swapped) return { ...item, title: subtitle, subtitle: null };
  if (ROLE_TITLE.test(subtitle)) return { ...item, subtitle: null };
  // Anything else there is usually the tech used.
  return { ...item, subtitle: null, details: [subtitle, ...item.details] };
}

/** Headings the profile already has fields for: models sometimes repeat them as sections. */
const BUILT_IN = /^(work |professional |employment )?(experience|history)$|^education$|^(technical |core |key )?skills$|^languages?$|^(professional )?summary$|^objective$|^contact( details| information)?$/i;

/** Sections as the form takes them. Exported for tests. */
export function cleanExtractedSections(sections: ExtractedSection[]): ProfileSection[] {
  return tidySections(
    sections
      .filter((s) => s.title.trim() && !BUILT_IN.test(s.title.trim()))
      .map((s) => ({
        // CVs often write headings in capitals; the PDF capitalizes them anyway, so the form reads better without.
        title: s.title === s.title.toUpperCase() ?`${s.title.trim()[0]}${s.title.trim().slice(1).toLowerCase()}` : s.title,
        items: s.items.map((raw) => {
          const item = PROJECTS.test(s.title) ? fixProject(raw) : raw;
          // A one-line entry can arrive as a bullet with no name: that line is its name.
          const title = item.title?.trim() || item.details[0] || "";
          return {
            title,
            subtitle: item.subtitle ?? "",
            date: item.date ?? "",
            link: item.link ?? "",
            details: item.title?.trim() ? item.details : item.details.slice(1),
          };
        }),
      })),
  )
    .map((s) => ({ ...s, items: s.items.filter((item) => item.title) }))
    .filter((s) => s.items.length > 0);
}

/** Profile fields read from a CV on the given provider. Runs on the server and in the lite edition's browser. */
export async function extractProfileFromCv(cvText: string, config: AiConfig, customPrompt: string | null): Promise<Partial<ProfileInput>> {
  const result = await generateStructured({
    config,
    system: profileSystemPrompt(customPrompt),
    prompt: `<cv>\n${cvText}\n</cv>`,
    schema: extractedProfileSchema,
  });
  const { country, email, phone, links, sections, ...rest } = result;
  const known = findCountry(country);
  return {
    // Models don't always follow the date format they're asked for ("Mar 2022", "Present").
    ...fitProfileLimits(normalizeProfileDates(rest)),
    sections: cleanExtractedSections(sections),
    email: clip(email ?? "", 160),
    phone: clip(phone ?? "", 60),
    links: clipList(links, 200, 4),
    ...(known ? { country: known.code, salaryCurrency: known.currency } : {}),
    yearsExperience: result.yearsExperience == null ? null : Math.min(60, Math.max(0, Math.floor(result.yearsExperience))),
  };
}
