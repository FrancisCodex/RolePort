"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateStructured, listModels } from "@/lib/ai/client";
import { getMySettingsRow, type AiConfig } from "@/lib/ai/config";
import { AI_PRESET_IDS, AI_PRESETS } from "@/lib/ai/presets";
import { getDb, schema } from "@/lib/db";
import { isLocalMode, jobSpyUrl } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const aiInput = z.object({
  preset: z.enum(AI_PRESET_IDS as [string, ...string[]]),
  baseUrl: z.string().trim().max(300).nullable(),
  model: z.string().trim().max(200),
  /** null keeps the saved key; "" with clearApiKey removes it. */
  apiKey: z.string().trim().max(500).nullable(),
  clearApiKey: z.boolean(),
  reasoningEffort: z.enum(["none", "low", "medium", "high"]).nullable(),
});
export type AiSettingsInput = z.infer<typeof aiInput>;

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal)/i;

/** Only http(s). On a shared (non-local) deployment, never let users point the server at internal addresses. */
function checkBaseUrl(raw: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL isn't a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Base URL must start with http:// or https://");
  if (!isLocalMode && PRIVATE_HOST.test(url.hostname)) {
    throw new Error("Local addresses are only allowed when HireMe runs in local mode.");
  }
  return url.toString().replace(/\/+$/, "");
}

/** Turn form input into a provider config, reusing the saved key when the field was left blank. */
async function resolve(input: AiSettingsInput): Promise<{ config: AiConfig; apiKey: string | null }> {
  const preset = AI_PRESETS[input.preset as keyof typeof AI_PRESETS];
  const saved = await getMySettingsRow();
  const apiKey = input.clearApiKey ? null : input.apiKey || decryptSecret(saved?.aiApiKeyEnc);
  const model = input.model || preset.defaultModel;

  if (preset.provider === "anthropic") {
    if (!apiKey) throw new Error("Add your Anthropic API key.");
    return { config: { provider: "anthropic", apiKey, model: model || "claude-opus-5-5", source: "settings" }, apiKey };
  }

  const baseUrl = checkBaseUrl(input.baseUrl || preset.baseUrl);
  if (!baseUrl) throw new Error("Add the server's base URL.");
  if (preset.needsKey && !apiKey) throw new Error(`Add your ${preset.label} API key.`);
  return {
    config: {
      provider: "openai_compatible",
      baseUrl,
      apiKey,
      model,
      reasoningEffort: input.reasoningEffort,
      source: "settings",
    },
    apiKey,
  };
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
    const values = {
      aiProvider: config.provider,
      aiPreset: parsed.data.preset,
      aiBaseUrl: config.provider === "openai_compatible" ? config.baseUrl : null,
      aiModel: config.model,
      aiApiKeyEnc: apiKey ? encryptSecret(apiKey) : null,
      aiReasoningEffort: config.provider === "openai_compatible" ? config.reasoningEffort : null,
    };
    const db = await getDb();
    await db
      .insert(schema.userSettings)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: values });
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function turnOffAi(): Promise<Result> {
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .insert(schema.userSettings)
    .values({ userId: user.id, aiProvider: null })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { aiProvider: null, aiApiKeyEnc: null } });
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
  const db = await getDb();
  await db
    .insert(schema.userSettings)
    .values({ userId: user.id, rapidApiKeyEnc: value })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { rapidApiKeyEnc: value } });
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
  const db = await getDb();
  await db
    .insert(schema.userSettings)
    .values({ userId: user.id, jobspyEnabled: input.data.enabled })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { jobspyEnabled: input.data.enabled } });
  refresh();
  return { ok: true, data: undefined };
}
