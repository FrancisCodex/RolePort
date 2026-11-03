import "server-only";
import { getDb } from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/settings/queries";
import { listChatGptModels } from "./oauth";

/** Makes the ChatGPT plan the AI provider, keeping the chosen model if the account still offers it, else OpenAI's first. */
export async function switchToChatGpt(userId: string, accessToken: string): Promise<void> {
  const db = await getDb();
  const saved = await readSettings(db, userId);
  const models = await listChatGptModels(accessToken);
  const keep = saved?.aiPreset === "chatgpt" && saved.aiModel && models.some((m) => m.slug === saved.aiModel);
  const model = keep ? saved.aiModel : models[0]?.slug;
  if (!model) throw new Error("Your ChatGPT account didn't list any models RolePort can use.");
  await writeSettings(db, userId, { aiProvider: "chatgpt", aiPreset: "chatgpt", aiModel: model, aiBaseUrl: null, aiReasoningEffort: null });
}
