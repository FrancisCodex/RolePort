import { z } from "zod";
import { MAX_CV_SKILLS, type CvContent, type CvTailoring } from "@/lib/cv/types";
import type { ProfileInput } from "@/lib/profile/schema";
import { sectionBlock } from "@/lib/profile/sections";
import { cvSystemPrompt } from "./cv-prompt";
import { clip, jobBlock, type EvaluationJob } from "./evaluate-job";
import type { AiConfig } from "./settings";
import { generateStructured } from "./structured";

/*
 * CV tailoring: rewrite the wording of the candidate's CV for one posting. The model only
 * returns a headline, summary, skill order and bullets per role (referred to by number);
 * employers, titles, dates, schools and contact details are copied from the profile in code,
 * so even an edited prompt can't add a job the candidate never had. The app then checks the
 * rewrite against the profile and CV (skills, numbers) and shows what it found.
 */

// Planning fields first: small models write better bullets once they've listed the keywords.
export const tailoredCvSchema = z.object({
  keywords: z.array(z.string()),
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(z.object({ role: z.number().int(), bullets: z.array(z.string()) })),
  keywordsMissing: z.array(z.string()),
  notes: z.string(),
});

export { cvSystemPrompt };

export type TailoredCvRaw = z.infer<typeof tailoredCvSchema>;

const MAX_CV_TEXT_CHARS = 8000;

/** The candidate as the models see it, inside <candidate_profile> tags. Shared with cover letters. */
export function candidateBlock(profile: ProfileInput, cvText: string | null): string {
  const skills = (level: "primary" | "secondary" | "learning") =>
    profile.skills.filter((s) => s.level === level).map((s) => s.name).join(", ") || "none";
  const roles = profile.experience.map((e, i) => {
    // Small models mix up tenses unless each role says which it is.
    const when = `${e.start || "?"} to ${e.end || "present"}; ${e.end ? "past role, past tense" : "current role, present tense"}`;
    const highlights = e.highlights.map((h) => `    - ${h}`).join("\n");
    return `[${i}] ${e.role} at ${e.company}${e.location ? `, ${e.location}` : ""} (${when})${highlights ? `\n${highlights}` : ""}`;
  });
  const lines = [
    profile.headline && `Headline: ${profile.headline}`,
    profile.summary && `Summary: ${profile.summary}`,
    `Years of experience: ${profile.yearsExperience ?? "not stated"}`,
    profile.desiredRoles.length ? `Target roles: ${profile.desiredRoles.join(", ")}` : null,
    `Primary skills: ${skills("primary")}`,
    `Secondary skills: ${skills("secondary")}`,
    `Still learning (not yet a CV skill): ${skills("learning")}`,
    roles.length ? `Experience (refer to roles by number):\n${roles.join("\n")}` : "Experience: none listed",
    profile.education.length
      ? `Education:\n${profile.education.map((e) => `- ${e.degree}${e.field ? `, ${e.field}` : ""}, ${e.school}${e.year ? ` (${e.year})` : ""}`).join("\n")}`
      : null,
    profile.languages.length ? `Languages: ${profile.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", ")}` : null,
    ...profile.sections.map((s) => sectionBlock(s)),
    cvText ? `CV text (for facts only):\n${clip(cvText.replace(/<\/?\s*(job_posting|candidate_profile)\s*>/gi, " "), MAX_CV_TEXT_CHARS)}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export type TailorInput = { profile: ProfileInput; cvText: string | null; job: EvaluationJob };

/** The user message of a tailoring run, shown to the user as-is on the CV page. */
export function buildTailorPrompt({ profile, cvText, job }: TailorInput): string {
  return [
    "<candidate_profile>",
    candidateBlock(profile, cvText),
    "</candidate_profile>",
    "",
    "<job_posting>",
    jobBlock(job),
    "</job_posting>",
    "",
    "Tailor this candidate's CV to this posting. Reply with the JSON object only.",
  ].join("\n");
}

/* Checks ------------------------------------------------------------------- */

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `term` appears in `text` as a whole word (works for "C#", "Node.js", "UI/UX"). */
export function mentions(text: string, term: string): boolean {
  const t = term.trim();
  return t.length > 0 && new RegExp(`(^|[^a-z0-9])${escape(t.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase());
}

/** The numbers a line states, normalized ("1,200" → "1200", "35%" → "35"). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")).filter((n) => n.length > 0);
}

/** Everything the profile and CV say, for checking claims against. */
export function sourceOf(profile: ProfileInput, cvText: string | null): string {
  return [
    profile.headline,
    profile.summary,
    profile.skills.map((s) => s.name).join(", "),
    profile.experience.map((e) => [e.role, e.company, e.location, e.start, e.end, ...e.highlights].join(" ")).join("\n"),
    profile.education.map((e) => [e.degree, e.field, e.school, e.year].join(" ")).join("\n"),
    profile.sections.map((s) => sectionBlock(s)).join("\n"),
    profile.yearsExperience != null ? `${profile.yearsExperience} years` : "",
    cvText,
  ]
    .filter(Boolean)
    .join("\n");
}

const cleanBullet = (b: string) => tidy(b.replace(/^[\s\-–—•*·]+/, "")).slice(0, 400);

/** Common irregular past forms, so "Built", "Led" or "Wrote" count as past tense. */
const IRREGULAR_PAST = new Set(
  "built led ran wrote made won drove grew cut set put kept brought taught sold took gave began held met found spoke chose became did saw oversaw undertook shot sent spent lent bent understood stood thought sought bought caught fed read rode rose broke froze stole wore tore swore shook forgot got hit hung knew left lost meant paid said shut sat slept split spread struck swam threw went worked".split(" "),
);

/** Whether a bullet opens with a past-tense verb ("Managed", "Built"), for past roles. */
function opensInPast(bullet: string): boolean {
  const first = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return first.endsWith("ed") || IRREGULAR_PAST.has(first);
}

/**
 * Merge the model's rewrite into the profile-based CV, keeping only what the source backs:
 * unknown skills are dropped, bullets with numbers the source doesn't state are flagged,
 * and roles the model skipped keep their original bullets.
 */
export function applyTailoring(
  base: CvContent,
  raw: TailoredCvRaw,
  { profile, cvText }: { profile: ProfileInput; cvText: string | null },
): { content: CvContent; tailoring: Omit<CvTailoring, "model" | "at" | "customPrompt"> } {
  const source = sourceOf(profile, cvText);
  const sourceNumbers = new Set(numbersIn(source));
  const warnings: string[] = [];

  const skills: string[] = [];
  for (const skill of raw.skills.map(tidy).filter(Boolean)) {
    if (skills.some((s) => s.toLowerCase() === skill.toLowerCase())) continue;
    if (profile.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase()) || mentions(source, skill)) skills.push(skill.slice(0, 60));
    else warnings.push(`Left out the skill "${skill}": it isn't in your profile or CV.`);
  }

  const rewritten = new Map<number, string[]>();
  for (const item of raw.experience) {
    if (!Number.isInteger(item.role) || item.role < 0 || item.role >= base.experience.length || rewritten.has(item.role)) continue;
    const bullets = item.bullets.map(cleanBullet).filter(Boolean).slice(0, 6);
    if (bullets.length) rewritten.set(item.role, bullets);
  }
  const experience = base.experience.map((role, i) => {
    const bullets = rewritten.get(i) ?? role.bullets;
    for (const bullet of rewritten.get(i) ?? []) {
      const unknown = numbersIn(bullet).filter((n) => !sourceNumbers.has(n));
      if (unknown.length) {
        warnings.push(`${role.role} at ${role.company}: "${bullet.slice(0, 90)}${bullet.length > 90 ? "…" : ""}" states ${unknown.join(", ")}, which isn't in your profile or CV. Check it or remove it.`);
      }
    }
    // Small models often ignore the tense hint; recruiters notice, so say so.
    const presentTense = role.end ? (rewritten.get(i) ?? []).filter((b) => !opensInPast(b)).length : 0;
    if (presentTense > 0) {
      warnings.push(`${role.role} at ${role.company} is a past role, but ${presentTense === 1 ? "a bullet reads" : `${presentTense} bullets read`} in the present tense ("Manage" instead of "Managed"). Fix the wording below.`);
    }
    return { ...role, bullets };
  });

  const summary = tidy(raw.summary).slice(0, 1200) || base.summary;
  for (const n of numbersIn(summary).filter((x) => !sourceNumbers.has(x))) {
    warnings.push(`The summary states ${n}, which isn't in your profile or CV. Check it or remove it.`);
  }

  const content: CvContent = {
    ...base,
    headline: tidy(raw.headline).slice(0, 160) || base.headline,
    summary,
    skills: skills.length ? skills.slice(0, MAX_CV_SKILLS) : base.skills,
    experience,
  };

  // Keywords are re-checked against the finished CV rather than taken on the model's word.
  const finalText = [
    content.headline,
    content.summary,
    content.skills.join(", "),
    ...content.experience.flatMap((e) => [e.role, ...e.bullets]),
    ...content.sections.map((s) => sectionBlock(s)),
  ].join("\n");
  const keywords = [...new Set(raw.keywords.map(tidy).filter(Boolean))];
  const covered = keywords.filter((k) => mentions(finalText, k));
  const missing = [...new Set([...raw.keywordsMissing.map(tidy), ...keywords.filter((k) => !mentions(finalText, k))].filter(Boolean))].filter(
    (k) => !covered.some((c) => c.toLowerCase() === k.toLowerCase()),
  );

  return {
    content,
    tailoring: { keywordsCovered: covered.slice(0, 20), keywordsMissing: missing.slice(0, 15), notes: tidy(raw.notes).slice(0, 600), warnings },
  };
}

/** Run a tailoring on the given provider. Runs on the server and in the lite edition's browser. */
export async function tailorCv(
  input: TailorInput & { base: CvContent; customPrompt: string | null },
  config: AiConfig,
): Promise<{ content: CvContent; tailoring: Omit<CvTailoring, "model" | "at" | "customPrompt"> }> {
  const raw = await generateStructured({
    system: cvSystemPrompt(input.customPrompt),
    prompt: buildTailorPrompt(input),
    schema: tailoredCvSchema,
    effort: "medium",
    config,
  });
  return applyTailoring(input.base, raw, input);
}
