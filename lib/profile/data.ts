import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { emptyProfile, type ProfileInput } from "./schema";

export type ProfileView = {
  profile: ProfileInput;
  cvFileName: string | null;
  hasCv: boolean;
  isComplete: boolean;
};

/** Profile of the current user, with empty defaults when nothing is saved yet. */
export async function getMyProfile(): Promise<ProfileView> {
  const user = await getCurrentUser();
  const db = await getDb();
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

export async function getMySkillNames(): Promise<string[]> {
  const { profile } = await getMyProfile();
  return profile.skills.map((s) => s.name);
}

/** Plain text of the last imported CV, for AI features that need more than the structured profile. */
export async function getMyCvText(): Promise<string | null> {
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db.select({ cvText: schema.profile.cvText }).from(schema.profile).where(eq(schema.profile.userId, user.id));
  return row?.cvText ?? null;
}
