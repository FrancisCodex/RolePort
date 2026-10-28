# Contributing to RolePort

Thanks for helping! RolePort is a free, self-hosted job search app. Users bring their own AI provider and API keys, and their data stays on their own machine.

## Getting set up

```bash
npm install
cp .env.example .env.local
npm run dev
```

No keys or database server are needed. It uses an embedded database in `.data/pglite`. To try the AI features for free, install [Ollama](https://ollama.com), pull a model (`ollama pull gemma4:12b`), and pick **Ollama** in Settings.

Before opening a pull request:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Project layout

| Path | What lives there |
| --- | --- |
| `app/(marketing)` | Landing page |
| `app/(app)` | The app: home, jobs, pipeline, profile, settings. Server actions sit next to each page in `actions.ts`. |
| `lib/jobs` | Job sources, dedup, quick match, job storage |
| `lib/ai` | Provider config, `generateStructured()`, prompts |
| `lib/db` | Drizzle schema and the PGlite/Postgres switch |
| `lib/session.ts` | The only place that resolves the current user (one built-in user, no sign-in) |
| `components/ui` | Design system primitives (use the color tokens in `app/globals.css`, never raw hex) |

## Ground rules

- **Never hard-code a provider.** All AI calls go through `generateStructured()` in `lib/ai/client.ts` so they work with Claude, OpenAI-compatible APIs and local models. Test prompts on a small local model too.
- **Treat job postings and CVs as untrusted input.** Prompts must say the text is data, not instructions. Sanitize HTML with `lib/jobs/html.ts`.
- **Never invent candidate experience.** Generated CVs and letters may only use facts from the user's profile.
- **Respect job source terms.** Credit the source, link to the original posting, and don't scrape sites whose terms forbid it.
- **Secrets stay server-side.** Encrypt stored keys with `lib/secrets.ts` and never return them to the client.
- **Schema changes:** edit `lib/db/schema.ts`, then run `npx drizzle-kit generate --name <change>` and commit the new file in `drizzle/`.

## Adding a job source

See [docs/ADDING_A_JOB_SOURCE.md](docs/ADDING_A_JOB_SOURCE.md). Sources for other countries are very welcome.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
