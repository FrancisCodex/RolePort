import type { KeyedJob } from "./queries";

/*
 * Cross-board duplicates. The job key (./job-key.ts) only catches exact company + title
 * matches, but the same opening shows up as "Optum" on one board and "Optum Philippines, Inc."
 * on another, or as "Sr. DevOps Engineer" next to "Senior DevOps Engineer (Hybrid) - Makati".
 * This compares looser forms of both and folds each copy into the first one seen, so the
 * caller's source order still decides which board's copy is shown. Runs in the browser too.
 */

/** Words that say nothing about which company it is. */
const COMPANY_NOISE = new Set([
  "inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited", "llc", "llp", "plc", "pte", "pvt",
  "private", "gmbh", "sa", "ag", "bv", "the", "group", "holdings", "philippines", "phils", "phil", "ph", "opc",
]);

/** Words in titles that are about the ad or the arrangement rather than the role. */
const TITLE_NOISE = new Set([
  "urgent", "urgently", "hiring", "now", "immediate", "immediately", "apply", "wfh", "remote", "hybrid", "onsite", "on",
  "site", "work", "from", "home", "office", "fulltime", "full", "parttime", "part", "time", "permanent", "temporary",
  "contract", "position", "role", "job", "opening", "vacancy", "a", "an", "the", "for", "and", "of", "in", "at", "with",
]);

const TITLE_SYNONYMS: Record<string, string> = {
  sr: "senior", snr: "senior", jr: "junior", jnr: "junior", mgr: "manager", eng: "engineer", engr: "engineer",
  dev: "developer", devs: "developer", developers: "developer", engineers: "engineer", asst: "assistant",
  assoc: "associate", admin: "administrator", rep: "representative", csr: "customer service representative",
  va: "virtual assistant", fullstack: "full stack", frontend: "front end", backend: "back end",
};

function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function companyForm(company: string): string {
  const all = words(company);
  const kept = all.filter((w) => !COMPANY_NOISE.has(w));
  return (kept.length ? kept : all).join(" ");
}

/** The role's words: synonyms spelled out, job codes and filler dropped. */
export function titleWords(title: string): Set<string> {
  // Trailing reference codes set off by dashes or bars ("… - DFT - 080426", "… | REQ-1182").
  const segments = title.split(/\s+[-–—|]\s+/);
  while (segments.length > 1 && /^(?:[A-Z0-9-]{2,10}|.*\d.*)$/.test(segments.at(-1)!.trim())) segments.pop();
  const out = new Set<string>();
  for (const word of words(segments.join(" "))) {
    // Reference numbers ("080426", "req123") differ between boards for the same opening.
    if (/\d/.test(word) || TITLE_NOISE.has(word)) continue;
    for (const w of (TITLE_SYNONYMS[word] ?? word).split(" ")) out.add(w);
  }
  return out;
}

/** Words that make two otherwise matching titles different jobs. */
const LEVELS = new Set([
  "senior", "junior", "lead", "principal", "staff", "head", "chief", "intern", "internship", "trainee", "entry", "mid",
  "associate", "assistant", "manager", "director", "supervisor", "graduate", "ii", "iii", "iv",
]);

/**
 * Same role: the same words, or one title is the other plus place names from the postings'
 * locations ("Senior DevOps Engineer - Makati"). Any other extra word (a level, a framework,
 * a team) means a different opening: missing a duplicate is better than hiding a real job.
 */
export function sameRole(a: Set<string>, b: Set<string>, places: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const extra = [...a].filter((w) => !b.has(w)).concat([...b].filter((w) => !a.has(w)));
  if (extra.some((w) => LEVELS.has(w))) return false;
  return extra.every((w) => places.has(w)) && extra.length < Math.min(a.size, b.size);
}

/** Fill what the kept copy is missing from a duplicate, and remember where else it was posted. */
function absorb(kept: KeyedJob, dup: KeyedJob): KeyedJob {
  const alsoOn = [...(kept.alsoOn ?? [])];
  for (const link of [{ source: dup.source, url: dup.url }, ...(dup.alsoOn ?? [])]) {
    if (link.source !== kept.source && !alsoOn.some((l) => l.source === link.source)) alsoOn.push(link);
  }
  const longer = (dup.description?.length ?? 0) > (kept.description?.length ?? 0);
  const salary = kept.salaryMin == null && kept.salaryMax == null && (dup.salaryMin != null || dup.salaryMax != null);
  return {
    ...kept,
    companyLogo: kept.companyLogo ?? dup.companyLogo,
    location: kept.location ?? dup.location,
    city: kept.city ?? dup.city,
    workSetup: kept.workSetup ?? dup.workSetup,
    employmentType: kept.employmentType ?? dup.employmentType,
    ...(salary && {
      salaryMin: dup.salaryMin,
      salaryMax: dup.salaryMax,
      salaryCurrency: dup.salaryCurrency,
      salaryPeriod: dup.salaryPeriod,
    }),
    // Some boards only carry a snippet; keep the fullest text of the posting.
    description: longer ? dup.description : kept.description,
    summary: kept.summary ?? dup.summary,
    skills: [...new Set([...kept.skills, ...dup.skills])],
    requirements: kept.requirements.length ? kept.requirements : dup.requirements,
    postedAt: kept.postedAt ?? dup.postedAt,
    alsoOn,
  };
}

/** One copy of each opening, in the order given. Later copies are merged into the first. */
export function mergeDuplicates(jobs: KeyedJob[]): KeyedJob[] {
  const kept: { job: KeyedJob; company: string; title: Set<string> }[] = [];
  const byCompany = new Map<string, number[]>();

  for (const job of jobs) {
    const company = companyForm(job.company);
    const title = titleWords(job.title);
    const candidates = byCompany.get(company) ?? [];
    const match = candidates.find((i) => {
      const other = kept[i].job;
      if (other.jobKey === job.jobKey) return true;
      const places = new Set(words([job.location, job.city, other.location, other.city].filter(Boolean).join(" ")));
      return sameRole(kept[i].title, title, places);
    });
    if (match !== undefined) {
      kept[match].job = absorb(kept[match].job, job);
      continue;
    }
    byCompany.set(company, [...candidates, kept.length]);
    kept.push({ job, company, title });
  }
  return kept.map((k) => k.job);
}
