import sanitizeHtml from "sanitize-html";

/** Job descriptions come from third parties: keep basic formatting, drop scripts, styles, images and handlers. */
export function cleanDescription(html: string | null | undefined): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "h1", "h2", "h3", "h4", "a", "blockquote"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      h1: "h3",
      h2: "h3",
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
  }).trim();
  return clean || null;
}

/** Plain text for keyword matching. */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
