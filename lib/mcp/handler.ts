import "server-only";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { aiConfigFor, rapidApiKeyFor } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { jobSpyAddress } from "@/lib/desktop/jobspy";
import { checkPosting, readJobLink } from "@/lib/jobs/paste/link";
import { searchAllSources } from "@/lib/jobs/search";
import { clientAddress, createRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { readSettings } from "@/lib/settings/queries";
import { authorizeMcp } from "./access";
import { createMcpServer } from "./server";
import type { McpContext } from "./tool";

// Agents call tools in bursts (search, then a handful of get_job): allow that, not a flood.
const take = createRateLimit({ capacity: 60, refillPerMinute: 60 });

const json = (status: number, error: string, headers: Record<string, string> = {}) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32001, message: error }, id: null }, { status, headers });

/** /api/mcp: checks the switch and token, then answers one MCP request with a fresh, stateless server. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const wait = take(clientAddress(request));
  if (wait > 0) return json(429, "Too many requests. Try again in a moment.", { "Retry-After": String(wait) });

  const db = await getDb();
  const user = await getCurrentUser();
  const row = await readSettings(db, user.id);
  const auth = authorizeMcp(request, row);
  if (!auth.ok) return json(auth.status, auth.error, auth.status === 401 ? { "WWW-Authenticate": "Bearer" } : {});

  const ctx: McpContext = {
    db,
    user,
    ai: async () => aiConfigFor(row),
    writer: row?.mcpWriter ?? "auto",
    usage: row?.mcpUsage ?? "balanced",
    search: async (params, companies) => {
      const jobspyEnabled = Boolean(row?.jobspyEnabled);
      const jobspyUrl = jobspyEnabled ? await jobSpyAddress() : null;
      return searchAllSources(params, { rapidApiKey: rapidApiKeyFor(row), jobspyEnabled, jobspyUrl, companies });
    },
    readLink: readJobLink,
    checkPosting,
  };
  const server = createMcpServer(ctx, auth.access);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // The JSON response is complete once handleRequest returns.
    void server.close();
  }
}
