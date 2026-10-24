/**
 * Countries HireMe can search. `code` is ISO 3166-1 alpha-2. The per-source fields say how each
 * source names the country, or leave it out when the source doesn't cover it:
 * - `jobicy`: Jobicy's geo slug (remote jobs open to people living there).
 * - `jobspy`: JobSpy's country name for Indeed, plus the other boards that cover it.
 */
export type JobSpyBoard = "glassdoor" | "zip_recruiter" | "bayt" | "naukri" | "bdjobs" | "hellowork";

export type Country = {
  code: string;
  name: string;
  currency: string;
  jobicy?: string;
  jobspy?: { indeed?: string; boards?: JobSpyBoard[] };
};

export const DEFAULT_COUNTRY = "PH";

const GD: JobSpyBoard[] = ["glassdoor"];
const BAYT: JobSpyBoard[] = ["bayt"];

export const COUNTRIES: Country[] = [
  // Glassdoor via glassdoor.com (services/jobspy/server.py adds the Philippines to its sites).
  { code: "PH", name: "Philippines", currency: "PHP", jobicy: "philippines", jobspy: { indeed: "philippines", boards: GD } },
  { code: "AR", name: "Argentina", currency: "ARS", jobicy: "argentina", jobspy: { indeed: "argentina", boards: GD } },
  { code: "AU", name: "Australia", currency: "AUD", jobicy: "australia", jobspy: { indeed: "australia", boards: GD } },
  { code: "AT", name: "Austria", currency: "EUR", jobicy: "austria", jobspy: { indeed: "austria", boards: GD } },
  { code: "BH", name: "Bahrain", currency: "BHD", jobspy: { indeed: "bahrain", boards: BAYT } },
  { code: "BD", name: "Bangladesh", currency: "BDT", jobspy: { boards: ["bdjobs"] } },
  { code: "BE", name: "Belgium", currency: "EUR", jobicy: "belgium", jobspy: { indeed: "belgium", boards: GD } },
  { code: "BR", name: "Brazil", currency: "BRL", jobicy: "brazil", jobspy: { indeed: "brazil", boards: GD } },
  { code: "CA", name: "Canada", currency: "CAD", jobicy: "canada", jobspy: { indeed: "canada", boards: ["glassdoor", "zip_recruiter"] } },
  { code: "CL", name: "Chile", currency: "CLP", jobspy: { indeed: "chile" } },
  { code: "CN", name: "China", currency: "CNY", jobicy: "china", jobspy: { indeed: "china" } },
  { code: "CO", name: "Colombia", currency: "COP", jobspy: { indeed: "colombia" } },
  { code: "CR", name: "Costa Rica", currency: "CRC", jobicy: "costa-rica", jobspy: { indeed: "costa rica" } },
  { code: "CZ", name: "Czechia", currency: "CZK", jobicy: "czechia", jobspy: { indeed: "czech republic" } },
  { code: "DK", name: "Denmark", currency: "DKK", jobicy: "denmark", jobspy: { indeed: "denmark" } },
  { code: "EC", name: "Ecuador", currency: "USD", jobspy: { indeed: "ecuador" } },
  { code: "EG", name: "Egypt", currency: "EGP", jobspy: { indeed: "egypt", boards: BAYT } },
  { code: "FI", name: "Finland", currency: "EUR", jobicy: "finland", jobspy: { indeed: "finland" } },
  { code: "FR", name: "France", currency: "EUR", jobicy: "france", jobspy: { indeed: "france", boards: ["glassdoor", "hellowork"] } },
  { code: "DE", name: "Germany", currency: "EUR", jobicy: "germany", jobspy: { indeed: "germany", boards: GD } },
  { code: "GR", name: "Greece", currency: "EUR", jobicy: "greece", jobspy: { indeed: "greece" } },
  { code: "HK", name: "Hong Kong", currency: "HKD", jobicy: "hong-kong", jobspy: { indeed: "hong kong", boards: GD } },
  { code: "HU", name: "Hungary", currency: "HUF", jobicy: "hungary", jobspy: { indeed: "hungary" } },
  { code: "IN", name: "India", currency: "INR", jobspy: { indeed: "india", boards: ["glassdoor", "naukri"] } },
  { code: "ID", name: "Indonesia", currency: "IDR", jobspy: { indeed: "indonesia" } },
  { code: "IE", name: "Ireland", currency: "EUR", jobicy: "ireland", jobspy: { indeed: "ireland", boards: GD } },
  { code: "IL", name: "Israel", currency: "ILS", jobicy: "israel", jobspy: { indeed: "israel" } },
  { code: "IT", name: "Italy", currency: "EUR", jobicy: "italy", jobspy: { indeed: "italy", boards: GD } },
  { code: "JP", name: "Japan", currency: "JPY", jobicy: "japan", jobspy: { indeed: "japan" } },
  { code: "KW", name: "Kuwait", currency: "KWD", jobspy: { indeed: "kuwait", boards: BAYT } },
  { code: "LU", name: "Luxembourg", currency: "EUR", jobspy: { indeed: "luxembourg" } },
  { code: "MY", name: "Malaysia", currency: "MYR", jobicy: "malaysia", jobspy: { indeed: "malaysia", boards: GD } },
  { code: "MX", name: "Mexico", currency: "MXN", jobicy: "mexico", jobspy: { indeed: "mexico", boards: GD } },
  { code: "MA", name: "Morocco", currency: "MAD", jobspy: { indeed: "morocco", boards: BAYT } },
  { code: "NL", name: "Netherlands", currency: "EUR", jobicy: "netherlands", jobspy: { indeed: "netherlands", boards: GD } },
  { code: "NZ", name: "New Zealand", currency: "NZD", jobicy: "new-zealand", jobspy: { indeed: "new zealand", boards: GD } },
  { code: "NG", name: "Nigeria", currency: "NGN", jobspy: { indeed: "nigeria" } },
  { code: "NO", name: "Norway", currency: "NOK", jobicy: "norway", jobspy: { indeed: "norway" } },
  { code: "OM", name: "Oman", currency: "OMR", jobspy: { indeed: "oman", boards: BAYT } },
  { code: "PK", name: "Pakistan", currency: "PKR", jobspy: { indeed: "pakistan" } },
  { code: "PA", name: "Panama", currency: "USD", jobspy: { indeed: "panama" } },
  { code: "PE", name: "Peru", currency: "PEN", jobspy: { indeed: "peru" } },
  { code: "PL", name: "Poland", currency: "PLN", jobicy: "poland", jobspy: { indeed: "poland" } },
  { code: "PT", name: "Portugal", currency: "EUR", jobicy: "portugal", jobspy: { indeed: "portugal" } },
  { code: "QA", name: "Qatar", currency: "QAR", jobspy: { indeed: "qatar", boards: BAYT } },
  { code: "RO", name: "Romania", currency: "RON", jobicy: "romania", jobspy: { indeed: "romania" } },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", jobspy: { indeed: "saudi arabia", boards: BAYT } },
  { code: "SG", name: "Singapore", currency: "SGD", jobicy: "singapore", jobspy: { indeed: "singapore", boards: GD } },
  { code: "ZA", name: "South Africa", currency: "ZAR", jobspy: { indeed: "south africa" } },
  { code: "KR", name: "South Korea", currency: "KRW", jobicy: "south-korea", jobspy: { indeed: "south korea" } },
  { code: "ES", name: "Spain", currency: "EUR", jobicy: "spain", jobspy: { indeed: "spain", boards: GD } },
  { code: "SE", name: "Sweden", currency: "SEK", jobicy: "sweden", jobspy: { indeed: "sweden" } },
  { code: "CH", name: "Switzerland", currency: "CHF", jobicy: "switzerland", jobspy: { indeed: "switzerland", boards: GD } },
  { code: "TW", name: "Taiwan", currency: "TWD", jobspy: { indeed: "taiwan" } },
  { code: "TH", name: "Thailand", currency: "THB", jobicy: "thailand", jobspy: { indeed: "thailand" } },
  { code: "TR", name: "Türkiye", currency: "TRY", jobicy: "turkiye", jobspy: { indeed: "türkiye" } },
  { code: "UA", name: "Ukraine", currency: "UAH", jobicy: "ukraine", jobspy: { indeed: "ukraine" } },
  { code: "AE", name: "United Arab Emirates", currency: "AED", jobicy: "united-arab-emirates", jobspy: { indeed: "united arab emirates", boards: BAYT } },
  { code: "GB", name: "United Kingdom", currency: "GBP", jobicy: "uk", jobspy: { indeed: "uk", boards: GD } },
  { code: "US", name: "United States", currency: "USD", jobicy: "usa", jobspy: { indeed: "usa", boards: ["glassdoor", "zip_recruiter"] } },
  { code: "UY", name: "Uruguay", currency: "UYU", jobspy: { indeed: "uruguay" } },
  { code: "VE", name: "Venezuela", currency: "VES", jobspy: { indeed: "venezuela" } },
  { code: "VN", name: "Vietnam", currency: "VND", jobicy: "vietnam", jobspy: { indeed: "vietnam", boards: GD } },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/** The country for a code, falling back to the default so callers always get one. */
export function countryOrDefault(code: string | null | undefined): Country {
  return findCountry(code) ?? BY_CODE.get(DEFAULT_COUNTRY)!;
}

export function countryName(code: string): string {
  return findCountry(code)?.name ?? code;
}

/** Home first, then the user's target countries, then everything else alphabetically. */
export function orderedCountries(home: string, targets: string[]): Country[] {
  const first = [home, ...targets.filter((t) => t !== home)].flatMap((c) => findCountry(c) ?? []);
  const rest = COUNTRIES.filter((c) => !first.includes(c)).sort((a, b) => a.name.localeCompare(b.name));
  return [...first, ...rest];
}
