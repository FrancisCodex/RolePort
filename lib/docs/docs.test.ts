import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_SOURCES } from "@/lib/jobs/sources/registry";
import { allDocs, buildDocsIndex, sourcePages, sourcesTable } from "./content";
import { DOC_SLUGS, docHref } from "./nav";
import { parseDoc, plainText, slugger, splitSections } from "./parse";
import { searchDocs, type DocEntry } from "./search";

const ROOT = join(process.cwd(), "content", "docs");

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : [path];
  });
}

const fileSlug = (path: string) => relative(ROOT, path).replace(/\\/g, "/").replace(/\.md$/, "").replace(/^index$/, "");

describe("documentation pages", () => {
  const docs = allDocs();

  it("lists every file in the sidebar, and has a file for every sidebar entry", () => {
    expect(markdownFiles(ROOT).map(fileSlug).sort()).toEqual([...DOC_SLUGS].sort());
  });

  it("gives every page a title and a description", () => {
    for (const doc of docs) {
      expect(doc.title, doc.slug).not.toBe("");
      expect(doc.description, doc.slug).not.toBe("");
    }
  });

  it("has a page for every job source", () => {
    const pages = sourcePages();
    for (const source of JOB_SOURCES) expect(pages.has(source.id), `No docs page lists "${source.id}" under sources`).toBe(true);
  });

  it("lists only sources that exist", () => {
    const ids = new Set(JOB_SOURCES.map((s) => s.id));
    for (const id of sourcePages().keys()) expect(ids.has(id), id).toBe(true);
  });

  it("only links to pages and headings that exist", () => {
    const targets = new Map(docs.map((doc) => [docHref(doc.slug), new Set(splitSections(doc.body).sections.map((s) => s.id))]));
    for (const doc of docs) {
      for (const [, href] of doc.body.matchAll(/\]\((\/docs[^)#]*(?:#[^)]*)?)\)/g)) {
        const [path, hash] = href.split("#");
        expect(targets.has(path), `${doc.slug || "index"} links to ${href}`).toBe(true);
        if (hash) expect(targets.get(path)?.has(hash), `${doc.slug || "index"} links to ${href}`).toBe(true);
      }
    }
  });
});

describe("the job sources table", () => {
  it("groups the company and JobSpy boards into one row each, with links", () => {
    const table = sourcesTable(JOB_SOURCES, sourcePages());
    expect(table).toContain("[Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee](/docs/job-sources/hiring-systems)");
    expect(table).toContain("(/docs/job-sources/jobspy)");
    expect(table.match(/\/docs\/job-sources\/jobspy/g)).toHaveLength(1);
  });
});

describe("parsing a page", () => {
  it("reads the front matter and keeps the body", () => {
    const { meta, body } = parseDoc("---\ntitle: A: B\ndescription: Words\nsources: a, b\n---\n\nHello");
    expect(meta).toEqual({ title: "A: B", description: "Words", sources: ["a", "b"] });
    expect(body.trim()).toBe("Hello");
  });

  it("splits text at headings, ignoring # inside code", () => {
    const { intro, sections } = splitSections("Opening\n\n## One\nFirst\n\n```bash\n## not a heading\n```\n\n### Two\nSecond");
    expect(intro).toBe("Opening");
    expect(sections.map((s) => [s.level, s.title, s.id])).toEqual([
      [2, "One", "one"],
      [3, "Two", "two"],
    ]);
    expect(sections[0].text).toContain("not a heading");
  });

  it("numbers repeated headings", () => {
    const slug = slugger();
    expect([slug("Self-hosted"), slug("Self-hosted"), slug("Why you won't")]).toEqual(["self-hosted", "self-hosted-2", "why-you-wont"]);
  });

  it("strips Markdown down to words", () => {
    expect(plainText("**Bold** [link](/x) `code`\n\n| a | b |\n| --- | --- |\n- item")).toBe("Bold link code a b item");
  });
});

describe("searching", () => {
  const index: DocEntry[] = [
    { href: "/docs/a", page: "AI providers", section: "AI", heading: null, text: "Choose where the AI runs." },
    { href: "/docs/a#keys", page: "AI providers", section: "AI", heading: "Where your key goes", text: "Keys are encrypted." },
    { href: "/docs/b", page: "FAQ", section: "Help", heading: null, text: "Is my key safe? Ask about Ollama here." },
    { href: "/docs/c", page: "Local models", section: "AI", heading: "Ollama", text: "Install it." },
  ];

  it("finds a page by a word in its text and jumps to that section", () => {
    expect(searchDocs(index, "encrypted")[0].href).toBe("/docs/a#keys");
  });

  it("ranks a heading above a passing mention", () => {
    expect(searchDocs(index, "ollama").map((h) => h.href)).toEqual(["/docs/c", "/docs/b"]);
  });

  it("needs every word", () => {
    expect(searchDocs(index, "ollama encrypted")).toEqual([]);
    expect(searchDocs(index, "   ")).toEqual([]);
  });

  it("finds real pages in the built index", () => {
    const built = buildDocsIndex();
    expect(searchDocs(built, "OLLAMA_ORIGINS").some((h) => h.href.startsWith("/docs/ai/local-models"))).toBe(true);
    expect(searchDocs(built, "why don't I see linkedin")[0].href).toBe("/docs/faq#why-dont-i-see-linkedin-jobs");
  });
});
