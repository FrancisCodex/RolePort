import { readJobLink } from "@/lib/jobs/paste/link";
import { isLite } from "@/lib/mode";
import { clientAddress, createRateLimit } from "@/lib/rate-limit";

/*
 * Lite edition: reads a pasted job link for the browser. The posting comes from the company's
 * hiring system when RolePort reads it, else from the page (through the private-address guard).
 * Pages without a JobPosting come back as text, which the browser's own AI reads. Stateless:
 * nothing is stored or logged.
 */

// Pasting a job is occasional; keep the page fetches it can trigger rare.
const take = createRateLimit({ capacity: 10, refillPerMinute: 6 });

export async function POST(request: Request) {
  if (!isLite) return new Response(null, { status: 404 });

  const wait = take(clientAddress(request));
  if (wait > 0) {
    return Response.json({ ok: false, error: "Too many requests. Try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const body: unknown = await request.json().catch(() => null);
  const url = body && typeof body === "object" ? (body as { url?: unknown }).url : null;
  if (typeof url !== "string" || !url.trim() || url.length > 2000) return Response.json({ ok: false, error: "That isn't a valid link." }, { status: 400 });

  return Response.json(await readJobLink(url.trim()), { headers: { "Cache-Control": "no-store" } });
}
