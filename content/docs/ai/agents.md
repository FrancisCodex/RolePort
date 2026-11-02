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
| `import_cv` | Read your CV into your profile. It shows you the draft first, and saves only when you agree |

Agents can't delete anything, change Settings or your API keys, edit your profile by hand, or import backups. Those stay in the app.

## No API key? Your agent can do the writing

Evaluations, tailored CVs, cover letters, emails, CV import and reading a pasted job need an AI. If you don't have an API key or a computer that runs a good local model, but you pay for Claude or ChatGPT, your agent can be that AI:

1. The agent asks RolePort for the job (say, `evaluate_job`).
2. RolePort sends back a brief: its own instructions, your profile and the posting, and the exact form the answer must take.
3. The agent's model writes the answer and sends it back.
4. RolePort checks it the same way it checks its own AI's answers (only facts from your profile and CV, the right fields, scores in range, no made-up numbers) and saves it. If a check fails, it tells the agent what to fix.

What the agent wrote is labelled "Your AI agent" wherever RolePort shows which model wrote something. This uses your Claude or ChatGPT plan, not an API key.

In **Settings → Connect an AI agent**, choose who writes:

| Option | What happens |
| --- | --- |
| **RolePort's AI, else the agent** (default) | The AI set up in Settings writes. Without one, the agent does |
| **Always the agent** | The agent writes, even when RolePort has an AI set up |
| **Only RolePort's AI** | The agent never writes. Without an AI in Settings, these tools say to set one up |

## Keep usage down

RolePort can't pick your agent's model or effort level: your agent app does. These tasks are routine, so a fast or mid-size model at low or medium effort does them well, and uses much less of your plan than the largest model with long thinking.

- **Claude Code:** pick the model with `/model`, and a lower effort level where your plan offers one.
- **Claude Desktop:** pick the model in the menu under the message box, and leave extended thinking off.
- **Codex:** pick the model and its reasoning effort with `/model`.
- **Cursor:** pick the model in the chat panel.

In Settings, **When the agent writes** tells the agent how much to spend: **Keep usage low** (one pass, no extended thinking, short text), **Balanced** or **Best quality**. Each brief also says how big the task is (about how many tokens it sends) and how much effort RolePort itself would use for it. Agents usually follow this, but your agent app's model setting is what counts.

## What stays the same

- **RolePort never applies or sends email for you.** `apply_to_job` and `mark_email_sent` only record what you did. A drafted email comes back with a link that opens it in your mail app.
- **Most agents ask you first** before a tool that changes something, since RolePort marks those tools.
- **Changes are marked.** Status changes an agent makes show "(via AI agent)" in the application's history.
- **Every answer is checked.** Whether RolePort's AI or your agent writes it, it goes through the same checks as in the app before it's saved.
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
