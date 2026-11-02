/*
 * The copy-paste setup Settings shows for each agent, with the address and token filled in,
 * written for someone adding an MCP server for the first time. Before a token is shown (or
 * after it's been seen) the placeholder stands in for it.
 */

export const TOKEN_PLACEHOLDER = "<your RolePort token>";

export type AgentSetup = {
  id: string;
  label: string;
  /** What to do before the code: open the right place. */
  before: string[];
  code: string;
  /** What to do with the code, and how to see that it worked. */
  after: string[];
  /** Where that agent's model and effort are chosen, since RolePort can't choose them. */
  usage: string;
};

export function agentSetups({ url, token, bridgePath }: { url: string; token: string | null; bridgePath: string }): AgentSetup[] {
  const t = token ?? TOKEN_PLACEHOLDER;
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      before: ["Open a terminal (any folder) and run this command. It adds RolePort for every project, not just one folder."],
      code: `claude mcp add --scope user --transport http roleport ${url} --header "Authorization: Bearer ${t}"`,
      after: [
        "Start a new Claude Code session. Sessions that were already open don't see new servers.",
        "Check it: type /mcp in the session. roleport should be listed as connected.",
        'Try it: "Show my profile from RolePort."',
      ],
      usage: "Pick the model with /model, and a lower effort level where your plan offers one. Sonnet or Haiku at low or medium effort handles RolePort well.",
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      before: [
        "Check Node.js is installed: run node -v in a terminal. If it isn't found, install the LTS version from nodejs.org. Claude Desktop uses it to run a small bridge from your RolePort folder.",
        "In Claude Desktop, open Settings (Windows: the ☰ menu → File → Settings; Mac: Claude → Settings), go to Developer and press Edit Config. This opens the folder with claude_desktop_config.json. Open that file in a text editor such as Notepad or TextEdit.",
        'If the file is empty or only has {}, replace everything in it with the code below. If it already has an "mcpServers" section, copy only the "roleport": { … } part into it, with a comma after the server before it. If it has other settings, keep them and add "mcpServers" next to them, separated by a comma.',
      ],
      code: JSON.stringify(
        { mcpServers: { roleport: { command: "node", args: [bridgePath], env: { ROLEPORT_MCP_URL: url, ROLEPORT_MCP_TOKEN: t } } } },
        null,
        2,
      ),
      after: [
        "Save the file, then quit Claude Desktop completely and open it again. On Windows, closing the window isn't enough: right-click Claude in the system tray and choose Quit.",
        "Check it: in a new chat, open the tools menu (the + or sliders button under the message box). RolePort should be listed. If Claude shows an error, Settings → Developer shows what went wrong.",
        "RolePort has to be running while you use it. Custom connectors (Settings → Connectors) can't reach a RolePort on your own computer, so use this file instead.",
      ],
      usage: "Pick the model in the menu under the message box, and leave extended thinking off for RolePort tasks. Sonnet or Haiku handles them well.",
    },
    {
      id: "codex",
      label: "Codex",
      before: [
        "Open Codex's settings file in a text editor: ~/.codex/config.toml on Mac and Linux, %USERPROFILE%\\.codex\\config.toml on Windows. If the file or the .codex folder isn't there, create it. The Codex app, CLI and IDE extension all read this one file.",
        "Paste this at the end of the file, on a new line.",
      ],
      code: `[mcp_servers.roleport]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${t}" }`,
      after: [
        "Save the file and start Codex again.",
        "Check it: type /mcp in Codex. roleport should be listed. If Codex says it can't use HTTP servers, update Codex.",
      ],
      usage: "Pick the model and its reasoning effort with /model. Low or medium reasoning effort handles RolePort well.",
    },
    {
      id: "cursor",
      label: "Cursor",
      before: [
        "In Cursor, open Settings → Cursor Settings → MCP (called Tools & MCP in newer versions) and press Add new MCP server, or New MCP Server. This opens ~/.cursor/mcp.json.",
        'If the file is empty or only has {}, replace everything with the code below. If it already has an "mcpServers" section, copy only the "roleport": { … } part into it, with a comma after the server before it.',
      ],
      code: JSON.stringify({ mcpServers: { roleport: { url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
      after: ["Save the file. Back in Cursor's MCP settings, roleport should show a green dot. If it's off, switch it on."],
      usage: "Pick the model in the chat panel. A fast or mid-size model handles RolePort well.",
    },
  ];
}
