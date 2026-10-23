import { HOSTED_SOURCES, searchAllSources } from "@/lib/jobs/search";
import { jobSearchParamsSchema } from "@/lib/jobs/search-params";
import { isLite } from "@/lib/mode";
import { createRateLimit } from "@/lib/rate-limit";

/*
 * The lite edition's one server route (docs/LITE.md §5): runs a public job search and
 * returns normalized, deduped postings. Stateless: no user id, nothing stored, nothing
 * logged beyond the host's defaults. freehire and Jobicy results are cached for hours by
 * their sources. A JSearch key arrives in a header, is used for this request only, and is
 * never stored or logged.
 */

// About one search every 3 seconds per address, with room for a short burst.
const take = createRateLimit({ capacity: 20, refillPerMinute: 20 });

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  // Self-hosted installs search in their own server code; don't expose an open proxy.
  if (!isLite) return new Response(null, { status: 404 });

  const wait = take(clientAddress(request));
  if (wait > 0) {
    return Response.json({ error: "Too many searches. Try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const parsed = jobSearchParamsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid search." }, { status: 400 });

  const rapidApiKey = request.headers.get("x-rapidapi-key")?.trim().slice(0, 200) || null;
  const { jobs, statuses } = await searchAllSources(parsed.data, { rapidApiKey, jobspyEnabled: false }, HOSTED_SOURCES);
  return Response.json({ jobs, statuses }, { headers: { "Cache-Control": "no-store" } });
}
