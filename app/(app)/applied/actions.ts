"use server";

import { refresh } from "next/cache";
import { getDb } from "@/lib/db";
import { markApplied, removeApplication, writeNotes } from "@/lib/jobs/applications";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { MAX_NOTES } from "./view-data";

/** "Apply" on a job: track it as applied and return the application the UI opens next. */
export async function applyToJob(jobId: string): Promise<Result<{ applicationId: string }>> {
  const user = await getCurrentUser();
  const applied = await markApplied(await getDb(), user.id, jobId);
  if (!applied) return { ok: false, error: "This job is no longer stored. Search for it again." };
  if (applied.changed) refresh();
  return { ok: true, data: { applicationId: applied.applicationId } };
}

export async function saveApplicationNotes(applicationId: string, notes: string): Promise<Result> {
  if (typeof notes !== "string" || notes.length > MAX_NOTES) return { ok: false, error: "Notes are too long." };
  const user = await getCurrentUser();
  if (!(await writeNotes(await getDb(), user.id, applicationId, notes))) return { ok: false, error: "Application not found." };
  return { ok: true, data: undefined };
}

export async function deleteApplication(applicationId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!(await removeApplication(await getDb(), user.id, applicationId))) return { ok: false, error: "Application not found." };
  refresh();
  return { ok: true, data: undefined };
}
