"use server";

import { refresh } from "next/cache";
import { extractProfileFromCv } from "@/lib/ai/extract-profile";
import { getDb } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/config";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { detectSkills } from "@/lib/profile/detect-skills";
import { writeCv, writeProfile } from "@/lib/profile/queries";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";

export type { CvImport };

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }

  await writeProfile(await getDb(), user.id, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const user = await getCurrentUser();
  const read = await readCvFile(formData.get("cv"));
  if (!read.ok) return read;
  const { fileName, text } = read.data;

  await writeCv(await getDb(), user.id, fileName, text);

  let aiError: string | undefined;
  if (await isAiConfigured()) {
    try {
      const draft = await extractProfileFromCv(text);
      return { ok: true, data: { fileName, draft, usedAi: true } };
    } catch (error) {
      console.error("CV extraction failed", error);
      aiError = error instanceof Error ? error.message : "AI extraction failed.";
      // Fall through to the free path so the import still helps.
    }
  }

  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { ok: true, data: { fileName, draft: { skills }, usedAi: false, aiError } };
}
