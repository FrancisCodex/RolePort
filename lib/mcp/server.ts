import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { aiErrorMessage } from "@/lib/ai/errors";
import { AgentAnswerError, AgentBrief, AiUnavailableError } from "@/lib/ai/structured";
import { APP_VERSION } from "@/lib/backup/format";
import type { McpAccess } from "./access";
import { agentBrief } from "./brief";
import { AI_NOT_SET_UP } from "./errors";
import { MCP_PROMPTS, promptArgs, type McpPrompt } from "./prompts";
import { MCP_TOOLS } from "./registry";
import { POSTING_NOTE, ToolError, type McpContext, type McpTool } from "./tool";

const INSTRUCTIONS = [
  "RolePort is the user's own job-search app: their profile, job searches, saved jobs and applications.",
  "It never applies to jobs or sends email: apply_to_job and mark_email_sent only record what the user did.",
  "Evaluations, tailored CVs, letters, emails and CV imports are written by the AI set up in RolePort when it has one. Otherwise the tool returns a brief (status your_turn): you write the answer yourself and call the same tool again with it, and RolePort checks and saves it.",
  "These are routine writing tasks: they don't need the largest model or long reasoning, and each brief says how much effort is enough.",
  "In a mock interview (start_mock_interview), RolePort is the interviewer: ask its questions exactly as written and pass the user's replies back word for word, without coaching until the report.",
  POSTING_NOTE,
].join(" ");

/** The tools this access level allows. */
export function toolsFor(access: McpAccess): McpTool[] {
  return access === "write" ? MCP_TOOLS : MCP_TOOLS.filter((t) => !t.writes);
}

function text(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }], ...(isError && { isError }) };
}

/** One server per request (the transport is stateless), with the tools `access` allows. */
export function createMcpServer(ctx: McpContext, access: McpAccess): McpServer {
  const server = new McpServer({ name: "roleport", title: "RolePort", version: APP_VERSION }, { instructions: INSTRUCTIONS });
  for (const t of toolsFor(access)) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: { readOnlyHint: !t.writes, destructiveHint: false, openWorldHint: Boolean(t.external) },
      },
      async (args: Record<string, unknown>) => {
        try {
          return text(await t.run(args as never, ctx));
        } catch (error) {
          // The agent's turn to write: not an error, a brief for it to answer.
          if (error instanceof AgentBrief) return text(agentBrief(t.name, args, error.request, ctx.usage));
          if (error instanceof ToolError || error instanceof AgentAnswerError) return text(error.message, true);
          if (error instanceof AiUnavailableError) return text(AI_NOT_SET_UP, true);
          console.error(`[mcp] ${t.name} failed`, error);
          return text(aiErrorMessage(error, "That didn't work. Please try again."), true);
        }
      },
    );
  }
  for (const p of promptsFor(access)) {
    server.registerPrompt(p.name, { title: p.title, description: p.description, argsSchema: promptArgs(p) }, (args: Record<string, string | undefined>) => ({
      messages: [{ role: "user", content: { type: "text", text: p.text(args) } }],
    }));
  }
  return server;
}

/** The ready-made prompts this access level allows. */
export function promptsFor(access: McpAccess): McpPrompt[] {
  return access === "write" ? MCP_PROMPTS : MCP_PROMPTS.filter((p) => !p.writes);
}
