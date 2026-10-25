import type { CvContent } from "./types";

/*
 * Make the CV's PDF in the browser and read it back the way an applicant tracking system
 * would: pull the text out of the file and confirm the important parts survived. Both
 * libraries load on first use, so they stay out of the page bundle.
 */

export async function renderCvPdf(cv: CvContent): Promise<Blob> {
  const [{ pdf }, { CvDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/cv/cv-pdf")]);
  return pdf(<CvDocument cv={cv} />).toBlob();
}

export type AtsCheck = { label: string; ok: boolean };

const flat = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** What a parser finds in the PDF: the text, and whether each part of the CV can be read from it. */
export async function checkCvPdf(blob: Blob, cv: CvContent): Promise<{ checks: AtsCheck[]; text: string }> {
  const [{ extractText, getDocumentProxy }, { pdfSafe }] = await Promise.all([import("unpdf"), import("@/components/cv/cv-pdf")]);
  const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const found = flat(text);
  const has = (s: string) => found.includes(flat(pdfSafe(s)));

  const sections = [
    ["Summary", Boolean(cv.summary)],
    ["Skills", cv.skills.length > 0],
    ["Experience", cv.experience.length > 0],
    ["Education", cv.education.length > 0],
  ] as const;
  const missingSkills = cv.skills.filter((s) => !has(s));
  const missingRoles = cv.experience.filter((e) => !has(e.role) || !has(e.company));

  const checks: AtsCheck[] = [
    { label: "The PDF has selectable text (not an image)", ok: found.length > 100 },
    { label: "Your name is readable", ok: Boolean(cv.name) && has(cv.name) },
    { label: cv.contact.email ? "Your email is readable" : "Add an email so recruiters can reach you", ok: Boolean(cv.contact.email) && has(cv.contact.email) },
    {
      label: "Standard section headings: Summary, Skills, Experience, Education",
      ok: sections.every(([name, present]) => !present || has(name)),
    },
    {
      label: missingRoles.length ? `Couldn't read: ${missingRoles.map((e) => `${e.role} at ${e.company}`).join("; ")}` : "Every job title and employer is readable",
      ok: missingRoles.length === 0,
    },
    {
      label: missingSkills.length ? `Skills not found in the text: ${missingSkills.join(", ")}` : "Every skill is readable",
      ok: missingSkills.length === 0,
    },
    { label: totalPages <= 2 ? `${totalPages} page${totalPages === 1 ? "" : "s"}` : `${totalPages} pages: most recruiters expect one or two`, ok: totalPages <= 2 },
  ];
  return { checks, text };
}

/** "Juan dela Cruz - CV - Acme.pdf" */
export function cvFileName(cv: CvContent, company: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${[safe(cv.name) || "CV", "CV", safe(company)].filter(Boolean).join(" - ")}.pdf`;
}
