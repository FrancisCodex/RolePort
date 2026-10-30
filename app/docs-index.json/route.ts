import { buildDocsIndex } from "@/lib/docs/content";

/** The documentation's search index, prerendered with the site (lib/docs/search.ts reads it). */
export function GET() {
  return Response.json(buildDocsIndex());
}
