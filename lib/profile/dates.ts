/**
 * Month-precision dates for profile experience and education.
 * Stored as "YYYY-MM" (or "YYYY" when only the year is known). CVs write dates every which
 * way ("Mar 2022", "03/2022", "March of 2022", "Present"), so everything coming in goes
 * through normalize* before it reaches the form or the database.
 */

export type MonthYear = { year: number; month: number | null };

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MIN_YEAR = 1950;
export const maxYear = () => new Date().getFullYear() + 6;

const PRESENT = /^(present|current(ly)?|now|ongoing|to ?date|till ?date|until now|today)$/i;
const RANGE = /^(.+?)\s*(?:\s[-–—]\s|[–—]|\bto\b|\buntil\b|\btill\b)\s*(.+)$/i;

function monthFromWord(word: string): number | null {
  if (word.length < 3) return null;
  const i = MONTH_NAMES.findIndex((m) => word.startsWith(m.toLowerCase()));
  return i >= 0 ? i + 1 : null;
}

function make(year: number, month: number | null): MonthYear | null {
  if (year < 100) year += year > (new Date().getFullYear() % 100) + 6 ? 1900 : 2000;
  if (year < MIN_YEAR || year > maxYear()) return null;
  if (month != null && (month < 1 || month > 12)) return null;
  return { year, month };
}

export function isPresent(raw: string | null | undefined): boolean {
  return !!raw && PRESENT.test(raw.trim());
}

/** Reads one date in any common CV format. Returns null for blanks, "Present" and unreadable text. */
export function parseMonthYear(raw: string | null | undefined): MonthYear | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4}) ?[-/ ] ?(\d{1,2})(?: ?[-/ ] ?\d{1,2})?$/))) return make(+m[1], +m[2]); // 2022-03, 2022/3, 2022-03-15
  if ((m = s.match(/^(\d{1,2}) ?[-/ ] ?(\d{4})$/))) return make(+m[2], +m[1]); // 03/2022
  if ((m = s.match(/^([a-z]+) (?:of )?'?(\d{4}|\d{2})$/))) {
    const month = monthFromWord(m[1]);
    return month ? make(+m[2], month) : null; // Mar 2022, March of 2022, Mar '22
  }
  if ((m = s.match(/^(\d{4}) ([a-z]+)$/))) {
    const month = monthFromWord(m[2]);
    return month ? make(+m[1], month) : null; // 2022 Mar
  }
  if ((m = s.match(/^(\d{4})$/))) return make(+m[1], null);
  // Last resort: a four-digit year somewhere, plus a month name if there is one.
  const year = s.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const month = (s.match(/[a-z]+/g) ?? []).map(monthFromWord).find((n) => n != null) ?? null;
  return make(+year[0], month);
}

export function toStored({ year, month }: MonthYear): string {
  return month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
}

/** "Mar 2022", "2022", or null when there's no readable date. */
export function formatMonthYear(raw: string | null | undefined): string | null {
  const d = parseMonthYear(raw);
  if (!d) return null;
  return d.month ? `${MONTH_NAMES[d.month - 1]} ${d.year}` : String(d.year);
}

/** Sort key; a year-only date counts as January for starts and December for ends. */
export function monthIndex(d: MonthYear, edge: "start" | "end" = "start"): number {
  return d.year * 12 + (d.month ?? (edge === "start" ? 1 : 12)) - 1;
}

/** Canonical form of one date. Text that can't be read is kept as typed so nothing is lost. */
export function normalizeMonthYear(raw: string | null | undefined): string | null {
  const d = parseMonthYear(raw);
  return d ? toStored(d) : raw?.trim() || null;
}

/** Splits "Jan 2020 – Mar 2022" or "2018-2022" into its two ends, or null when it isn't a range. */
export function splitRange(raw: string | null | undefined): [string, string] | null {
  if (!raw) return null;
  const s = raw.trim();
  const years = s.match(/^(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)$/i);
  if (years) return [years[1], years[2]];
  const m = s.match(RANGE);
  return m ? [m[1], m[2]] : null;
}

type Experience = { start: string; end: string | null };
type Education = { year: string | null };

export function normalizeExperienceDates<T extends Experience>(e: T): T {
  // A whole range squeezed into the start field ("Jan 2020 - Present").
  const range = !e.end ? splitRange(e.start) : null;
  const start = range ? range[0] : e.start;
  const end = range ? range[1] : e.end;
  return {
    ...e,
    start: normalizeMonthYear(start) ?? "",
    end: isPresent(end) ? null : normalizeMonthYear(end),
  };
}

export function normalizeEducationDates<T extends Education>(e: T): T {
  // For a range ("2018 - 2022") the year that matters is graduation, the second one.
  const range = splitRange(e.year);
  const year = range ? range[1] : e.year;
  return { ...e, year: isPresent(year) ? null : normalizeMonthYear(year) };
}

export function normalizeProfileDates<T extends { experience: Experience[]; education: Education[] }>(p: T): T {
  return {
    ...p,
    experience: p.experience.map(normalizeExperienceDates),
    education: p.education.map(normalizeEducationDates),
  };
}
