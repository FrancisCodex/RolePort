import { extractText, getDocumentProxy } from "unpdf";
import type { Result } from "@/lib/result";
import type { ProfileInput } from "./schema";

/* Reading an uploaded CV. unpdf runs on the server and in the browser (lite edition). */

const MAX_CV_BYTES = 5 * 1024 * 1024;

export type CvImport = {
  fileName: string;
  /** AI-extracted fields, or only detected skills when AI is off. Not saved until the user saves the form. */
  draft: Partial<ProfileInput>;
  usedAi: boolean;
  /** Why AI extraction failed, when it was expected to run. */
  aiError?: string;
};

/** The text of an uploaded PDF or .txt CV, or a message saying why it can't be read. */
export async function readCvFile(file: FormDataEntryValue | null): Promise<Result<{ fileName: string; text: string }>> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF or .txt file." };
  if (file.size > MAX_CV_BYTES) return { ok: false, error: "That file is over 5 MB." };

  let text: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      text = new TextDecoder().decode(bytes);
    } else {
      return { ok: false, error: "Only PDF and .txt files are supported for now." };
    }
  } catch {
    return { ok: false, error: "We couldn't read that file. Is it a text-based PDF (not a scan)?" };
  }

  text = text.replace(/\u0000/g, "").trim();
  if (text.length < 50) {
    return { ok: false, error: "We couldn't find any text in that file. Scanned PDFs aren't supported yet." };
  }
  return { ok: true, data: { fileName: file.name, text } };
}
