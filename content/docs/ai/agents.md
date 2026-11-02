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

Never added an MCP server before? It's a one-time step: you tell your agent app where RolePort is and give it the token. Settings shows the code for each agent with your address and token already filled in, so you only copy and paste it. The steps below say where.

RolePort needs to be running whenever you use it from an agent.

### Claude Code

1. Copy the **Claude Code** command from Settings and run it in a terminal, from any folder. `--scope user` in it adds RolePort for all your projects.
2. Start a new Claude Code session. Sessions that were already open don't see new servers.
3. Type `/mcp`. **roleport** should be listed as connected.

To remove it later: `claude mcp remove roleport --scope user`.

### Claude Desktop

Claude Desktop starts MCP servers as programs on your computer, so it uses a small bridge in your RolePort folder (`scripts/mcp-stdio.mjs`) that needs Node.js.

1. **Check Node.js is installed:** run `node -v` in a terminal. If it isn't found, install the LTS version from [nodejs.org](https://nodejs.org).
2. **Open the config file:** in Claude Desktop, open **Settings** (Windows: the ☰ menu → File → Settings; Mac: Claude → Settings), go to **Developer** and press **Edit Config**. This opens the folder with `claude_desktop_config.json`. Open that file in a text editor such as Notepad or TextEdit.
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. **Paste the code from Settings:**
   - If the file is empty or only has `{}`, replace everything with it.
   - If it already has an `"mcpServers"` section, add only the `"roleport": { … }` part inside it (see the example below).
   - If it has other settings but no `"mcpServers"`, keep them and add `"mcpServers": { … }` next to them, separated by a comma.
4. **Save the file, then quit Claude Desktop completely and open it again.** On Windows, closing the window isn't enough: right-click Claude in the system tray (by the clock) and choose **Quit**.
5. **Check it:** in a new chat, open the tools menu (the **+** or sliders button under the message box). RolePort should be listed. If Claude shows an error, **Settings → Developer** shows what went wrong.

Adding RolePort next to a server you already have looks like this. Note the comma after the first server:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/you/Documents"]
    },
    "roleport": {
      "command": "node",
      "args": ["C:/path/to/RolePort/scripts/mcp-stdio.mjs"],
      "env": {
        "ROLEPORT_MCP_URL": "http://localhost:3000/api/mcp",
        "ROLEPORT_MCP_TOKEN": "<your RolePort token>"
      }
    }
  }
}
```

Use the code from Settings rather than this example: it has your real folder, address and token.

Custom connectors (**Settings → Connectors → Add custom connector**) connect from Anthropic's servers, so they can't reach a RolePort running on your own computer. Use the config file instead. If RolePort runs in Docker, point the bridge at `scripts/mcp-stdio.mjs` in your copy of the repository, not inside the container.

### Codex

1. **Open Codex's config file** in a text editor:
   - Mac and Linux: `~/.codex/config.toml`
   - Windows: `%USERPROFILE%\.codex\config.toml`

   If the `.codex` folder or the file isn't there, create them. The Codex app, CLI and IDE extension all read this one file.
2. **Paste the code from Settings at the end of the file**, on a new line. Don't put it inside another `[section]`.
3. **Save the file and start Codex again.**
4. **Check it:** type `/mcp` in Codex. **roleport** should be listed. If Codex says it can't use HTTP servers, update Codex.

### Cursor

1. Open **Settings → Cursor Settings → MCP** (called **Tools & MCP** in newer versions) and press **Add new MCP server** or **New MCP Server**. This opens `~/.cursor/mcp.json`.
2. Paste the code from Settings. Merge it the same way as for Claude Desktop if the file already lists servers.
3. Save. Back in Cursor's MCP settings, **roleport** should show a green dot. If it's off, switch it on.

### Other agents

Any agent that supports MCP over HTTP works: give it the address (`http://localhost:3000/api/mcp` on a default install) and the header `Authorization: Bearer <token>`.

## What an agent can do

**Read:**

| Tool | What it does |
| --- | --- |
| `get_profile` | Reads your profile. Contact details only when asked for |
| `search_jobs` | The same search as the Jobs page, with quick match scores |
| `get_job` | One job, its fit evaluation and whether it's still open |
| `list_evaluated_jobs` | Every job you've had evaluated, by fit, to look back on without searching again |
| `list_applications`, `get_application` | Your tracker, and one application's history, contacts, emails and documents |
| `follow_ups_due` | What Home shows under Follow up |
| `list_followed_companies` | The companies you follow |
| `list_mock_interviews`, `get_mock_interview` | Your mock interviews, and one interview's transcript, the question waiting for you and its report |

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
| `start_mock_interview`, `answer_interview`, `skip_interview_question`, `end_interview` | Run a mock interview in the chat (see below) |
| `get_interview_report` | Grade a finished interview |

Agents can't delete anything, change Settings or your API keys, edit your profile by hand, or import backups. Those stay in the app.

## Ready-made prompts

RolePort also offers ready-made requests, so you can pick one instead of working out what to ask. In **Claude Code** they're slash commands: type `/` and look for `mcp__roleport__…`, such as `/mcp__roleport__mock_interview`. In **Claude Desktop**, they're in the **+** menu under the message box, under RolePort. Other agents show them if they support MCP prompts.

| Prompt | What it does |
| --- | --- |
| **Find and evaluate jobs** | Searches for your roles (or one you give), evaluates the three best matches and asks before saving any |
| **Mock interview** | Runs an Interview Coach interview in the chat, for an application or a role, then grades it |
| **Prepare an application** | Tailors your CV, writes the cover letter and drafts the application email for one job |
| **Follow-ups due** | Lists what's due and drafts each one |
| **Import my CV** | Reads your CV into your profile, showing you the draft first |
| **Look back at evaluated jobs** | Goes through jobs you've evaluated and suggests which to apply to first |
| **My job search this week** | Where your applications stand and the next things to do |

Each one asks for a detail or two, like the role or the application, and every detail is optional. In **Read only**, only the last two are offered.

### Copy-paste requests in the app

If the MCP server is on and RolePort has no AI of its own, the screens that need AI show an **Or ask your AI agent** box with a request ready to copy. It's already filled in with that job, application or interview, so the agent goes straight to the right one. Paste it into Claude, ChatGPT or another connected agent.

| Where | What the request does |
| --- | --- |
| Jobs search results | Evaluates the 5 best matches that aren't evaluated yet |
| A job's page | Evaluates that job |
| An application | Tailors the CV, writes the letter and drafts the application email |
| Tailored CV, Cover letter, Emails | Writes that one document or message |
| Coach → New interview | Runs the interview you set up, in the chat |
| An interview that stopped, or a report waiting to be graded | Carries on from where it stopped, or grades it |
| Profile → Import CV | Reads your CV into your profile, showing you the draft first |
| Home | Finds jobs for your roles and evaluates the best matches |

What the agent writes is saved in RolePort, so reload the page to see it. The boxes also show when Settings says the agent always writes. They don't show in Lite or in Read only.

## Mock interviews in the chat

The agent can run an [Interview Coach](/docs/guides/interview-coach) interview with you in the chat. RolePort is still the interviewer: it plans the questions from the application's posting and what you sent, decides when to follow up, and grades your answers with the Coach's rubric. The agent only asks you RolePort's questions and passes your answers back, word for word.

1. Pick **Mock interview** from the prompts, or ask: "Run a quick mock interview for my Acme application."
2. Answer each question in the chat. Say **skip** to skip a question or **stop** to end early.
3. At the end, the agent grades it and tells you the verdict, your best and weakest answers and what to work on.

The interview is saved like one you ran in the app, so it shows on the **Coach** page with its full report and counts toward your progress there. Voice answers stay in the app.

**About usage:** if your agent does the AI writing, an interview takes more of your plan than an evaluation. It plans the questions, decides after each answer whether to follow up, then grades each answer and writes a summary. To save usage, the agent grades without the extra coaching steps (checking each answer against your CV and letter, and writing a stronger version) unless you ask for them before it grades. The report is then final, so ask for coaching up front if you want it.

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
- "Run a tough mock interview for my Acme application."

## If it doesn't connect

- **"The MCP server is off":** turn it on in Settings.
- **"Missing token" or "Wrong token":** copy the setup again, or make a new token and update your agent.
- **The agent can't reach the address:** check RolePort is running, and that the address in the setup is one the agent's computer can reach. In Docker, the default `localhost:3000` works from the same computer.
- **A tool that writes isn't listed:** Settings is on **Read only**.
- **Claude Desktop doesn't list RolePort, or says the config is invalid:** the file usually has a JSON mistake, such as a missing comma between servers or an extra one after the last. Paste it into any JSON checker to find the line. Make sure you quit Claude fully before reopening it.
- **Claude Desktop says `node` isn't found:** install Node.js, then quit and reopen Claude. If it's installed but still not found, put the full path in `"command"`, such as `"C:/Program Files/nodejs/node.exe"`.
- **Claude Desktop says "Couldn't reach RolePort":** RolePort isn't running, or the address in `ROLEPORT_MCP_URL` is wrong.
- **Codex doesn't list it:** check the lines are at the end of `config.toml` and not under another `[section]`, then restart Codex.
