import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { isLite } from "@/lib/mode";
import { isLocalUrl } from "./local-server";
import type { AgentConfig, AiConfig } from "./settings";

/*
 * Structured model calls on any provider, given its config. Runs on the server
 * (lib/ai/client.ts adds the current user's config) and, in the lite edition, in the
 * browser: every supported provider accepts browser requests (docs/LITE-IMPLEMENTATION.md §4.3).
 */

export class AiUnavailableError extends Error {
  constructor(message = "Choose an AI provider in Settings to turn on AI features.") {
    super(message);
  }
}

export type StructuredRequest<Schema extends z.ZodType> = {
  system: string;
  prompt: string;
  schema: Schema;
  /** Depth of reasoning for providers that support it. */
  effort?: "low" | "medium" | "high";
  /**
   * Local models only: the longest a string (in characters) and a list may be, by default and
   * per property name. The server's JSON grammar enforces them, so a small model that keeps
   * writing one string (it happens) has to close it. Hosted models ignore them.
   */
  limits?: { text: number; list: number; fields?: Record<string, number> };
  config: AiConfig;
};

/** One model call that returns JSON validated against `schema`, on the given provider. */
export async function generateStructured<Schema extends z.ZodType>(req: StructuredRequest<Schema>): Promise<z.infer<Schema>> {
  const { config } = req;
  if (config.provider === "agent") return agentStructured(config, req);
  return config.provider === "anthropic" ? anthropicStructured(config, req) : openAiCompatibleStructured(config, req);
}

/* -------------------------------------------------------------------------- */
/* The user's own AI agent (lib/mcp)                                          */
/* -------------------------------------------------------------------------- */

export type AgentRequest = { system: string; prompt: string; schema: z.ZodType; effort: "low" | "medium" | "high" };

/** Stops a model call on the agent config that has no answer yet: the request, for the agent to answer. */
export class AgentBrief extends Error {
  constructor(readonly request: AgentRequest) {
    super("This answer is written by the AI agent.");
  }
}

/** The agent's answer didn't fit the call's schema; the message lists what to fix. */
export class AgentAnswerError extends Error {}

function agentStructured<Schema extends z.ZodType>(config: AgentConfig, { system, prompt, schema, effort = "medium" }: StructuredRequest<Schema>): z.infer<Schema> {
  if (config.answer === undefined) throw new AgentBrief({ system, prompt, schema, effort });
  let answer = config.answer;
  if (typeof answer === "string") {
    try {
      answer = JSON.parse(answer);
    } catch {
      throw new AgentAnswerError("The answer isn't valid JSON. Send the JSON object itself.");
    }
  }
  const parsed = schema.safeParse(answer);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new AgentAnswerError(`The answer doesn't match answerSchema. Fix these and send it again: ${issues.join("; ")}`);
  }
  return parsed.data;
}

// The Anthropic SDK refuses to run in a browser unless told to; the lite edition calls it with the user's own key.
const anthropic = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: isLite });

/* -------------------------------------------------------------------------- */
/* Anthropic (Claude)                                                         */
/* -------------------------------------------------------------------------- */

// Models that accept output_config.effort.
const SUPPORTS_EFFORT = /^claude-(opus|sonnet-5|fable|haiku-5|mythos)/;

async function anthropicStructured<Schema extends z.ZodType>(
  config: Extract<AiConfig, { provider: "anthropic" }>,
  { system, prompt, schema, effort = "medium" }: StructuredRequest<Schema>,
): Promise<z.infer<Schema>> {
  const client = anthropic(config.apiKey);
  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 16000,
    // On a policy decline, retry on the server-defined fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      ...(SUPPORTS_EFFORT.test(config.model) ? { effort } : {}),
      format: betaZodOutputFormat(schema),
    },
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

/* -------------------------------------------------------------------------- */
/* OpenAI-compatible: Ollama, LM Studio, OpenAI, OpenRouter, Groq, …          */
/* -------------------------------------------------------------------------- */

const LOCAL_TIMEOUT_MS = 5 * 60_000; // local models can take minutes on the first (cold) call
// A small model can loop inside a JSON string forever; capping the reply turns that into a
// quick, clear failure instead of the timeout. Hosted servers keep their own limits.
const LOCAL_MAX_TOKENS = 8192;

/** A model running on the user's own machine (Ollama, LM Studio): small context, slow, worth keeping prompts lean. */
export function isLocalModel(config: AiConfig): boolean {
  return config.provider === "openai_compatible" && isLocalUrl(config.baseUrl);
}

/** Strict-mode JSON Schema: every property required, no extra keys (nullable fields stay nullable), and any `limits` as maxLength and maxItems. */
export function toStrictJsonSchema(schema: z.ZodType, limits?: StructuredRequest<z.ZodType>["limits"]): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  const visit = (node: unknown, name?: string) => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
      obj.additionalProperties = false;
      obj.required = Object.keys(obj.properties);
    }
    if (limits && obj.type === "string" && !("enum" in obj)) obj.maxLength ??= limits.fields?.[name ?? ""] ?? limits.text;
    if (limits && obj.type === "array") obj.maxItems ??= limits.fields?.[name ?? ""] ?? limits.list;
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) value.forEach((v) => visit(v));
      else if (key === "properties" && value && typeof value === "object") for (const [prop, v] of Object.entries(value)) visit(v, prop);
      else visit(value);
    }
  };
  visit(json);
  return json;
}

/** Pull the JSON object out of a reply that may include <think> blocks or ``` fences. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model didn't return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatCompletion(
  config: Extract<AiConfig, { provider: "openai_compatible" }>,
  messages: ChatMessage[],
  responseFormat: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      response_format: responseFormat,
      temperature: 0.2,
      ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
      ...(isLocalModel(config) ? { max_tokens: LOCAL_MAX_TOKENS } : {}),
    }),
    signal: AbortSignal.timeout(LOCAL_TIMEOUT_MS),
  });
}

async function openAiCompatibleStructured<Schema extends z.ZodType>(
  config: Extract<AiConfig, { provider: "openai_compatible" }>,
  { system, prompt, schema, limits }: StructuredRequest<Schema>,
): Promise<z.infer<Schema>> {
  const jsonSchema = toStrictJsonSchema(schema, isLocalModel(config) ? limits : undefined);
  const schemaFormat = { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } };
  // Fallback for servers without json_schema support: plain JSON mode with the schema in the prompt.
  const jsonModeSystem = `${system}\n\nReply with a single JSON object that matches this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}`;

  let format: Record<string, unknown> = schemaFormat;
  let messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await chatCompletion(config, messages, format);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 400 && format === schemaFormat && /response_format|json_schema|schema/i.test(body)) {
        format = { type: "json_object" };
        messages = [{ role: "system", content: jsonModeSystem }, ...messages.slice(1)];
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new Error("The AI provider rejected the API key.");
      if (res.status === 404) throw new Error(`Model "${config.model}" wasn't found on ${config.baseUrl}.`);
      throw new Error(`The AI provider responded ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (data.choices?.[0]?.finish_reason === "length" && isLocalModel(config)) {
      // Asking again with the runaway reply attached would only make the next one longer.
      throw new Error("The model kept writing without finishing its answer. Try again, or turn thinking off for this model in Settings.");
    }

    let problem: string;
    try {
      const parsed = schema.safeParse(extractJson(content));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (error) {
      problem = error instanceof Error ? error.message : "Invalid JSON";
    }

    // Small models sometimes miss a field: show them what was wrong and ask once more.
    messages = [
      ...messages,
      { role: "assistant", content },
      { role: "user", content: `That reply didn't match the required JSON schema (${problem}). Reply again with only the corrected JSON object.` },
    ];
  }
  throw new Error("The model couldn't produce valid structured output. Try a larger model.");
}

/* -------------------------------------------------------------------------- */
/* Model listing (Settings page)                                              */
/* -------------------------------------------------------------------------- */

export async function listModels(config: { provider: AiConfig["provider"]; baseUrl?: string | null; apiKey?: string | null }): Promise<string[]> {
  if (config.provider === "anthropic") {
    if (!config.apiKey) return [];
    const client = anthropic(config.apiKey);
    const ids: string[] = [];
    for await (const model of client.models.list()) ids.push(model.id);
    return ids;
  }
  if (!config.baseUrl) return [];
  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models`, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Couldn't list models (${res.status}).`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).sort();
}
