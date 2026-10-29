import { resolveCompany } from "@/lib/companies/resolve";
import { isLite } from "@/lib/mode";
import { clientAddress, createRateLimit } from "@/lib/rate-limit";

/*
 * Lite edition: checks a careers link before the browser follows the company. Finds the hiring
 * software (fetching the page through the private-address guard when the link doesn't say),
 * then reads the company's public feed once. Stateless: nothing is stored or logged.
 */

// Following companies is occasional; keep the page fetches it can trigger rare.
const take = createRateLimit({ capacity: 10, refillPerMinute: 6 });

export async function POST(request: Request) {
  if (!isLite) return new Response(null, { status: 404 });

  const wait = take(clientAddress(request));
  if (wait > 0) {
    return Response.json({ ok: false, error: "Too many requests. Try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const result = await resolveCompany(await request.json().catch(() => null));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
