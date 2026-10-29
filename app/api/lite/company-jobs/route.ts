import { browseCompanyJobs } from "@/lib/jobs/search";
import { companyJobFiltersSchema, companyRefsSchema } from "@/lib/jobs/search-params";
import { isLite } from "@/lib/mode";
import { clientAddress, createRateLimit } from "@/lib/rate-limit";

/*
 * Lite edition: every open job at the companies the user follows (sent with the request, since
 * they're kept in the browser), filtered without needing search words. Stateless like the
 * search route: nothing stored or logged, and each company's public feed is cached for hours.
 */

// The same budget as searching: about one every 3 seconds per address, with room for a burst.
const take = createRateLimit({ capacity: 20, refillPerMinute: 20 });

export async function POST(request: Request) {
  if (!isLite) return new Response(null, { status: 404 });

  const wait = take(clientAddress(request));
  if (wait > 0) {
    return Response.json({ error: "Too many requests. Try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const body: unknown = await request.json().catch(() => null);
  const { companies: rawCompanies, ...filters } = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = companyJobFiltersSchema.safeParse(filters);
  if (!parsed.success) return Response.json({ error: "Invalid filters." }, { status: 400 });

  const { jobs, statuses } = await browseCompanyJobs(companyRefsSchema.parse(rawCompanies ?? []), parsed.data);
  return Response.json({ jobs, statuses }, { headers: { "Cache-Control": "no-store" } });
}
