/**
 * Job-search locations for the Philippines. `cities` are the city names job
 * sources use (freehire's city facet), so a pick here maps straight to a filter.
 */
export type PhLocation = { id: string; label: string; region: string; cities: string[] };

export const PH_LOCATIONS: PhLocation[] = [
  {
    id: "metro-manila",
    label: "Metro Manila",
    region: "NCR",
    cities: [
      "Metro Manila", "Manila", "Makati City", "Taguig", "Taguig City", "Pasig City", "Quezon City",
      "Mandaluyong City", "Muntinlupa", "Pasay", "Paranaque City", "San Juan", "Caloocan", "Las Pinas",
    ],
  },
  { id: "cebu", label: "Cebu", region: "Central Visayas", cities: ["Cebu City", "Mandaue", "Lapu-Lapu City"] },
  { id: "davao", label: "Davao", region: "Davao Region", cities: ["Davao", "Davao City"] },
  { id: "clark-pampanga", label: "Clark / Pampanga", region: "Central Luzon", cities: ["Angeles City", "San Fernando", "Clark"] },
  { id: "laguna", label: "Laguna", region: "CALABARZON", cities: ["Calamba", "Cabuyao", "Santa Rosa", "Binan"] },
  { id: "cavite", label: "Cavite", region: "CALABARZON", cities: ["Cavite City", "Imus", "Bacoor", "Dasmarinas"] },
  { id: "batangas", label: "Batangas", region: "CALABARZON", cities: ["Batangas", "Batangas City", "Lipa"] },
  { id: "iloilo", label: "Iloilo", region: "Western Visayas", cities: ["Iloilo", "Iloilo City"] },
  { id: "bacolod", label: "Bacolod / Negros", region: "Western Visayas", cities: ["Bacolod", "Negros Occidental"] },
  { id: "cagayan-de-oro", label: "Cagayan de Oro", region: "Northern Mindanao", cities: ["Cagayan de Oro"] },
  { id: "baguio", label: "Baguio", region: "CAR", cities: ["Baguio", "Baguio City"] },
];

export const PH_REGIONS = [
  "NCR", "CAR", "Ilocos Region", "Cagayan Valley", "Central Luzon", "CALABARZON", "MIMAROPA", "Bicol Region",
  "Western Visayas", "Central Visayas", "Eastern Visayas", "Zamboanga Peninsula", "Northern Mindanao",
  "Davao Region", "SOCCSKSARGEN", "Caraga", "BARMM",
];

export function findLocation(id: string | undefined) {
  return PH_LOCATIONS.find((l) => l.id === id);
}
