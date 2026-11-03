import "server-only";
import { cache } from "react";
import { chatGptAccessToken } from "@/lib/chatgpt/account";
import { getDb } from "@/lib/db";
import { isLite } from "@/lib/mode";
import { decryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";
import { readSettings } from "@/lib/settings/queries";
import { aiConfigFromRow, DEFAULT_ANTHROPIC_MODEL, type ProviderConfig, type UserSettingsRow } from "./settings";

export { DEFAULT_ANTHROPIC_MODEL, describeAiConfig, type AiConfig, type UserSettingsRow } from "./settings";

export const getMySettingsRow = cache(async (): Promise<UserSettingsRow | null> => {
  const user = await getCurrentUser();
  return readSettings(await getDb(), user.id);
});

function fromEnv(): ProviderConfig | null {
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
export const getAiConfig = cache(async (): Promise<ProviderConfig | null> => aiConfigFor(await getMySettingsRow()));

/** The AI provider for a settings row, for callers that already read it (the MCP server). */
export function aiConfigFor(row: UserSettingsRow | null): ProviderConfig | null {
  if (row?.aiProvider === "chatgpt" && row.aiModel && !isLite) {
    const { userId } = row;
    return { provider: "chatgpt", model: row.aiModel, accessToken: () => chatGptAccessToken(userId), source: "settings" };
  }
  return aiConfigFromRow(row, decryptSecret) ?? fromEnv();
}

export async function isAiConfigured(): Promise<boolean> {
  return (await getAiConfig()) !== null;
}

export async function getJobSpyEnabled(): Promise<boolean> {
  const row = await getMySettingsRow();
  return Boolean(row?.jobspyEnabled);
}

export async function getRapidApiKey(): Promise<string | null> {
  return rapidApiKeyFor(await getMySettingsRow());
}

export function rapidApiKeyFor(row: UserSettingsRow | null): string | null {
  return decryptSecret(row?.rapidApiKeyEnc) ?? process.env.RAPIDAPI_KEY ?? null;
}
