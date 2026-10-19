import { createHash } from "node:crypto";

// Port of ai-job-search's tools/job_key.py (MIT, © 2026 Mads Lorentzen):
// a deterministic company+title key used to drop duplicates across sources.

const COMPANY_MAX = 40;
const TITLE_MAX = 60;
const HASH_LEN = 6;

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cap length without making truncation lossy: a hash of the full slug keeps long titles distinct. */
function cap(slug: string, limit: number): string {
  if (slug.length <= limit) return slug;
  const digest = createHash("sha1").update(slug).digest("hex").slice(0, HASH_LEN);
  return `${slug.slice(0, limit - HASH_LEN - 1).replace(/-+$/, "")}-${digest}`;
}

export function jobKey(company: string, title: string, fallbackId: string): string {
  const c = cap(slugify(company), COMPANY_MAX);
  const t = cap(slugify(title), TITLE_MAX);
  // Non-Latin titles slugify to nothing; fall back to the source's own id so they never collide.
  return t ? `${c || "unknown"}_${t}` : `${c || "unknown"}_id-${slugify(fallbackId)}`;
}
