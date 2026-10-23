import { getBrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { detectSkills } from "@/lib/profile/detect-skills";
import { writeCv, writeProfile } from "@/lib/profile/queries";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";
import type { Result } from "@/lib/result";

/* The lite edition's versions of the server actions, run against the browser database. */

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }
  await writeProfile(await getBrowserDb(), LOCAL_USER.id, parsed.data);
  return { ok: true, data: undefined };
}

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const read = await readCvFile(formData.get("cv"));
  if (!read.ok) return read;
  const { fileName, text } = read.data;

  await writeCv(await getBrowserDb(), LOCAL_USER.id, fileName, text);

  // AI extraction from the browser comes with phase 4 (docs/LITE-IMPLEMENTATION.md); until then, detected skills only.
  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { ok: true, data: { fileName, draft: { skills }, usedAi: false } };
}
