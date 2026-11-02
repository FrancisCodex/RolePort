---
title: Connect an AI agent
description: Use RolePort from Claude, Codex, Cursor or another AI agent through its MCP server. Self-hosted only.
updated: 2026-11-02
---

If you already use an AI agent such as Claude Desktop, Claude Code, Codex or Cursor, you can let it use RolePort for you: "find data analyst jobs in Cebu posted this week, evaluate the best five and save the good ones". The agent talks to RolePort through the Model Context Protocol (MCP), the standard way agents connect to apps.

This works on a **self-hosted** install only. RolePort Lite keeps your data in your browser, so there's no server for an agent to reach.

## Turn it on

1. Go to **Settings → Connect an AI agent**.
2. Choose what agents may do: **Read and change** (the default) or **Read only**.
3. Press **Turn on**. RolePort makes a token and shows it once.
4. Pick your agent and copy its setup. The address and token are already filled in.

Keep the token private: anyone with it can use RolePort as you. If you lose it, press **New token** and update your agent. **Turn off** stops every agent at once and forgets the token.

## Set up your agent

Settings shows each of these with your address and token filled in.

- **Claude Code:** one command, `claude mcp add --transport http roleport …`.
- **Claude Desktop:** add RolePort to `claude_desktop_config.json` (Settings → Developer → Edit Config) and restart Claude. Claude Desktop runs a small bridge, `scripts/mcp-stdio.mjs` in your RolePort folder, so Node.js needs to be installed on the same computer. If RolePort runs in Docker, point the setup at the script in your copy of the repository, not inside the container.
- **Codex:** a few lines in `~/.codex/config.toml`.
- **Cursor:** a few lines in `~/.cursor/mcp.json`.

Other agents that support MCP over HTTP work too: give them the address (`http://localhost:3000/api/mcp` on a default install) and the header `Authorization: Bearer <token>`.

RolePort needs to be running while you use the agent.

## What an agent can do

**Read:**

| Tool | What it does |
| --- | --- |
| `get_profile` | Reads your profile. Contact details only when asked for |
| `search_jobs` | The same search as the Jobs page, with quick match scores |
| `get_job` | One job, its fit evaluation and whether it's still open |
| `list_applications`, `get_application` | Your tracker, and one application's history, contacts, emails and documents |
| `follow_ups_due` | What Home shows under Follow up |
| `list_followed_companies` | The companies you follow |

**Change** (not available in Read only):

| Tool | What it does |
| --- | --- |
| `save_job`, `unsave_job` | Save a job, or take a saved one off your list |
| `add_job` | Paste a job from a link or text |
| `check_job_open` | Check again whether a job is still open |
| `evaluate_job` | Run the AI fit evaluation |
| `apply_to_job` | Move a job to Applied in your tracker |
| `set_status`, `set_notes`, `set_interview_date` | Update an application |
| `tailor_cv`, `draft_cover_letter` | Write the tailored CV and cover letter, saved on the application |
| `draft_email`, `mark_email_sent` | Draft an email or follow-up, and mark it sent once you've sent it |

Agents can't delete anything, change Settings or your API keys, edit your profile, or import backups. Those stay in the app.

## What stays the same

- **RolePort never applies or sends email for you.** `apply_to_job` and `mark_email_sent` only record what you did. A drafted email comes back with a link that opens it in your mail app.
- **Most agents ask you first** before a tool that changes something, since RolePort marks those tools.
- **Changes are marked.** Status changes an agent makes show "(via AI agent)" in the application's history.
- **The writing uses your AI.** Evaluations, CVs, letters and emails are written by the provider you set up in [Settings → AI provider](/docs/ai/providers), with the same checks as in the app. Without one, those tools say to set it up first. The agent's own model only decides which tools to call.
- **Postings are treated as data.** Job text goes to the agent labelled as the employer's words, not instructions.

## Example requests

- "What's on my plate this week in RolePort?"
- "Search RolePort for remote React jobs in the Philippines from the past week, and evaluate the five with the best quick match."
- "Add this job to RolePort: https://boards.greenhouse.io/…"
- "I applied to the Acme job. Mark it applied, tailor my CV for it and draft the application email."
- "Which applications need a follow-up? Draft the first one."

## If it doesn't connect

- **"The MCP server is off":** turn it on in Settings.
- **"Missing token" or "Wrong token":** copy the setup again, or make a new token and update your agent.
- **The agent can't reach the address:** check RolePort is running, and that the address in the setup is one the agent's computer can reach. In Docker, the default `localhost:3000` works from the same computer.
- **A tool that writes isn't listed:** Settings is on **Read only**.
