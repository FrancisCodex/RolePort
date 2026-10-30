/*
 * The documentation's sidebar: every page, in reading order. A page is one Markdown file in
 * content/docs (the slug is its path, "" is index.md) plus one line here; a test fails if the two
 * don't match.
 */

export const DOCS_NAV = [
  { title: "Get started", slugs: ["", "quick-start", "editions"] },
  {
    title: "Using RolePort",
    slugs: [
      "guides/home",
      "guides/profile",
      "guides/jobs",
      "guides/companies",
      "guides/paste-a-job",
      "guides/match-scores",
      "guides/applications",
      "guides/tailored-cv",
      "guides/cover-letters",
      "guides/application-questions",
      "guides/emails",
      "guides/pipeline",
      "guides/interview-coach",
      "guides/voice",
      "guides/settings",
    ],
  },
  { title: "AI", slugs: ["ai/providers", "ai/local-models", "ai/prompts", "ai/usage"] },
  {
    title: "Job sources",
    slugs: [
      "job-sources",
      "job-sources/hiring-systems",
      "job-sources/jsearch",
      "job-sources/jobspy",
      "job-sources/freehire",
      "job-sources/platsbanken",
      "job-sources/arbeitnow",
      "job-sources/jobicy",
      "job-sources/remotive",
      "job-sources/himalayas",
      "job-sources/remoteok",
    ],
  },
  { title: "Help", slugs: ["privacy-and-data", "faq", "troubleshooting", "contributing"] },
] as const;

export type DocSlug = (typeof DOCS_NAV)[number]["slugs"][number];

/** Every slug in reading order, for previous/next links. */
export const DOC_SLUGS: readonly DocSlug[] = DOCS_NAV.flatMap((section) => section.slugs);

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export const docSection = (slug: string) => DOCS_NAV.find((section) => (section.slugs as readonly string[]).includes(slug))?.title ?? "";
