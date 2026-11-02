/*
 * The copy-paste setup Settings shows for each agent, with the address and token filled in.
 * Before a token is shown (or after it's been seen) the placeholder stands in for it.
 */

export const TOKEN_PLACEHOLDER = "<your RolePort token>";

export type AgentSetup = { id: string; label: string; where: string; code: string };

export function agentSetups({ url, token, bridgePath }: { url: string; token: string | null; bridgePath: string }): AgentSetup[] {
  const t = token ?? TOKEN_PLACEHOLDER;
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      where: "Run this in a terminal.",
      code: `claude mcp add --transport http roleport ${url} --header "Authorization: Bearer ${t}"`,
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      where:
        "Settings → Developer → Edit Config, add this to claude_desktop_config.json, then restart Claude. It runs a small bridge from your RolePort folder, so Node.js needs to be installed.",
      code: JSON.stringify(
        { mcpServers: { roleport: { command: "node", args: [bridgePath], env: { ROLEPORT_MCP_URL: url, ROLEPORT_MCP_TOKEN: t } } } },
        null,
        2,
      ),
    },
    {
      id: "codex",
      label: "Codex",
      where: "Add this to ~/.codex/config.toml.",
      code: `[mcp_servers.roleport]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${t}" }`,
    },
    {
      id: "cursor",
      label: "Cursor",
      where: "Add this to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).",
      code: JSON.stringify({ mcpServers: { roleport: { url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
    },
  ];
}
