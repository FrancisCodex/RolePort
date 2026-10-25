import type { LetterContent } from "./types";

/* Make the cover letter's PDF in the browser. The PDF library loads on first use. */

export async function renderLetterPdf(letter: LetterContent): Promise<Blob> {
  const [{ pdf }, { LetterDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/letter/letter-pdf")]);
  return pdf(<LetterDocument letter={letter} />).toBlob();
}

/** "Juan dela Cruz - Cover letter - Acme.pdf" */
export function letterFileName(letter: LetterContent, company: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${[safe(letter.name) || "Cover letter", "Cover letter", safe(company)].filter(Boolean).join(" - ")}.pdf`;
}
