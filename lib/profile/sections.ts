import { MAX_ITEM_DETAILS, MAX_SECTIONS, MAX_SECTION_ITEMS, type ProfileSection, type SectionItem } from "./schema";

/*
 * Extra CV sections: Projects, Certifications, Publications, Achievements or anything else the
 * user names. All of them share one shape, so a new section needs no new code: the form, the
 * AI extractor, the prompts and the PDF treat them alike.
 */

/** What the form suggests for a section it knows. Any other title gets the plain wording. */
type SectionHints = { item: string; subtitle: string; date: string; details: string };

const DEFAULT_HINTS: SectionHints = {
  item: "Name",
  subtitle: "Where or with whom (optional)",
  date: "Date (e.g. Mar 2024)",
  details: "Details, one per line",
};

export const SECTION_SUGGESTIONS: { title: string; hints: SectionHints }[] = [
  {
    title: "Projects",
    hints: {
      item: "Project name",
      subtitle: "Your role or the tech used",
      date: "Date (e.g. 2023 - 2024)",
      details: "What you built and what came of it, one per line",
    },
  },
  {
    title: "Certifications",
    hints: { item: "Certification", subtitle: "Issued by", date: "Date earned", details: "Credential ID or details, one per line" },
  },
  {
    title: "Publications",
    hints: { item: "Title", subtitle: "Journal, conference or publisher", date: "Date published", details: "Co-authors or a short note, one per line" },
  },
  {
    title: "Achievements",
    hints: { item: "Achievement", subtitle: "Awarded by (optional)", date: "Date", details: "Why it matters, one per line" },
  },
  {
    title: "Volunteer work",
    hints: { item: "Role", subtitle: "Organization", date: "Date (e.g. 2022 - 2023)", details: "What you did, one per line" },
  },
];

export const sectionHints = (title: string): SectionHints =>
  SECTION_SUGGESTIONS.find((s) => s.title.toLowerCase() === title.trim().toLowerCase())?.hints ?? DEFAULT_HINTS;

export const emptySectionItem = (): SectionItem => ({ title: "", subtitle: "", date: "", link: "", details: [] });

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Trimmed to the saved limits, without blank entries, empty sections or repeated titles. */
export function tidySections(sections: ProfileSection[]): ProfileSection[] {
  const tidy: ProfileSection[] = [];
  for (const section of sections) {
    const items = section.items
      .map((item) => ({
        title: item.title.trim().slice(0, 300),
        subtitle: item.subtitle.trim().slice(0, 160),
        date: item.date.trim().slice(0, 40),
        link: item.link.trim().slice(0, 200),
        details: item.details.map((d) => d.trim().slice(0, 400)).filter(Boolean).slice(0, MAX_ITEM_DETAILS),
      }))
      .filter((item) => item.title || item.subtitle || item.date || item.link || item.details.length > 0);
    if (items.length === 0) continue;
    const title = section.title.trim().slice(0, 60);
    const same = tidy.find((s) => sameTitle(s.title, title));
    if (same) same.items.push(...items);
    else tidy.push({ title, items });
  }
  return tidy.slice(0, MAX_SECTIONS).map((s) => ({ ...s, items: s.items.slice(0, MAX_SECTION_ITEMS) }));
}

/**
 * Overlay sections read from a CV onto the form. A section the CV has is added to the one of
 * that name, its entries replacing those with the same title; everything else the user has
 * stays, so a re-read never loses a section they typed by hand.
 */
export function mergeSections(current: ProfileSection[], draft: ProfileSection[]): ProfileSection[] {
  const merged = current.map((s) => ({ ...s, items: [...s.items] }));
  for (const section of draft) {
    const same = merged.find((s) => sameTitle(s.title, section.title));
    if (!same) {
      merged.push(section);
      continue;
    }
    same.items = [...same.items.filter((i) => !section.items.some((n) => sameTitle(n.title, i.title))), ...section.items];
  }
  return tidySections(merged);
}

function itemLine(item: SectionItem): string {
  const head = [item.title, item.subtitle].filter(Boolean).join(", ");
  const when = item.date ? ` (${item.date})` : "";
  const link = item.link ? ` ${item.link}` : "";
  return `- ${head}${when}${link}${item.details.length ? `: ${item.details.join("; ")}` : ""}`;
}

/** One section as the models see it. */
export function sectionBlock(section: ProfileSection, maxItems = MAX_SECTION_ITEMS): string {
  return `${section.title}:\n${section.items.slice(0, maxItems).map(itemLine).join("\n")}`;
}
