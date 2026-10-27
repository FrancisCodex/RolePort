"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateStructured, listModels } from "@/lib/ai/client";
import { getMySettingsRow } from "@/lib/ai/config";
import { AI_PRESETS } from "@/lib/ai/presets";
import { aiInput, aiSettingsValues, checkBaseUrl, CONNECTION_TEST, resolveAiInput, type AiSettingsInput } from "@/lib/ai/settings";
import { exportBackup } from "@/lib/backup/export";
import { importErrorMessage, readBackupForm } from "@/lib/backup/form";
import { importBackup, type ImportSummary } from "@/lib/backup/import";
import { getDb } from "@/lib/db";
import { jobSpyUrl } from "@/lib/env";
import type { Result } from "@/lib/result";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type { AiSettingsInput };

/** Form input → provider config, reusing the saved key when the field was left blank. */
async function resolve(input: AiSettingsInput) {
  const saved = await getMySettingsRow();
  return resolveAiInput(input, decryptSecret(saved?.aiApiKeyEnc));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error.message + String((error as { cause?: unknown }).cause))) {
      return "Couldn't reach the server. Is it running, and is the base URL right?";
    }
    return error.message;
  }
  return "Something went wrong.";
}

export async function saveAiSettings(raw: AiSettingsInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  try {
    const { config, apiKey } = await resolve(parsed.data);
    if (!config.model) return { ok: false, error: "Choose a model." };
    await writeSettings(await getDb(), user.id, aiSettingsValues(parsed.data.preset, config, apiKey ? encryptSecret(apiKey) : null));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function turnOffAi(): Promise<Result> {
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { aiProvider: null, aiApiKeyEnc: null });
  refresh();
  return { ok: true, data: undefined };
}

export async function testAiConnection(raw: AiSettingsInput): Promise<Result<{ ms: number; reply: string }>> {
  await getCurrentUser();
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  try {
    const { config } = await resolve(parsed.data);
    if (!config.model) return { ok: false, error: "Choose a model first." };
    const started = Date.now();
    const result = await generateStructured({ ...CONNECTION_TEST, config });
    return { ok: true, data: { ms: Date.now() - started, reply: result.reply } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function fetchModels(raw: AiSettingsInput): Promise<Result<string[]>> {
  await getCurrentUser();
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  try {
    const preset = AI_PRESETS[parsed.data.preset as keyof typeof AI_PRESETS];
    const saved = await getMySettingsRow();
    const apiKey = parsed.data.clearApiKey ? null : parsed.data.apiKey || decryptSecret(saved?.aiApiKeyEnc);
    const models = await listModels({
      provider: preset.provider,
      baseUrl: preset.provider === "openai_compatible" ? checkBaseUrl(parsed.data.baseUrl || preset.baseUrl) : null,
      apiKey,
    });
    return { ok: true, data: models };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveRapidApiKey(raw: { apiKey: string | null; clear: boolean }): Promise<Result> {
  const user = await getCurrentUser();
  const input = z.object({ apiKey: z.string().trim().max(200).nullable(), clear: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid key." };
  if (!input.data.clear && !input.data.apiKey) return { ok: false, error: "Paste your RapidAPI key." };
  const value = input.data.clear ? null : encryptSecret(input.data.apiKey!);
  await writeSettings(await getDb(), user.id, { rapidApiKeyEnc: value });
  refresh();
  return { ok: true, data: undefined };
}

export async function saveJobSpyEnabled(raw: { enabled: boolean }): Promise<Result> {
  const user = await getCurrentUser();
  const input = z.object({ enabled: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid setting." };
  // The JobSpy boards need the sidecar running next to this install.
  if (input.data.enabled && !jobSpyUrl) {
    return { ok: false, error: "Start the JobSpy service and set JOBSPY_URL first." };
  }
  await writeSettings(await getDb(), user.id, { jobspyEnabled: input.data.enabled });
  refresh();
  return { ok: true, data: undefined };
}

/* Backups ------------------------------------------------------------------- */

// Server actions accept bodies up to 6 MB (next.config.ts).
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** The current user's data as a backup file's text. */
export async function exportData(): Promise<Result<string>> {
  const user = await getCurrentUser();
  return { ok: true, data: JSON.stringify(await exportBackup(await getDb(), user)) };
}

export async function importData(formData: FormData): Promise<Result<ImportSummary>> {
  const user = await getCurrentUser();
  const read = await readBackupForm(formData, MAX_BACKUP_BYTES);
  if (!read.ok) return read;
  try {
    const summary = await importBackup(await getDb(), user.id, read.data.backup, read.data.mode);
    refresh();
    return { ok: true, data: summary };
  } catch (error) {
    return { ok: false, error: importErrorMessage(error) };
  }
}
