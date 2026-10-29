import "server-only";
import { z } from "zod";
import { BOARDS, boardFromHtml, boardFromUrl, fetchCompanyFeed } from "@/lib/jobs/sources/companies";
import { SourceHttpError } from "@/lib/jobs/sources/http";
import { ATS_IDS, validSlug, type AtsId } from "@/lib/jobs/sources/companies/types";
import { assertPublicUrl, safeFetchText, UnsafeUrlError } from "@/lib/net/safe-url";
import type { Result } from "@/lib/result";

/*
 * Turns a careers link into a company RolePort can follow: which hiring software it uses, the
 * company's name there, and how many jobs are open. Server code: it may fetch the careers page
 * (through the private-address guard) and the feed. Used by the self-hosted action and the
 * lite edition's /api/lite/company route.
 */

export type ResolvedCompany = { ats: AtsId; slug: string; name: string; careersUrl: string; openJobs: number; boardLabel: string };

export const followInputSchema = z.object({
  url: z.string().trim().min(1, "Paste a careers page link.").max(2000),
  name: z.string().trim().max(120).optional(),
});

const RECRUITEE_SITE = /recruiteecdn\.com|careers-analytics\.recruitee\.com/i;

/**
 * Recruitee careers sites can run on the company's own domain (careers.example.com), which serves
 * the same feed at /api/offers/. Each posting's mailbox (job.x@acme.recruitee.com) names the company.
 */
async function recruiteeOnOwnDomain(site: URL): Promise<{ ats: AtsId; slug: string } | null> {
  try {
    const res = await safeFetchText(new URL("/api/offers/", site), { accept: "application/json" });
    const body = JSON.parse(res.body) as { offers?: { mailbox_email?: string }[] };
    for (const offer of body.offers ?? []) {
      const slug = validSlug(offer.mailbox_email?.match(/@([a-z0-9-]+)\.recruitee\.com$/i)?.[1]);
      if (slug) return { ats: "recruitee", slug };
    }
  } catch {
    // not a Recruitee site after all, or no open jobs to read the name from
  }
  return null;
}

function titleCase(slug: string): string {
  return slug.replace(/[-_.]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export async function resolveCompany(raw: unknown): Promise<Result<ResolvedCompany>> {
  const input = followInputSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Paste a careers page link." };
  const text = input.data.url;

  let url: URL;
  try {
    url = await assertPublicUrl(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch (error) {
    return { ok: false, error: error instanceof UnsafeUrlError ? error.message : "That isn't a valid link." };
  }

  let board = boardFromUrl(url);
  if (!board) {
    try {
      const page = await safeFetchText(url);
      board = boardFromHtml(page.body) ?? (RECRUITEE_SITE.test(page.body) ? await recruiteeOnOwnDomain(new URL(page.url)) : null);
    } catch (error) {
      return { ok: false, error: error instanceof UnsafeUrlError ? error.message : "Couldn't open that page. Check the link and try again." };
    }
  }
  if (!board) {
    return {
      ok: false,
      error: `RolePort couldn't find a list of jobs it can read on that page. Try opening one of the company's job postings and pasting that link instead. (RolePort can follow companies that hire through ${ATS_IDS.map((id) => BOARDS[id].label).join(", ")}; some companies use other services it can't read yet.)`,
    };
  }

  try {
    const feed = await fetchCompanyFeed(board);
    return {
      ok: true,
      data: {
        ...board,
        name: input.data.name || feed.name || titleCase(board.slug),
        careersUrl: url.toString(),
        openJobs: feed.jobs.length,
        boardLabel: BOARDS[board.ats].label,
      },
    };
  } catch (error) {
    const missing = error instanceof SourceHttpError && error.status === 404;
    return {
      ok: false,
      error: missing
        ? `${BOARDS[board.ats].label} has no job board called "${board.slug}". Check the link.`
        : `Couldn't read ${BOARDS[board.ats].label}'s job feed for "${board.slug}" right now. Try again in a moment.`,
    };
  }
}
