import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readCvText, readProfile, type ProfileView } from "./queries";

export type { ProfileView };

/** Profile of the current user, with empty defaults when nothing is saved yet. */
export async function getMyProfile(): Promise<ProfileView> {
  const user = await getCurrentUser();
  return readProfile(await getDb(), user);
}

export async function getMySkillNames(): Promise<string[]> {
  const { profile } = await getMyProfile();
  return profile.skills.map((s) => s.name);
}

/** Plain text of the last imported CV, for AI features that need more than the structured profile. */
export async function getMyCvText(): Promise<string | null> {
  const user = await getCurrentUser();
  return readCvText(await getDb(), user.id);
}
