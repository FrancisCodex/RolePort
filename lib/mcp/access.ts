import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Who may call the MCP server (/api/mcp). RolePort has no sign-in and Docker publishes its port
 * on every interface, so the server is off until the user turns it on in Settings, and then
 * every request needs the token shown there. Only its hash is stored.
 */

export type McpAccess = "read" | "write";

const TOKEN_PREFIX = "roleport_";

/** A new token, shown to the user once. */
export function newMcpToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("base64url");
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/**
 * Browsers send an Origin header; agents don't. A web page the user has open must not be able to
 * call the server through their browser, so an Origin is only accepted from RolePort itself.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type McpAuth = { ok: true; access: McpAccess } | { ok: false; status: number; error: string };

/** Checks one request against the saved switch and token hash. */
export function authorizeMcp(request: Request, settings: { mcpAccess: McpAccess | null; mcpTokenHash: string | null } | null): McpAuth {
  if (!originAllowed(request)) return { ok: false, status: 403, error: "Requests from web pages aren't accepted." };
  if (!settings?.mcpAccess || !settings.mcpTokenHash) {
    return { ok: false, status: 404, error: "The MCP server is off. Turn it on in RolePort's Settings → Connect an AI agent." };
  }
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Missing token. Copy the setup from RolePort's Settings → Connect an AI agent." };
  const given = Buffer.from(hashMcpToken(token), "hex");
  const saved = Buffer.from(settings.mcpTokenHash, "hex");
  if (given.length !== saved.length || !timingSafeEqual(given, saved)) {
    return { ok: false, status: 401, error: "Wrong token. It may have been regenerated in Settings." };
  }
  return { ok: true, access: settings.mcpAccess };
}
