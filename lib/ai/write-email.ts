import { z } from "zod";
import { wordCount } from "@/lib/letter/types";
import { LINKEDIN_LIMIT, type EmailKind } from "@/lib/outreach/types";
import { buildEmailPrompt, type EmailPromptInput } from "@/lib/outreach/view";
import { emailSystemPrompt } from "./email-prompt";
import type { AiConfig } from "./settings";
import { generateStructured } from "./structured";
import { mentions, numbersIn } from "./tailor-cv";
import { CLICHES, PLACEHOLDER } from "./write-letter";

/*
 * Application emails and follow-ups: the model writes the greeting and the message; the
 * subject, sign-off and contact lines come from code (lib/outreach/view.ts builds the prompt).
 * The app then checks the message like a cover letter: numbers it can't back, placeholders,
 * clichés, length and the employer's name.
 */

export { emailSystemPrompt };

// Planning field first: small models stay on one point once they've picked it.
export const emailSchema = z.object({
  keyPoint: z.string(),
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  notes: z.string(),
});

export type EmailRaw = z.infer<typeof emailSchema>;

const EMAIL_CLICHES = [...CLICHES, "hope this email finds you well", "hope this finds you well", "circling back", "touching base", "just following up"];

/** Most words a message of each kind should run to (LinkedIn is counted in characters). */
const MAX_WORDS: Record<EmailKind, number> = {
  application: 220,
  referral: 170,
  cold: 180,
  linkedin: 60,
  nudge_1: 130,
  nudge_2: 100,
  thank_you: 180,
  check_in: 130,
  offer_reply: 250,
};

const NAMES_EMPLOYER = new Set<EmailKind>(["application", "referral", "cold", "linkedin"]);

const tidy = (s: string) => s.replace(/[ \t]+/g, " ").trim();

/** Check a message (the model's or the user's) and list what to look at before sending. */
export function checkEmail(kind: EmailKind, message: string, { source, company }: { source: string; company: string }): string[] {
  const warnings: string[] = [];
  const backed = new Set(numbersIn(source));
  const unknown = [...new Set(numbersIn(message).filter((n) => !backed.has(n)))];
  if (unknown.length) warnings.push(`It states ${unknown.join(", ")}, which isn't in your profile, CV or this application. Check it or remove it.`);
  if (PLACEHOLDER.test(message)) warnings.push("It has a placeholder like [Name] left in it. Fill it in before sending.");
  const lower = message.toLowerCase();
  const cliches = EMAIL_CLICHES.filter((c) => lower.includes(c));
  if (cliches.length) warnings.push(`Reads like a template in places: "${cliches.join('", "')}". Consider saying it more plainly.`);
  if (kind === "linkedin") {
    if (message.length > LINKEDIN_LIMIT) warnings.push(`It's ${message.length} characters. LinkedIn allows ${LINKEDIN_LIMIT} with a connection request.`);
  } else {
    const words = wordCount(message);
    if (words > MAX_WORDS[kind]) warnings.push(`It's long (${words} words). Short emails get read: aim for under ${MAX_WORDS[kind]}.`);
  }
  if (NAMES_EMPLOYER.has(kind) && company && !mentions(message, company)) warnings.push(`It never names ${company}. Mention the employer so it doesn't read as generic.`);
  return warnings;
}

/**
 * Turn the model's draft into the message: greeting, paragraphs and (for emails) the sign-off
 * from code. Problems become warnings for the user; nothing is silently changed.
 */
export function composeEmail(
  raw: EmailRaw,
  { kind, signOff, source, company }: { kind: EmailKind; signOff: string; source: string; company: string },
): { body: string; keyPoint: string; notes: string; warnings: string[] } {
  // Small models sometimes hand back bullets or markdown despite the instructions.
  const paragraphs = raw.paragraphs
    .flatMap((p) => p.split(/\n\s*\n/))
    .map((p) => tidy(p.replace(/\s*\n\s*/g, " ").replace(/^[\s\-–—•*·]+/, "").replace(/\*\*|__|#+\s/g, "")))
    .filter(Boolean)
    .slice(0, 5);
  const greeting = tidy(raw.greeting);
  const message = kind === "linkedin" ? [greeting, ...paragraphs].filter(Boolean).join(" ") : [greeting || "Dear Hiring Manager,", ...paragraphs].join("\n\n");
  const body = kind === "linkedin" ? message : `${message}\n\n${signOff}`;
  const warnings = paragraphs.length ? checkEmail(kind, message, { source, company }) : ["The model didn't write a message. Try again."];
  return { body, keyPoint: tidy(raw.keyPoint).slice(0, 200), notes: tidy(raw.notes).slice(0, 500), warnings };
}

/** Draft one message on the given provider. Runs on the server and in the lite edition's browser. */
export async function writeEmail(
  input: EmailPromptInput & { customPrompt: string | null; signOff: string; source: string },
  config: AiConfig,
): Promise<ReturnType<typeof composeEmail>> {
  const raw = await generateStructured({
    system: emailSystemPrompt(input.customPrompt),
    prompt: buildEmailPrompt(input),
    schema: emailSchema,
    effort: "medium",
    limits: { text: 1200, list: 6, fields: { keyPoint: 200, greeting: 80, notes: 400 } },
    config,
  });
  return composeEmail(raw, { kind: input.kind, signOff: input.signOff, source: input.source, company: input.facts.company });
}
