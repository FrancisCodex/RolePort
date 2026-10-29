import type { EmploymentType, SalaryPeriod, WorkSetup } from "@/lib/jobs/types";

/*
 * Checks in code that what a model read from a pasted posting is really in it. Small local
 * models paraphrase and invent; a field that can't be found in the text is left empty for the
 * user to fill in rather than trusted.
 */

/** Lower case, one kind of quote and dash, single spaces: the form both sides are compared in. */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether `value` appears in `text` word for word, ignoring case and spacing. */
export function appearsIn(value: string, text: string): boolean {
  const v = normalize(value);
  return v.length > 0 && normalize(text).includes(v);
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** Like appearsIn, but as a whole word or phrase: "Go" isn't found in "good". */
export function wordIn(value: string, text: string): boolean {
  const v = normalize(value);
  const t = normalize(text);
  if (!v) return false;
  for (let i = t.indexOf(v); i !== -1; i = t.indexOf(v, i + 1)) {
    if (!isWordChar(t[i - 1]) && !isWordChar(t[i + v.length])) return true;
  }
  return false;
}

const words = (text: string) => normalize(text).match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu)?.filter((w) => w.length > 2) ?? [];

/**
 * A requirement the model copied, allowing small changes (a dropped bullet, "and" for "&"):
 * nearly all of its words must be in the text.
 */
export function closeEnough(value: string, text: string): boolean {
  if (appearsIn(value, text)) return true;
  const mine = words(value);
  if (mine.length < 3) return false;
  const theirs = new Set(words(text));
  return mine.filter((w) => theirs.has(w)).length / mine.length >= 0.85;
}

/** Every amount written in the text: "50,000", "50.000", "₱50k", "1.5M". */
export function amountsIn(text: string): Set<number> {
  const found = new Set<number>();
  for (const m of text.matchAll(/(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*([kKmM])?(?![\p{L}\d])/gu)) {
    const grouped = /^\d{1,3}(?:[,.\s]\d{3})+$/.test(m[1]);
    const base = grouped ? Number(m[1].replace(/[,.\s]/g, "")) : Number(m[1].replace(",", "."));
    if (!Number.isFinite(base)) continue;
    const scale = m[2] ? (m[2].toLowerCase() === "k" ? 1_000 : 1_000_000) : 1;
    found.add(Math.round(base * scale));
  }
  return found;
}

const SETUP_WORDS: Record<WorkSetup, RegExp> = {
  remote: /\bremote\b|work[- ]from[- ]home|\bwfh\b|home[- ]based|telecommut/i,
  hybrid: /\bhybrid\b/i,
  onsite: /\bon[- ]?site\b|\bin[- ]office\b|office[- ]based|\bin[- ]person\b|report(?:ing)? to (?:the|our) office/i,
};

const EMPLOYMENT_WORDS: Record<EmploymentType, RegExp> = {
  full_time: /full[- ]?time|\bpermanent\b|\bregular\b/i,
  part_time: /part[- ]?time/i,
  contract: /\bcontract(?:ual|or)?\b|fixed[- ]term|project[- ]based|\btemporary\b/i,
  freelance: /\bfreelanc/i,
  internship: /\bintern(?:ship)?s?\b|\bojt\b|\btrainee\b/i,
};

const PERIOD_WORDS: Record<SalaryPeriod, RegExp> = {
  hour: /\bhour|\bhr\b|\/\s*h\b|hourly/i,
  day: /\bday\b|\bdaily\b|per diem/i,
  month: /\bmonth|\/\s*mo\b|\bmonthly\b/i,
  year: /\byear|\bannual|\byr\b|p\.?a\.?\b|\/\s*y\b/i,
};

// Symbols for currencies; a code ("PHP", "SGD") written in the text counts on its own.
const CURRENCY_SIGNS: [RegExp, (code: string) => boolean][] = [
  [/₱|\bpesos?\b|\bphp\b/i, (c) => c === "PHP"],
  [/\$/, (c) => /D$/.test(c)], // USD, SGD, AUD, CAD, NZD, HKD
  [/€/, (c) => c === "EUR"],
  [/£/, (c) => c === "GBP"],
  [/₹|\brs\.?\s?\d/i, (c) => c === "INR"],
  [/¥|円/, (c) => c === "JPY" || c === "CNY"],
  [/₩/, (c) => c === "KRW"],
  [/฿/, (c) => c === "THB"],
  [/₫/, (c) => c === "VND"],
  [/\bRM\s?\d/, (c) => c === "MYR"],
  [/\bRp\.?\s?\d/, (c) => c === "IDR"],
  [/\bkr\b|\bkronor\b|\bkroner\b/i, (c) => c === "SEK" || c === "NOK" || c === "DKK"],
  [/\bAED\b|dirham/i, (c) => c === "AED"],
];

export function currencyIn(code: string, text: string): boolean {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return false;
  return new RegExp(`\\b${c}\\b`, "i").test(text) || CURRENCY_SIGNS.some(([sign, fits]) => fits(c) && sign.test(text));
}

/** What a model read from the posting, before the checks. "unknown" and "" mean it didn't find it. */
export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  workSetup: WorkSetup | "unknown";
  employmentType: EmploymentType | "unknown";
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod | "unknown";
  requirements: { text: string; priority: "required" | "preferred" }[];
  skills: string[];
};

export type VerifiedJob = {
  title: string;
  company: string;
  location: string | null;
  workSetup: WorkSetup | null;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod | null;
  requirements: { text: string; priority: "required" | "preferred" }[];
  skills: string[];
  /** What the model gave that wasn't in the text, in words for the review screen. */
  dropped: string[];
};

const MAX_REQUIREMENTS = 30;
const MAX_SKILLS = 30;

/** Keeps only what the text backs up. */
export function verifyExtraction(found: ExtractedJob, text: string): VerifiedJob {
  const dropped: string[] = [];
  const keep = (value: string, label: string) => {
    const v = value.trim();
    if (!v) return null;
    if (appearsIn(v, text)) return v;
    dropped.push(label);
    return null;
  };
  const title = keep(found.title, "job title") ?? "";
  const company = keep(found.company, "company") ?? "";
  const location = keep(found.location, "location");

  const workSetup = found.workSetup !== "unknown" && SETUP_WORDS[found.workSetup]?.test(text) ? found.workSetup : null;
  if (found.workSetup !== "unknown" && !workSetup) dropped.push("work setup");
  const employmentType =
    found.employmentType !== "unknown" && EMPLOYMENT_WORDS[found.employmentType]?.test(text) ? found.employmentType : null;
  if (found.employmentType !== "unknown" && !employmentType) dropped.push("employment type");

  // Pay: every number must be written in the text, in a currency the text shows.
  const amounts = amountsIn(text);
  const stated = [found.salaryMin, found.salaryMax].filter((n): n is number => typeof n === "number" && n > 0);
  const payOk = stated.length > 0 && stated.every((n) => amounts.has(Math.round(n))) && currencyIn(found.salaryCurrency, text);
  if (stated.length > 0 && !payOk) dropped.push("salary");
  const period = payOk && found.salaryPeriod !== "unknown" && PERIOD_WORDS[found.salaryPeriod]?.test(text) ? found.salaryPeriod : null;

  const requirements = found.requirements
    .map((r) => ({ text: r.text.replace(/^[\s•·*\-–—]+/, "").trim(), priority: r.priority }))
    .filter((r) => r.text.length > 0 && r.text.length <= 600);
  const keptRequirements = requirements.filter((r) => closeEnough(r.text, text)).slice(0, MAX_REQUIREMENTS);
  if (keptRequirements.length < Math.min(requirements.length, MAX_REQUIREMENTS)) {
    const n = Math.min(requirements.length, MAX_REQUIREMENTS) - keptRequirements.length;
    dropped.push(`${n} requirement${n === 1 ? "" : "s"}`);
  }

  const skills = [...new Set(found.skills.map((s) => s.trim()).filter((s) => s && s.length <= 80))];
  const keptSkills = skills.filter((s) => wordIn(s, text)).slice(0, MAX_SKILLS);

  return {
    title,
    company,
    location,
    workSetup,
    employmentType,
    salaryMin: payOk ? (found.salaryMin ?? found.salaryMax) : null,
    salaryMax: payOk ? (found.salaryMax ?? found.salaryMin) : null,
    salaryCurrency: payOk ? found.salaryCurrency.trim().toUpperCase() : "",
    salaryPeriod: period,
    requirements: keptRequirements,
    skills: keptSkills,
    dropped,
  };
}
