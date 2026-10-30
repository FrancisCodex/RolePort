import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JOB_SOURCES } from "@/lib/jobs/sources/registry";
import type { JobSource, SourceKind } from "@/lib/jobs/types";
import { DOC_SLUGS, docHref, docSection } from "./nav";
import { parseDoc, splitSections, type DocMeta } from "./parse";
import type { DocEntry } from "./search";

/*
 * The documentation's pages, read from content/docs when the site is built. Job source pages get
 * their facts from the source registry, like the README's table, so they can't fall behind the
 * code: a page lists its sources in its front matter and the table is added above its text.
 */

export type Doc = DocMeta & { slug: string; body: string };

export const SOURCE_KINDS: Record<SourceKind, string> = {
  board: "Job board",
  official: "Official (government)",
  remote: "Remote jobs",
  company: "Company careers pages",
  "opt-in": "Opt-in scraper (self-hosted)",
};

const docFile = (slug: string) => join(process.cwd(), "content", "docs", `${slug || "index"}.md`);

function readRaw(slug: string) {
  return parseDoc(readFileSync(docFile(slug), "utf8"));
}

/** The docs page that covers each job source, by source id. */
export function sourcePages(): Map<string, string> {
  const pages = new Map<string, string>();
  for (const slug of DOC_SLUGS) {
    for (const id of readRaw(slug).meta.sources) if (id !== "all") pages.set(id, slug);
  }
  return pages;
}

/** The company boards are one row, and so are the JobSpy boards, as each has one page. */
export function sourcesTable(sources: JobSource[], pages: Map<string, string>): string {
  const lines = ["| Source | Kind | Where its jobs are | What you need |", "| --- | --- | --- | --- |"];
  const grouped = new Set<SourceKind>();
  for (const s of sources) {
    const group = s.kind === "company" || s.kind === "opt-in";
    if (group && grouped.has(s.kind)) continue;
    if (group) grouped.add(s.kind);
    const label = group ? sources.filter((x) => x.kind === s.kind).map((x) => x.label).join(", ") : s.label;
    const page = pages.get(s.id);
    const name = page === undefined ? label : `[${label}](${docHref(page)})`;
    lines.push(`| ${name} | ${SOURCE_KINDS[s.kind]} | ${s.coverage} | ${s.needs ?? "Nothing"} |`);
  }
  return lines.join("\n");
}

export function getDoc(slug: string): Doc | null {
  if (!(DOC_SLUGS as readonly string[]).includes(slug)) return null;
  const { meta, body } = readRaw(slug);
  if (meta.sources.length === 0) return { ...meta, slug, body };
  const sources = meta.sources.includes("all") ? JOB_SOURCES : JOB_SOURCES.filter((s) => meta.sources.includes(s.id));
  return { ...meta, slug, body: `${sourcesTable(sources, sourcePages())}\n\n${body}` };
}

export function allDocs(): Doc[] {
  return DOC_SLUGS.map((slug) => getDoc(slug)).filter((doc) => doc !== null);
}

/** Everything the site's search looks through, one entry per heading. */
export function buildDocsIndex(docs: Doc[] = allDocs()): DocEntry[] {
  return docs.flatMap((doc) => {
    const href = docHref(doc.slug);
    const section = docSection(doc.slug);
    const { intro, sections } = splitSections(doc.body);
    return [
      { href, page: doc.title, section, heading: null, text: [doc.description, intro].filter(Boolean).join(" ") },
      ...sections.map((s) => ({ href: `${href}#${s.id}`, page: doc.title, section, heading: s.title, text: s.text })),
    ];
  });
}
