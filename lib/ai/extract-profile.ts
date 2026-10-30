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

type ExtractedSection = z.infer<typeof extractedProfileSchema>["sections"][number];

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
        items: s.items.map((item) => {
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
    ...normalizeProfileDates(rest),
    sections: cleanExtractedSections(sections),
    email: email?.trim() ?? "",
    phone: phone?.trim() ?? "",
    links: links.map((l) => l.trim()).filter(Boolean).slice(0, 4),
    ...(known ? { country: known.code, salaryCurrency: known.currency } : {}),
    yearsExperience: result.yearsExperience == null ? null : Math.max(0, Math.floor(result.yearsExperience)),
  };
}
