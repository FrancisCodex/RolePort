const SYMBOLS: Record<string, string> = { PHP: "₱", USD: "$", EUR: "€", GBP: "£", SGD: "S$", AUD: "A$" };
const PERIOD_LABEL = { hour: "/ hr", day: "/ day", month: "/ mo", year: "/ yr" } as const;

function compact(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string,
  period: keyof typeof PERIOD_LABEL | null,
): string | null {
  if (!min && !max) return null;
  const sym = SYMBOLS[currency] ?? `${currency} `;
  const range = min && max && min !== max ? `${sym}${compact(min)}–${sym}${compact(max)}` : `${sym}${compact((min || max)!)}`;
  return period ? `${range} ${PERIOD_LABEL[period]}` : range;
}

export function timeAgo(date: Date | null, now = Date.now()): string | null {
  if (!date) return null;
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export const WORK_SETUP_LABEL = { onsite: "Onsite", hybrid: "Hybrid", remote: "Remote" } as const;
export const EMPLOYMENT_LABEL = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  freelance: "Freelance",
  internship: "Internship",
} as const;
