import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { isAiEnabled } from "@/lib/env";

export const AI_MODEL = "claude-opus-5-5";

export class AiUnavailableError extends Error {
  constructor(message = "Add ANTHROPIC_API_KEY to .env.local to turn on AI features.") {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient() {
  if (!isAiEnabled) throw new AiUnavailableError();
  return (client ??= new Anthropic());
}

/**
 * One Claude call that returns JSON validated against `schema`.
 * Uses server-side refusal fallbacks so a policy decline is retried on the
 * server-defined fallback model instead of failing outright.
 */
export async function generateStructured<Schema extends z.ZodType>({
  system,
  prompt,
  schema,
  effort = "medium",
}: {
  system: string;
  prompt: string;
  schema: Schema;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<Schema>> {
  const response = await getClient().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request. Try editing the input and running it again.");
  }
  if (response.stop_reason === "max_tokens" || response.parsed_output == null) {
    throw new Error("Claude's answer was incomplete. Please try again.");
  }
  return response.parsed_output;
}
