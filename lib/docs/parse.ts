/*
 * Reads a documentation page's Markdown: its front matter, and its text split at each heading.
 * The contents list, the search index and the heading ids on the page all come from here, so a
 * search result always lands on a real heading.
 */

export type DocMeta = {
  title: string;
  description: string;
  /** Job source ids (lib/jobs/sources/registry.ts) this page covers, or "all" for every source. */
  sources: string[];
};

export type DocSection = { level: 2 | 3; title: string; id: string; text: string };

/** The `key: value` lines between the opening `---` lines, and the Markdown after them. */
export function parseDoc(raw: string): { meta: DocMeta; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  const fields = new Map<string, string>();
  for (const line of match?.[1].split(/\r?\n/) ?? []) {
    const colon = line.indexOf(":");
    if (colon > 0) fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  return {
    meta: {
      title: fields.get("title") ?? "",
      description: fields.get("description") ?? "",
      sources: (fields.get("sources") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    },
    body: match ? raw.slice(match[0].length) : raw,
  };
}

/** A heading's id: the same words give the same link, and repeats get a number. */
export function slugger() {
  const seen = new Map<string, number>();
  return (title: string) => {
    const base = title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };
}

/** Markdown down to the words a reader sees. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, " ")
    .replace(/^\s{0,3}(>|[-*+] |\d+\. )\s*/gm, "")
    .replace(/[*`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The page's text before its first heading, and each h2 or h3 with the text under it. */
export function splitSections(body: string): { intro: string; sections: DocSection[] } {
  const slug = slugger();
  const parts: { heading: Omit<DocSection, "text"> | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    const heading = fenced ? null : /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const title = plainText(heading[2]);
      parts.push({ heading: { level: heading[1].length as 2 | 3, title, id: slug(title) }, lines: [] });
    } else {
      parts[parts.length - 1].lines.push(line);
    }
  }
  const text = (lines: string[]) => plainText(lines.join("\n"));
  return {
    intro: text(parts[0].lines),
    sections: parts.flatMap((p) => (p.heading ? [{ ...p.heading, text: text(p.lines) }] : [])),
  };
}
