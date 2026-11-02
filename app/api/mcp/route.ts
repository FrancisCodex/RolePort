import { handleMcpRequest } from "@/lib/mcp/handler";
import { isLite } from "@/lib/mode";

/*
 * The MCP server (docs: "Connect an AI agent"): lets an AI agent the user runs (Claude Desktop,
 * Claude Code, Codex…) use RolePort's tools. Off until turned on in Settings, and every request
 * needs the token shown there. Self-hosted only: the lite edition's data lives in the browser.
 */

async function handle(request: Request) {
  if (isLite) return new Response(null, { status: 404 });
  return handleMcpRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
