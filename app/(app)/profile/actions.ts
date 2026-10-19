"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { AiUnavailableError } from "@/lib/ai/client";
import { extractProfileFromCv } from "@/lib/ai/extract-profile";
import { getDb, schema } from "@/lib/db";
import { isAiEnabled } from "@/lib/env";
import { detectSkills } from "@/lib/profile/detect-skills";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";
import { getCurrentUser } from "@/lib/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }

  const { name, ...profile } = parsed.data;
  const values = {
    ...profile,
    experience: profile.experience.map((e) => ({ ...e, end: e.end ?? undefined, location: e.location ?? undefined })),
    education: profile.education.map((e) => ({ ...e, field: e.field ?? undefined, year: e.year ?? undefined })),
  };

  const db = await getDb();
  await db.update(schema.user).set({ name }).where(eq(schema.user.id, user.id));
  await db
    .insert(schema.profile)
    .values({ userId: user.id, ...values, onboardedAt: new Date() })
    .onConflictDoUpdate({ target: schema.profile.userId, set: values });

  refresh();
  return { ok: true, data: undefined };
}

const MAX_CV_BYTES = 5 * 1024 * 1024;

export type CvImport = {
  fileName: string;
  /** AI-extracted fields, or only detected skills when AI is off. Not saved until the user saves the form. */
  draft: Partial<ProfileInput>;
  usedAi: boolean;
};

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const user = await getCurrentUser();
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF or .txt file." };
  if (file.size > MAX_CV_BYTES) return { ok: false, error: "That file is over 5 MB." };

  let text: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      text = new TextDecoder().decode(bytes);
    } else {
      return { ok: false, error: "Only PDF and .txt files are supported for now." };
    }
  } catch {
    return { ok: false, error: "We couldn't read that file. Is it a text-based PDF (not a scan)?" };
  }

  text = text.replace(/\u0000/g, "").trim();
  if (text.length < 50) {
    return { ok: false, error: "We couldn't find any text in that file. Scanned PDFs aren't supported yet." };
  }

  const db = await getDb();
  await db
    .insert(schema.profile)
    .values({ userId: user.id, cvText: text, cvFileName: file.name })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { cvText: text, cvFileName: file.name } });

  if (isAiEnabled) {
    try {
      const draft = await extractProfileFromCv(text);
      return { ok: true, data: { fileName: file.name, draft, usedAi: true } };
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) console.error("CV extraction failed", error);
      // Fall through to the free path so the import still helps.
    }
  }

  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { ok: true, data: { fileName: file.name, draft: { skills }, usedAi: false } };
}
