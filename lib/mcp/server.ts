import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { aiErrorMessage } from "@/lib/ai/errors";
import { AiUnavailableError } from "@/lib/ai/structured";
import { APP_VERSION } from "@/lib/backup/format";
import type { McpAccess } from "./access";
import { AI_NOT_SET_UP } from "./errors";
import { MCP_TOOLS } from "./registry";
import { POSTING_NOTE, ToolError, type McpContext, type McpTool } from "./tool";

const INSTRUCTIONS = [
  "RolePort is the user's own job-search app: their profile, job searches, saved jobs and applications.",
  "It never applies to jobs or sends email: apply_to_job and mark_email_sent only record what the user did.",
  "Evaluations, tailored CVs, letters and emails are written by the AI set up in RolePort, which can take a minute or more on local models.",
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
      async (args: unknown) => {
        try {
          return text(await t.run(args as never, ctx));
        } catch (error) {
          if (error instanceof ToolError) return text(error.message, true);
          if (error instanceof AiUnavailableError) return text(AI_NOT_SET_UP, true);
          console.error(`[mcp] ${t.name} failed`, error);
          return text(aiErrorMessage(error, "That didn't work. Please try again."), true);
        }
      },
    );
  }
  return server;
}
