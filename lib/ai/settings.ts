import { z } from "zod";
import type * as schema from "@/lib/db/schema";
import { AI_PRESET_IDS, AI_PRESETS } from "./presets";

/*
 * AI provider settings without storage or secrets handling, shared by the server
 * (lib/ai/config.ts, settings actions) and the lite edition in the browser.
 */

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

/** The provider chosen in Settings, or null. `readSecret` turns a stored key back into plain text. */
export function aiConfigFromRow(row: UserSettingsRow | null, readSecret: (stored: string | null | undefined) => string | null): AiConfig | null {
  if (row?.aiProvider === "anthropic") {
    const apiKey = readSecret(row.aiApiKeyEnc);
    if (apiKey) return { provider: "anthropic", apiKey, model: row.aiModel || DEFAULT_ANTHROPIC_MODEL, source: "settings" };
  }
  if (row?.aiProvider === "openai_compatible" && row.aiBaseUrl && row.aiModel) {
    return {
      provider: "openai_compatible",
      baseUrl: row.aiBaseUrl,
      apiKey: readSecret(row.aiApiKeyEnc),
      model: row.aiModel,
      reasoningEffort: row.aiReasoningEffort,
      source: "settings",
    };
  }
  return null;
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

/* -------------------------------------------------------------------------- */
/* Settings form input                                                        */
/* -------------------------------------------------------------------------- */

export const aiInput = z.object({
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

/**
 * Only http(s). `allowPrivateHosts` is false on a shared server, so users can't point it at
 * internal addresses; true for local mode and for the lite edition (the user's own browser).
 */
export function checkBaseUrl(raw: string | null, allowPrivateHosts: boolean): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL isn't a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Base URL must start with http:// or https://");
  if (!allowPrivateHosts && PRIVATE_HOST.test(url.hostname)) {
    throw new Error("Local addresses are only allowed when HireMe runs in local mode.");
  }
  return url.toString().replace(/\/+$/, "");
}

/** Turn form input into a provider config, reusing `savedKey` when the key field was left blank. */
export function resolveAiInput(
  input: AiSettingsInput,
  savedKey: string | null,
  allowPrivateHosts: boolean,
): { config: AiConfig; apiKey: string | null } {
  const preset = AI_PRESETS[input.preset as keyof typeof AI_PRESETS];
  const apiKey = input.clearApiKey ? null : input.apiKey || savedKey;
  const model = input.model || preset.defaultModel;

  if (preset.provider === "anthropic") {
    if (!apiKey) throw new Error("Add your Anthropic API key.");
    return { config: { provider: "anthropic", apiKey, model: model || DEFAULT_ANTHROPIC_MODEL, source: "settings" }, apiKey };
  }

  const baseUrl = checkBaseUrl(input.baseUrl || preset.baseUrl, allowPrivateHosts);
  if (!baseUrl) throw new Error("Add the server's base URL.");
  if (preset.needsKey && !apiKey) throw new Error(`Add your ${preset.label} API key.`);
  return {
    config: { provider: "openai_compatible", baseUrl, apiKey, model, reasoningEffort: input.reasoningEffort, source: "settings" },
    apiKey,
  };
}

/** The `user_settings` columns for a resolved provider. `storedKey` is the key as stored: encrypted (server) or encoded (lite). */
export function aiSettingsValues(preset: string, config: AiConfig, storedKey: string | null) {
  return {
    aiProvider: config.provider,
    aiPreset: preset,
    aiBaseUrl: config.provider === "openai_compatible" ? config.baseUrl : null,
    aiModel: config.model,
    aiApiKeyEnc: storedKey,
    aiReasoningEffort: config.provider === "openai_compatible" ? config.reasoningEffort : null,
  };
}
