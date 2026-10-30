import { eq } from "drizzle-orm";
import { countryName } from "@/lib/geo/countries";
import * as schema from "@/lib/db/schema";
import type { CvContact } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { deleteAppDocument, readAppDocument, writeAppDocument } from "@/lib/documents/queries";
import type { ProfileInput } from "@/lib/profile/schema";
import { defaultPageSize, type CvContent, type CvTailoring, type SavedCv } from "./types";

/*
 * CV storage, shared by the server and the lite edition's browser database: the contact
 * lines on the profile, one CV document per application, and the user's tailoring prompt.
 * No auth here: callers pass the user.
 */

/** Save the contact lines on the profile: the CV editor edits them too. */
export async function writeContact(db: AnyDb, userId: string, contact: CvContact): Promise<void> {
  await db
    .insert(schema.profile)
    .values({ userId, cvContact: contact })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { cvContact: contact } });
}

/** A CV straight from the profile, before any tailoring: every role with its own highlights. */
export function cvFromProfile(profile: ProfileInput): CvContent {
  return {
    name: profile.name,
    headline: profile.headline ?? profile.desiredRoles[0] ?? "",
    contact: {
      email: profile.email,
      phone: profile.phone,
      location: [profile.city, profile.region, countryName(profile.country)].filter(Boolean).join(", "),
      links: profile.links,
    },
    summary: profile.summary ?? "",
    // Primary skills first, then the rest; skills still being learned don't go on a CV.
    skills: [...profile.skills.filter((s) => s.level === "primary"), ...profile.skills.filter((s) => s.level === "secondary")].map((s) => s.name),
    experience: profile.experience.map((e) => ({
      company: e.company,
      role: e.role,
      start: e.start,
      end: e.end,
      location: e.location,
      bullets: e.highlights,
    })),
    education: profile.education,
    languages: profile.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)),
    sections: profile.sections,
    pageSize: defaultPageSize(profile.country),
  };
}

type StoredCv = { content: CvContent; tailoring: CvTailoring | null };

/** The CV saved for this application, or null if there isn't one yet. */
export async function readCv(db: AnyDb, userId: string, applicationId: string): Promise<SavedCv | null> {
  const doc = await readAppDocument<StoredCv>(db, userId, applicationId, "cv");
  return doc && { content: doc.data.content, tailoring: doc.data.tailoring ?? null, updatedAt: doc.updatedAt, version: doc.version };
}

/** Save the CV for an application, replacing the previous one (its version goes up). */
export async function writeCv(db: AnyDb, userId: string, applicationId: string, title: string, cv: StoredCv): Promise<void> {
  await writeAppDocument(db, userId, applicationId, "cv", title, cv);
}

export async function readCvPrompt(db: AnyDb, userId: string): Promise<string | null> {
  const [row] = await db.select({ prompt: schema.userSettings.cvPrompt }).from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return row?.prompt ?? null;
}

/** Throw away an application's CV, so the page starts again from the profile. */
export async function deleteCv(db: AnyDb, userId: string, applicationId: string): Promise<void> {
  await deleteAppDocument(db, userId, applicationId, "cv");
}
