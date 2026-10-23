import { AI_PRESETS, type AiPresetId } from "@/lib/ai/presets";
import { describeAiConfig, type AiConfig, type UserSettingsRow } from "@/lib/ai/settings";
import { maskSecret } from "@/lib/secret-hint";
import type { AiSettingsView } from "./ai-settings-form";

/** What the Settings forms show, built the same way from the server's and the browser's settings row. */
export function aiSettingsView(
  row: UserSettingsRow | null,
  readSecret: (stored: string | null | undefined) => string | null,
  active: AiConfig | null,
): AiSettingsView {
  const preset = row?.aiPreset && row.aiPreset in AI_PRESETS ? (row.aiPreset as AiPresetId) : null;
  return {
    preset: row?.aiProvider ? preset : null,
    baseUrl: row?.aiBaseUrl ?? null,
    model: row?.aiModel ?? null,
    reasoningEffort: row?.aiReasoningEffort ?? null,
    apiKeyHint: maskSecret(readSecret(row?.aiApiKeyEnc)),
    activeLabel: active ? describeAiConfig(active) : null,
    activeSource: active?.source ?? null,
  };
}
