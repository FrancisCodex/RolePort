import { aiErrorMessage } from "@/lib/ai/errors";
import { extractJobFromText } from "@/lib/ai/extract-job";
import type { AiConfig } from "@/lib/ai/settings";
import { cleanDescription } from "@/lib/jobs/html";
import { textToHtml } from "@/lib/jobs/sources/feed";
import type { Result } from "@/lib/result";
import { emptyPastedJob, MAX_PASTE_CHARS, pastedLink, type JobCheck, type LinkRead, type PasteReview } from "./types";

/*
 * Turns a posting's text (pasted, or read from a page without a JobPosting) into the review
 * screen: the AI fills in what the text backs up, the user fills in the rest. Runs on the server
 * and, in the lite edition, in the browser with the user's own key.
 */

export async function reviewFromText({
  text,
  url = "",
  config,
  check = null,
}: {
  text: string;
  url?: string;
  config: AiConfig | null;
  check?: JobCheck | null;
}): Promise<PasteReview> {
  const posting = text.trim().slice(0, MAX_PASTE_CHARS);
  const job = { ...emptyPastedJob(url), description: cleanDescription(textToHtml(posting)) };
  // Without a link, the text is the job's identity: pasting the same text again finds the same job.
  if (!url) job.sourceId = `text:${await digest(posting)}`;

  if (!config) {
    return { job, how: "manual", board: null, check, notes: ["Turn on AI in Settings and RolePort fills these fields in from the text. For now, add them yourself."] };
  }

  try {
    const { dropped, ...fields } = await extractJobFromText(posting, config);
    const notes = dropped.length
      ? [`Left empty because they weren't found word for word in the text: ${dropped.join(", ")}. Add them yourself if the posting has them.`]
      : [];
    return { job: { ...job, ...fields }, how: "ai", board: null, check, notes };
  } catch (error) {
    console.error("[paste] reading the posting failed", error);
    return {
      job,
      how: "manual",
      board: null,
      check,
      notes: [`The AI couldn't read this posting (${aiErrorMessage(error, "it failed")}). Fill in the fields yourself.`],
    };
  }
}

/** A short SHA-256 of the text, with Web Crypto so it runs in both editions. */
async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shortest text that can be a posting; anything shorter is probably a title or a mistake. */
const MIN_POSTING_CHARS = 80;

/**
 * What the user pasted, ready to review: a link is read by `readLink` (the server, or the lite
 * relay), text goes straight to the AI.
 */
export async function readPaste(
  input: unknown,
  { readLink, config }: { readLink: (url: string) => Promise<Result<LinkRead>>; config: AiConfig | null },
): Promise<Result<PasteReview>> {
  const text = typeof input === "string" ? input.trim().slice(0, MAX_PASTE_CHARS) : "";
  if (!text) return { ok: false, error: "Paste a job link or the job description." };

  const link = pastedLink(text);
  if (link) {
    const read = await readLink(link);
    if (!read.ok) return read;
    if (read.data.kind === "review") return { ok: true, data: read.data.review };
    return { ok: true, data: await reviewFromText({ text: read.data.text, url: read.data.url, config, check: read.data.check }) };
  }
  if (text.length < MIN_POSTING_CHARS) {
    return { ok: false, error: "That's too short for a job description. Paste the whole posting, or a link to it." };
  }
  return { ok: true, data: await reviewFromText({ text, config }) };
}
