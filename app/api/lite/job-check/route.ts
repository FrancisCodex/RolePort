import { z } from "zod";
import { checkPosting } from "@/lib/jobs/paste/link";
import { canCheckJob } from "@/lib/jobs/paste/types";
import { isLite } from "@/lib/mode";
import { clientAddress, createRateLimit } from "@/lib/rate-limit";

/*
 * Lite edition: "Check again" for a saved job. Looks the posting up in its company's feed, or
 * opens a pasted link's page (through the private-address guard), and says whether it's still
 * open. The browser keeps the answer. Stateless: nothing is stored or logged.
 */

const take = createRateLimit({ capacity: 20, refillPerMinute: 10 });

const jobSchema = z.object({
  source: z.string().max(40),
  sourceId: z.string().max(300).nullable(),
  url: z.string().max(2000),
});

export async function POST(request: Request) {
  if (!isLite) return new Response(null, { status: 404 });

  const wait = take(clientAddress(request));
  if (wait > 0) {
    return Response.json({ ok: false, error: "Too many checks. Try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const job = jobSchema.safeParse(await request.json().catch(() => null));
  if (!job.success || !canCheckJob(job.data)) return Response.json({ ok: false, error: "RolePort can't check this job." }, { status: 400 });

  return Response.json({ ok: true, data: await checkPosting(job.data) }, { headers: { "Cache-Control": "no-store" } });
}
