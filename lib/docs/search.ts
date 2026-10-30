/*
 * Searching the documentation in the browser, over the index the site builds (/docs-index.json),
 * so it needs no server or outside service and works the same in Lite.
 */

/** One heading (or a page's opening text, when `heading` is null) in the index. */
export type DocEntry = { href: string; page: string; section: string; heading: string | null; text: string };

export type DocHit = DocEntry & { snippet: string };

const MAX_HITS_PER_PAGE = 3;
const SNIPPET_LENGTH = 110;

export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function snippetOf(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), lower.length);
  if (at === lower.length) return text.slice(0, SNIPPET_LENGTH) + (text.length > SNIPPET_LENGTH ? "…" : "");
  const start = at < 30 ? 0 : text.lastIndexOf(" ", at - 25) + 1;
  const end = start + SNIPPET_LENGTH;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trimEnd()}${end < text.length ? "…" : ""}`;
}

/** Every word must appear somewhere in the entry. Page titles count most, then headings, then text. */
function score(entry: DocEntry, terms: string[], phrase: string): number {
  const page = entry.page.toLowerCase();
  const heading = entry.heading?.toLowerCase() ?? "";
  const text = entry.text.toLowerCase();
  let total = 0;
  for (const term of terms) {
    const inPage = page.includes(term);
    const inHeading = heading.includes(term);
    const inText = text.includes(term);
    if (!inPage && !inHeading && !inText) return 0;
    if (inPage) total += entry.heading ? 3 : 12;
    if (inHeading) total += 8;
    if (inText) total += 1 + Math.min(3, text.split(term).length - 2);
  }
  if (heading.includes(phrase) || (!entry.heading && page.includes(phrase))) total += 10;
  else if (text.includes(phrase)) total += 4;
  return total;
}

export function searchDocs(entries: DocEntry[], query: string, limit = 8): DocHit[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const phrase = terms.join(" ");
  const scored = entries
    .map((entry) => ({ entry, score: score(entry, terms, phrase) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const perPage = new Map<string, number>();
  const hits: DocHit[] = [];
  for (const { entry } of scored) {
    const count = perPage.get(entry.page) ?? 0;
    if (count >= MAX_HITS_PER_PAGE) continue;
    perPage.set(entry.page, count + 1);
    hits.push({ ...entry, snippet: snippetOf(entry.text, terms) });
    if (hits.length === limit) break;
  }
  return hits;
}
