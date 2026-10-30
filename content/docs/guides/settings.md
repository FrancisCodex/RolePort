---
title: Settings
description: Every card in Settings, what it does and where to read more.
updated: 2026-10-31
---

| Card | What it does | Read more |
| --- | --- | --- |
| AI provider | Choose your provider, key and model, and test the connection | [AI providers](/docs/ai/providers) |
| CV reading prompt | How the AI reads your CV into your profile | [Customizing the prompts](/docs/ai/prompts) |
| CV tailoring prompt | How the AI tailors your CV | [Customizing the prompts](/docs/ai/prompts) |
| Cover letter prompt | How the AI writes letters | [Customizing the prompts](/docs/ai/prompts) |
| Application questions prompt | How the AI answers form questions | [Customizing the prompts](/docs/ai/prompts) |
| Email prompt | How the AI writes each kind of email | [Customizing the prompts](/docs/ai/prompts) |
| Follow-up reminders | When follow-ups come due | [Emails and follow-ups](/docs/guides/emails#follow-up-reminders) |
| Mock interviewer prompt | When the interviewer presses and moves on | [Customizing the prompts](/docs/ai/prompts) |
| Job sources | Your JSearch key and JobSpy | [Job sources](/docs/job-sources) |
| Companies you follow | Add and remove companies | [Companies you follow](/docs/guides/companies) |
| Voice | Microphone, speech-to-text and the interviewer's voice | [Answering out loud](/docs/guides/voice) |
| Your data | Backups, restoring, and how your data is stored | [Privacy and your data](/docs/privacy-and-data) |

## Self-hosted settings

A self-hosted install also reads a few optional settings from `.env.local`, or from your Docker environment.

| Setting | What it does |
| --- | --- |
| `DATABASE_URL` | Use a Postgres server instead of the built-in database. Run `npm run db:migrate` after setting it |
| `ROLEPORT_SECRET` | Encrypts saved API keys. If unset, a random key is created in `.data/secret.key`. Keep it stable, as changing it makes saved keys unreadable |
| `ANTHROPIC_API_KEY` | A fallback Claude key |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_REASONING_EFFORT` | A fallback OpenAI-compatible provider |
| `RAPIDAPI_KEY` | A fallback JSearch key |
| `JOBSPY_URL` | Where the JobSpy service runs, such as `http://127.0.0.1:8765` |
| `NEXT_PUBLIC_ROLEPORT_ONBOARDING` | Set to `on` to start new users on the setup guide |

The provider you choose in Settings comes first. These are fallbacks, and Settings shows "from environment variables" when one is in use.
