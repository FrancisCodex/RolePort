"use server";

import { refresh } from "next/cache";
import { getAiConfig } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { draftFromCv } from "@/lib/profile/cv-import";
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
  return { ok: true, data: await draftFromCv(fileName, text, await getAiConfig()) };
}
