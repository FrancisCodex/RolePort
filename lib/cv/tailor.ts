import { buildTailorPrompt, cvSystemPrompt, tailorCv } from "@/lib/ai/tailor-cv";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import type { AnyDb } from "@/lib/db/types";
import { readApplication } from "@/lib/jobs/applications";
import { evaluationJobOf } from "@/lib/jobs/fit-evaluation";
import { readCvText, readProfile } from "@/lib/profile/queries";
import { cvFromProfile, deleteCv, readCv, readCvPrompt, writeContact, writeCv } from "./queries";
import type { CvContent, CvTailoring } from "./types";

/*
 * The CV page's data and the tailoring run, shared by the server (actions, page) and the
 * lite edition's browser database. No auth here: callers pass the user.
 */

export type CvPageData = {
  applicationId: string;
  role: string;
  company: string;
  /** The saved CV, or one built from the profile when nothing is saved yet. */
  content: CvContent;
  saved: boolean;
  tailoring: CvTailoring | null;
  updatedAt: string | null;
  /** Whether the stored posting is there to tailor against. */
  hasPosting: boolean;
  aiEnabled: boolean;
  /** The exact prompt a tailoring run would send now, for the "see the prompt" panel. */
  prompt: { system: string; user: string; custom: boolean } | null;
  /** Nothing to build a CV from yet. */
  profileEmpty: boolean;
};

async function inputs(db: AnyDb, user: { id: string; name: string }, applicationId: string) {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return null;
  const [{ profile }, cvText, saved, customPrompt] = await Promise.all([
    readProfile(db, user),
    readCvText(db, user.id),
    readCv(db, user.id, applicationId),
    readCvPrompt(db, user.id),
  ]);
  const job = application.job ? evaluationJobOf(application.job) : null;
  return { application, profile, cvText, saved, customPrompt, job };
}

export async function readCvPage(db: AnyDb, user: { id: string; name: string }, applicationId: string, aiEnabled: boolean): Promise<CvPageData | null> {
  const found = await inputs(db, user, applicationId);
  if (!found) return null;
  const { application, profile, cvText, saved, customPrompt, job } = found;
  return {
    applicationId,
    role: application.role,
    company: application.company,
    content: saved?.content ?? cvFromProfile(profile),
    saved: Boolean(saved),
    tailoring: saved?.tailoring ?? null,
    updatedAt: saved?.updatedAt.toISOString() ?? null,
    hasPosting: Boolean(job),
    aiEnabled,
    prompt: job ? { system: cvSystemPrompt(customPrompt), user: buildTailorPrompt({ profile, cvText, job }), custom: Boolean(customPrompt) } : null,
    profileEmpty: profile.experience.length === 0 && profile.skills.length === 0 && !cvText,
  };
}

export const cvTitle = (role: string, company: string) => `CV for ${role} at ${company}`;

/**
 * Tailor the application's CV to its posting and save it. Starts from the profile each time
 * (so new profile facts come through) but keeps the contact lines and paper size the user set.
 */
export async function tailorApplicationCv(
  db: AnyDb,
  user: { id: string; name: string },
  applicationId: string,
  config: AiConfig,
): Promise<{ content: CvContent; tailoring: CvTailoring }> {
  const found = await inputs(db, user, applicationId);
  if (!found) throw new Error("Application not found.");
  const { application, profile, cvText, saved, customPrompt, job } = found;
  if (!job) throw new Error("The posting for this application isn't stored anymore, so there's nothing to tailor to.");

  const fresh = cvFromProfile(profile);
  const base: CvContent = saved ? { ...fresh, name: saved.content.name || fresh.name, contact: saved.content.contact, pageSize: saved.content.pageSize } : fresh;
  const result = await tailorCv({ profile, cvText, job, base, customPrompt }, config);
  const tailoring: CvTailoring = { ...result.tailoring, model: describeAiConfig(config), at: new Date().toISOString(), customPrompt: Boolean(customPrompt) };

  await writeCv(db, user.id, applicationId, cvTitle(application.role, application.company), { content: result.content, tailoring });
  return { content: result.content, tailoring };
}

/** Save the user's edits to an application's CV; the contact lines also go to the profile for the next CV. */
export async function saveEditedCv(db: AnyDb, userId: string, applicationId: string, content: CvContent): Promise<boolean> {
  const application = await readApplication(db, userId, applicationId);
  if (!application) return false;
  const existing = await readCv(db, userId, applicationId);
  await writeCv(db, userId, applicationId, cvTitle(application.role, application.company), { content, tailoring: existing?.tailoring ?? null });
  await writeContact(db, userId, { email: content.contact.email, phone: content.contact.phone, links: content.contact.links });
  return true;
}

/** Throw away the application's CV and return the profile-based one the page starts from again. */
export async function discardApplicationCv(db: AnyDb, user: { id: string; name: string }, applicationId: string): Promise<CvContent | null> {
  const found = await inputs(db, user, applicationId);
  if (!found) return null;
  await deleteCv(db, user.id, applicationId);
  return cvFromProfile(found.profile);
}
