#!/usr/bin/env node
// Bridges an agent that runs MCP servers as a command (Claude Desktop) to RolePort's MCP server
// at /api/mcp. Reads JSON-RPC messages from stdin, one per line, posts each one and writes the
// answers to stdout. No dependencies; needs Node.js 18 or newer.
//
//   ROLEPORT_MCP_URL=http://localhost:3000/api/mcp ROLEPORT_MCP_TOKEN=roleport_… node scripts/mcp-stdio.mjs
//
// Settings → Connect an AI agent in RolePort shows the setup with both filled in.
import { createInterface } from "node:readline";

const url = process.env.ROLEPORT_MCP_URL || "http://localhost:3000/api/mcp";
const token = process.env.ROLEPORT_MCP_TOKEN;
if (!token) {
  console.error("[roleport-mcp] Set ROLEPORT_MCP_TOKEN to the token from RolePort's Settings → Connect an AI agent.");
  process.exit(1);
}

// Only stdout carries messages; logs go to stderr.
const write = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const fail = (id, message) => id !== undefined && id !== null && write({ jsonrpc: "2.0", id, error: { code: -32000, message } });

let protocolVersion = null;

async function forward(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const id = Array.isArray(message) ? null : message.id;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        ...(protocolVersion && { "MCP-Protocol-Version": protocolVersion }),
      },
      body: line,
    });
    // Notifications and responses are acknowledged with 202 and no body.
    if (res.status === 202) return;
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return fail(id, `RolePort answered ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!res.ok && body?.error && id !== undefined) return write({ ...body, id });
    for (const reply of Array.isArray(body) ? body : [body]) {
      if (reply?.result?.protocolVersion) protocolVersion = reply.result.protocolVersion;
      write(reply);
    }
  } catch (error) {
    console.error(`[roleport-mcp] ${url}: ${error.message}`);
    fail(id, `Couldn't reach RolePort at ${url}. Is it running?`);
  }
}

const lines = createInterface({ input: process.stdin });
const pending = new Set();
lines.on("line", (line) => {
  if (!line.trim()) return;
  const task = forward(line).finally(() => pending.delete(task));
  pending.add(task);
});
lines.on("close", async () => {
  await Promise.all(pending);
  process.exit(0);
});
