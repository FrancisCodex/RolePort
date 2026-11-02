/*
 * The copy-paste setup Settings shows for each agent, with the address and token filled in.
 * Before a token is shown (or after it's been seen) the placeholder stands in for it.
 */

export const TOKEN_PLACEHOLDER = "<your RolePort token>";

/** `usage`: where that agent's model and effort are chosen, since RolePort can't choose them. */
export type AgentSetup = { id: string; label: string; where: string; code: string; usage: string };

export function agentSetups({ url, token, bridgePath }: { url: string; token: string | null; bridgePath: string }): AgentSetup[] {
  const t = token ?? TOKEN_PLACEHOLDER;
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      where: "Run this in a terminal.",
      code: `claude mcp add --transport http roleport ${url} --header "Authorization: Bearer ${t}"`,
      usage: "Pick the model with /model, and a lower effort level where your plan offers one. Sonnet or Haiku at low or medium effort handles RolePort well.",
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
      usage: "Pick the model in the menu under the message box, and leave extended thinking off for RolePort tasks. Sonnet or Haiku handles them well.",
    },
    {
      id: "codex",
      label: "Codex",
      where: "Add this to ~/.codex/config.toml.",
      code: `[mcp_servers.roleport]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${t}" }`,
      usage: "Pick the model and its reasoning effort with /model. Low or medium reasoning effort handles RolePort well.",
    },
    {
      id: "cursor",
      label: "Cursor",
      where: "Add this to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).",
      code: JSON.stringify({ mcpServers: { roleport: { url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
      usage: "Pick the model in the chat panel. A fast or mid-size model handles RolePort well.",
    },
  ];
}
