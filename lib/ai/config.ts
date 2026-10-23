import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";
import { readSettings } from "@/lib/settings/queries";
import { aiConfigFromRow, DEFAULT_ANTHROPIC_MODEL, type AiConfig, type UserSettingsRow } from "./settings";

export { DEFAULT_ANTHROPIC_MODEL, describeAiConfig, type AiConfig, type UserSettingsRow } from "./settings";

export const getMySettingsRow = cache(async (): Promise<UserSettingsRow | null> => {
  const user = await getCurrentUser();
  return readSettings(await getDb(), user.id);
});

function fromEnv(): AiConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL,
      source: "env",
    };
  }
  if (process.env.OPENAI_BASE_URL && process.env.AI_MODEL) {
    return {
      provider: "openai_compatible",
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY || null,
      model: process.env.AI_MODEL,
      reasoningEffort: process.env.AI_REASONING_EFFORT || null,
      source: "env",
    };
  }
  return null;
}

/**
 * The AI provider to use for the current user: what they chose in Settings,
 * falling back to environment variables, or null when nothing is configured.
 */
export const getAiConfig = cache(async (): Promise<AiConfig | null> => {
  return aiConfigFromRow(await getMySettingsRow(), decryptSecret) ?? fromEnv();
});

export async function isAiConfigured(): Promise<boolean> {
  return (await getAiConfig()) !== null;
}

export async function getJobSpyEnabled(): Promise<boolean> {
  const row = await getMySettingsRow();
  return Boolean(row?.jobspyEnabled);
}

export async function getRapidApiKey(): Promise<string | null> {
  const row = await getMySettingsRow();
  return decryptSecret(row?.rapidApiKeyEnc) ?? process.env.RAPIDAPI_KEY ?? null;
}
