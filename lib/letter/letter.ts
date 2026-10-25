import { eq } from "drizzle-orm";
import { buildLetterPrompt, letterSystemPrompt, writeCoverLetter } from "@/lib/ai/write-letter";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import { writeContact } from "@/lib/cv/queries";
import { defaultPageSize } from "@/lib/cv/types";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { deleteAppDocument, readAppDocument, writeAppDocument } from "@/lib/documents/queries";
import { countryName } from "@/lib/geo/countries";
import { readApplication } from "@/lib/jobs/applications";
import { evaluationJobOf } from "@/lib/jobs/fit-evaluation";
import { readCvText, readProfile } from "@/lib/profile/queries";
import type { ProfileInput } from "@/lib/profile/schema";
import type { LetterContent, LetterReview } from "./types";

/*
 * The cover letter page's data and the drafting run, shared by the server (actions, page) and
 * the lite edition's browser database. One letter per application (document.kind =
 * "cover_letter"). No auth here: callers pass the user.
 */

type StoredLetter = { content: LetterContent; review: LetterReview | null };

export type LetterPageData = {
  applicationId: string;
  role: string;
  company: string;
  content: LetterContent;
  saved: boolean;
  review: LetterReview | null;
  hasPosting: boolean;
  aiEnabled: boolean;
  /** The exact prompt a run would send now, for the "see what's sent" panel. */
  prompt: { system: string; user: string; custom: boolean } | null;
  profileEmpty: boolean;
};

const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A letter with the sender, date and recipient filled in and the body still to write. */
export function letterFromProfile(profile: ProfileInput, company: string, jobLocation: string | null): LetterContent {
  return {
    name: profile.name,
    contact: {
      email: profile.email,
      phone: profile.phone,
      location: [profile.city, profile.region, countryName(profile.country)].filter(Boolean).join(", "),
    },
    date: today(),
    recipient: ["Hiring Manager", company, jobLocation].filter(Boolean).join("\n"),
    greeting: "Dear Hiring Manager,",
    body: "",
    closing: "Sincerely,",
    pageSize: defaultPageSize(profile.country),
  };
}

export async function readLetterPrompt(db: AnyDb, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ prompt: schema.userSettings.coverLetterPrompt })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return row?.prompt ?? null;
}

async function inputs(db: AnyDb, user: { id: string; name: string }, applicationId: string) {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return null;
  const [{ profile }, cvText, saved, customPrompt] = await Promise.all([
    readProfile(db, user),
    readCvText(db, user.id),
    readAppDocument<StoredLetter>(db, user.id, applicationId, "cover_letter"),
    readLetterPrompt(db, user.id),
  ]);
  const job = application.job ? evaluationJobOf(application.job) : null;
  const base = letterFromProfile(profile, application.company, application.job?.location ?? null);
  return { application, profile, cvText, saved, customPrompt, job, base };
}

export async function readLetterPage(
  db: AnyDb,
  user: { id: string; name: string },
  applicationId: string,
  aiEnabled: boolean,
): Promise<LetterPageData | null> {
  const found = await inputs(db, user, applicationId);
  if (!found) return null;
  const { application, profile, cvText, saved, customPrompt, job, base } = found;
  return {
    applicationId,
    role: application.role,
    company: application.company,
    content: saved?.data.content ?? base,
    saved: Boolean(saved),
    review: saved?.data.review ?? null,
    hasPosting: Boolean(job),
    aiEnabled,
    prompt: job ? { system: letterSystemPrompt(customPrompt), user: buildLetterPrompt({ profile, cvText, job }), custom: Boolean(customPrompt) } : null,
    profileEmpty: profile.experience.length === 0 && profile.skills.length === 0 && !cvText,
  };
}

const letterTitle = (role: string, company: string) => `Cover letter for ${role} at ${company}`;

/**
 * Draft the application's cover letter and save it. Keeps the sender lines, recipient and
 * paper size the user already set; the date moves to today.
 */
export async function draftApplicationLetter(
  db: AnyDb,
  user: { id: string; name: string },
  applicationId: string,
  config: AiConfig,
): Promise<{ content: LetterContent; review: LetterReview }> {
  const found = await inputs(db, user, applicationId);
  if (!found) throw new Error("Application not found.");
  const { application, profile, cvText, saved, customPrompt, job, base } = found;
  if (!job) throw new Error("The posting for this application isn't stored anymore, so there's nothing to write to.");

  const start: LetterContent = saved ? { ...saved.data.content, date: base.date } : base;
  const result = await writeCoverLetter({ profile, cvText, job, base: start, company: application.company, customPrompt }, config);
  const review: LetterReview = { ...result.review, model: describeAiConfig(config), at: new Date().toISOString(), customPrompt: Boolean(customPrompt) };

  await writeAppDocument(db, user.id, applicationId, "cover_letter", letterTitle(application.role, application.company), {
    content: result.content,
    review,
  } satisfies StoredLetter);
  return { content: result.content, review };
}

/** Save the user's edits; their email and phone also go to the profile. */
export async function saveEditedLetter(db: AnyDb, user: { id: string; name: string }, applicationId: string, content: LetterContent): Promise<boolean> {
  const found = await inputs(db, user, applicationId);
  if (!found) return false;
  await writeAppDocument(db, user.id, applicationId, "cover_letter", letterTitle(found.application.role, found.application.company), {
    content,
    review: found.saved?.data.review ?? null,
  } satisfies StoredLetter);
  await writeContact(db, user.id, { email: content.contact.email, phone: content.contact.phone, links: found.profile.links });
  return true;
}

/** Throw the letter away and return the blank one the page starts from again. */
export async function discardApplicationLetter(db: AnyDb, user: { id: string; name: string }, applicationId: string): Promise<LetterContent | null> {
  const found = await inputs(db, user, applicationId);
  if (!found) return null;
  await deleteAppDocument(db, user.id, applicationId, "cover_letter");
  return found.base;
}
