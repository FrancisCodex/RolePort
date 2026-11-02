import { z } from "zod";
import type { AgentRequest } from "@/lib/ai/structured";
import type { McpContext } from "./tool";

/*
 * When the agent writes (no AI set up in RolePort, or Settings says so), an AI tool returns a
 * brief instead of a result: exactly what RolePort would have sent its own AI, the shape the
 * answer must have, and how much it's likely to cost. The agent answers by calling the same
 * tool again with `answer`; RolePort then checks that answer like its own AI's and saves it.
 *
 * RolePort can't choose the agent's model or effort (the agent app does), so the brief says
 * what's enough for the task and what the user asked for in Settings.
 */

const MODEL_ENOUGH: Record<AgentRequest["effort"], string> = {
  low: "a fast model does this well (for example Claude Haiku or Sonnet, or a GPT mini model)",
  medium: "a mid-size model is enough (for example Claude Sonnet or a standard GPT model); the largest models aren't needed",
  high: "a strong model helps here, but a mid-size one still works",
};

const USAGE_ASK: Record<McpContext["usage"], string> = {
  low: "The user asked RolePort to keep usage low: answer in one pass without extended thinking, and keep every text field as short as the instructions allow.",
  balanced: "Answer in one pass; a short think is fine, long reasoning isn't needed.",
  best: "The user asked for the best quality: take the time you need.",
};

/** Rough token count for a size estimate (about four characters per token in English). */
const tokens = (chars: number) => Math.round(chars / 4 / 100) * 100;

export function agentBrief(tool: string, args: Record<string, unknown>, { system, prompt, schema, effort }: AgentRequest, usage: McpContext["usage"]) {
  const answerSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  const inputChars = system.length + prompt.length + JSON.stringify(answerSchema).length;
  return {
    status: "your_turn",
    about:
      "RolePort has no AI of its own for this (or the user chose you), so you write it. Follow instructions, use only the facts in input, and reply with one JSON object matching answerSchema.",
    instructions: system,
    input: prompt,
    answerSchema,
    next: `Call ${tool} again with the same arguments (${Object.keys(args).join(", ") || "none"}) plus answer: your JSON object. RolePort checks it the same way it checks its own AI's answers, saves it, and tells you what to fix if a check fails.`,
    usage: {
      approxInputTokens: tokens(inputChars),
      effort,
      modelHint: `RolePort asks its own AI for ${effort} effort here: ${MODEL_ENOUGH[effort]}.`,
      userPreference: USAGE_ASK[usage],
      note: "Your agent app chooses the model, not RolePort. If the user is on a large model and watching usage, tell them they can switch (RolePort's docs: Connect an AI agent → Keep usage down).",
    },
  };
}
