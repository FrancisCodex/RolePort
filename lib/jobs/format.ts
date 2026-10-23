const symbols = new Map<string, string>();

/** The short symbol for a currency ("₱", "S$", "AED "), from Intl so every ISO code works. */
export function currencySymbol(currency: string): string {
  let sym = symbols.get(currency);
  if (!sym) {
    try {
      const parts = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0);
      sym = parts.find((p) => p.type === "currency")?.value ?? currency;
    } catch {
      sym = currency;
    }
    // Letter codes read better with a space: "AED 5k", not "AED5k".
    if (/^[a-z]{2,}$/i.test(sym)) sym = `${sym} `;
    symbols.set(currency, sym);
  }
  return sym;
}

/** A whole amount with its currency symbol, e.g. "₱45,000". */
export function formatMoney(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${Math.round(amount).toLocaleString("en")}`;
}
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
  const sym = currencySymbol(currency);
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
