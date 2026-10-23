"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateStructured, listModels } from "@/lib/ai/client";
import { getMySettingsRow } from "@/lib/ai/config";
import { AI_PRESETS } from "@/lib/ai/presets";
import { aiInput, aiSettingsValues, checkBaseUrl, resolveAiInput, type AiSettingsInput } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { isLocalMode, jobSpyUrl } from "@/lib/env";
import type { Result } from "@/lib/result";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type { AiSettingsInput };

/** Form input → provider config, reusing the saved key when the field was left blank. */
async function resolve(input: AiSettingsInput) {
  const saved = await getMySettingsRow();
  return resolveAiInput(input, decryptSecret(saved?.aiApiKeyEnc), isLocalMode);
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
    const result = await generateStructured({
      config,
      system: "You are a connection check for a job search app.",
      prompt: 'Say hello to a job seeker in the Philippines in at most six words. Put it in the "reply" field.',
      schema: z.object({ reply: z.string() }),
      effort: "low",
    });
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
      baseUrl: preset.provider === "openai_compatible" ? checkBaseUrl(parsed.data.baseUrl || preset.baseUrl, isLocalMode) : null,
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
  // The JobSpy boards are for self-hosted, single-person installs only.
  if (input.data.enabled && (!isLocalMode || !jobSpyUrl)) {
    return { ok: false, error: "JobSpy is only available on a self-hosted install with the JobSpy service running." };
  }
  await writeSettings(await getDb(), user.id, { jobspyEnabled: input.data.enabled });
  refresh();
  return { ok: true, data: undefined };
}
