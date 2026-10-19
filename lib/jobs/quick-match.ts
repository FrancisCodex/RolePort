import { detectSkills } from "@/lib/profile/detect-skills";
import type { ProfileInput } from "@/lib/profile/schema";

/**
 * Free, instant fit estimate from skill overlap — no AI needed. The full
 * five-dimension evaluation (ported from ai-job-search's 04-job-evaluation.md)
 * runs on top of this once an Anthropic key is set.
 */
export type QuickMatch = { score: number; matched: string[]; missing: string[] };

const LEVEL_WEIGHT = { primary: 1, secondary: 0.8, learning: 0.4 } as const;

function norm(skill: string) {
  return skill
    .toLowerCase()
    .replace(/c#/g, "csharp")
    .replace(/c\+\+/g, "cpp")
    .replace(/\.net/g, "dotnet")
    .replace(/node\.?js/g, "nodejs")
    .replace(/[^a-z0-9]/g, "");
}

function display(skill: string) {
  return skill.includes("-") || skill === skill.toLowerCase() ? skill.replace(/-/g, " ") : skill;
}

export function quickMatch(
  job: { title: string; skills: string[]; text: string },
  profile: Pick<ProfileInput, "skills" | "desiredRoles">,
): QuickMatch | null {
  if (profile.skills.length === 0) return null;

  const jobSkills = new Map<string, string>();
  for (const s of [...job.skills, ...detectSkills(`${job.title} ${job.text}`)]) {
    const key = norm(s);
    if (key && !jobSkills.has(key)) jobSkills.set(key, s);
  }

  const mine = new Map(profile.skills.map((s) => [norm(s.name), s]));
  const matched: string[] = [];
  const missing: string[] = [];
  let weight = 0;
  for (const [key, label] of jobSkills) {
    const hit = mine.get(key);
    if (hit) {
      matched.push(hit.name);
      weight += LEVEL_WEIGHT[hit.level];
    } else {
      missing.push(display(label));
    }
  }

  // Profile skills mentioned in the posting text but not tagged as a job skill still count a little.
  const text = norm(job.text);
  for (const [key, skill] of mine) {
    if (!jobSkills.has(key) && key.length > 2 && text.includes(key)) matched.push(skill.name);
  }

  if (matched.length === 0 && jobSkills.size === 0) return null;

  let score = jobSkills.size > 0 ? (100 * weight) / jobSkills.size : Math.min(80, 35 + matched.length * 10);
  score += 6 * Math.max(0, matched.length - Math.round(weight)); // text-only mentions

  const title = job.title.toLowerCase();
  const titleHit = profile.desiredRoles.some((role) =>
    role
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4)
      .some((w) => title.includes(w)),
  );
  if (titleHit) score += 12;

  return {
    score: Math.round(Math.min(98, Math.max(5, score))),
    matched: [...new Set(matched)],
    missing: missing.slice(0, 8),
  };
}
