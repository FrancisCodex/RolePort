import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { emptyProfile, type ProfileInput } from "./schema";

/*
 * Profile storage, shared by the server (lib/profile/data.ts, profile actions) and
 * the browser database of the lite edition. No auth here: callers pass the user.
 */

export type ProfileView = {
  profile: ProfileInput;
  cvFileName: string | null;
  hasCv: boolean;
  isComplete: boolean;
};

/** The user's profile, with empty defaults when nothing is saved yet. */
export async function readProfile(db: AnyDb, user: { id: string; name: string }): Promise<ProfileView> {
  const [row] = await db.select().from(schema.profile).where(eq(schema.profile.userId, user.id));

  if (!row) {
    return { profile: { ...emptyProfile, name: user.name }, cvFileName: null, hasCv: false, isComplete: false };
  }

  const profile: ProfileInput = {
    name: user.name,
    headline: row.headline,
    summary: row.summary,
    city: row.city,
    region: row.region,
    country: row.country,
    targetCountries: row.targetCountries,
    workAuthorizations: row.workAuthorizations,
    yearsExperience: row.yearsExperience,
    desiredRoles: row.desiredRoles,
    workSetups: row.workSetups,
    skills: row.skills.map((s) => ({ name: s.name, level: s.level })),
    experience: row.experience.map((e) => ({ ...e, end: e.end ?? null, location: e.location ?? null })),
    education: row.education.map((e) => ({ ...e, field: e.field ?? null, year: e.year ?? null })),
    languages: row.languages,
    careerGoals: row.careerGoals,
    dealBreakers: row.dealBreakers,
    salaryMinMonthly: row.salaryMinMonthly,
    salaryMaxMonthly: row.salaryMaxMonthly,
    salaryCurrency: row.salaryCurrency,
  };

  return {
    profile,
    cvFileName: row.cvFileName,
    hasCv: Boolean(row.cvText),
    isComplete: profile.skills.length > 0 && profile.desiredRoles.length > 0,
  };
}

/** Plain text of the last imported CV, for AI features that need more than the structured profile. */
export async function readCvText(db: AnyDb, userId: string): Promise<string | null> {
  const [row] = await db.select({ cvText: schema.profile.cvText }).from(schema.profile).where(eq(schema.profile.userId, userId));
  return row?.cvText ?? null;
}

/** Save a validated profile (the name lives on the user row). */
export async function writeProfile(db: AnyDb, userId: string, input: ProfileInput): Promise<void> {
  const { name, ...profile } = input;
  const values = {
    ...profile,
    experience: profile.experience.map((e) => ({ ...e, end: e.end ?? undefined, location: e.location ?? undefined })),
    education: profile.education.map((e) => ({ ...e, field: e.field ?? undefined, year: e.year ?? undefined })),
  };

  await db.update(schema.user).set({ name }).where(eq(schema.user.id, userId));
  await db
    .insert(schema.profile)
    .values({ userId, ...values, onboardedAt: new Date() })
    .onConflictDoUpdate({ target: schema.profile.userId, set: values });
}

export async function writeCv(db: AnyDb, userId: string, fileName: string, text: string): Promise<void> {
  await db
    .insert(schema.profile)
    .values({ userId, cvText: text, cvFileName: fileName })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { cvText: text, cvFileName: fileName } });
}
