import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import { getCurrentUser } from "@/lib/session";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export type AiConfig =
  | { provider: "anthropic"; apiKey: string; model: string; source: "settings" | "env" }
  | {
      provider: "openai_compatible";
      baseUrl: string;
      apiKey: string | null;
      model: string;
      /** Sent as reasoning_effort when set (e.g. "none" makes local thinking models much faster). */
      reasoningEffort: string | null;
      source: "settings" | "env";
    };

export type UserSettingsRow = typeof schema.userSettings.$inferSelect;

export const getMySettingsRow = cache(async (): Promise<UserSettingsRow | null> => {
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id));
  return row ?? null;
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
  const row = await getMySettingsRow();
  if (row?.aiProvider === "anthropic") {
    const apiKey = decryptSecret(row.aiApiKeyEnc);
    if (apiKey) return { provider: "anthropic", apiKey, model: row.aiModel || DEFAULT_ANTHROPIC_MODEL, source: "settings" };
  }
  if (row?.aiProvider === "openai_compatible" && row.aiBaseUrl && row.aiModel) {
    return {
      provider: "openai_compatible",
      baseUrl: row.aiBaseUrl,
      apiKey: decryptSecret(row.aiApiKeyEnc),
      model: row.aiModel,
      reasoningEffort: row.aiReasoningEffort,
      source: "settings",
    };
  }
  return fromEnv();
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

/** Short human label, e.g. "Ollama · gemma4:12b". */
export function describeAiConfig(config: AiConfig): string {
  if (config.provider === "anthropic") return `Claude · ${config.model}`;
  const host = (() => {
    try {
      return new URL(config.baseUrl).host;
    } catch {
      return config.baseUrl;
    }
  })();
  const name = host.startsWith("localhost:11434") || host.startsWith("127.0.0.1:11434") ? "Ollama" : host;
  return `${name} · ${config.model}`;
}
