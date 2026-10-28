# RolePort Lite: a hosted web version with no user data on the server

Status: built on the `feat/liveweb-update` branch, not deployed yet. [LITE-IMPLEMENTATION.md](LITE-IMPLEMENTATION.md) has the build plan, what each phase delivered and how it was verified, and what's still open.

## 1. Goal

A version of RolePort anyone can open in a browser, with nothing to install. It is the easy way to try RolePort; the self-hosted install stays the full edition.

The rule: **no user data on the server**. The profile, CV, saved jobs, evaluations, settings and API keys all live in the user's browser. The deployment keeps only one stateless route that forwards public job searches. No database, no accounts, no logs of user data.

| | Self-hosted (today) | Lite (hosted) |
| --- | --- | --- |
| Install | Docker or Node.js | None, open the website |
| Where data lives | `.data/pglite` or Postgres on the user's machine | Browser storage (OPFS, or IndexedDB as a fallback) |
| AI calls | From the server | From the browser, with the user's own key |
| Ollama | Server → Ollama | Browser → Ollama on the user's machine |
| JobSpy | Bundled sidecar | Optional: user runs it locally, browser connects to it |
| Job sources | Called from the server | Through a stateless proxy route |
| Accounts | None | None |
| Sync between devices | Same machine | None; export/import backup |

## 2. Data: PGlite in the browser

RolePort already runs on PGlite (`lib/db/index.ts`). PGlite also runs in the browser, so the lite version keeps the same Drizzle schema (`lib/db/schema.ts`) and the migrations in `drizzle/`. They run in the browser on first load and after each update. Data is saved to OPFS (`opfs-ahp://roleport`) where the browser supports it, and to IndexedDB (`idb://roleport`) otherwise; [LITE-IMPLEMENTATION.md §1.5](LITE-IMPLEMENTATION.md) has the measurements.

Run PGlite in a Web Worker (PGlite's `PGliteWorker`) so queries don't block the UI and several open tabs share one database.

There is one built-in user, as in the self-hosted install. `user_id` columns stay, filled with a fixed id, so rows move between lite and self-hosted without changes.

### Limits to design around

- **One browser, one device.** Nothing syncs between a phone and a laptop.
- **Users can wipe it** by clearing site data or using a private window.
- **Browsers may evict it.** Call `navigator.storage.persist()` and show the result in Settings. Safari deletes script-written storage after about 7 days without a visit unless the site is installed to the home screen, so the lite version should be an installable PWA.
- **Storage quota.** Fine for profiles and a few thousand jobs; don't keep raw source payloads longer than needed.

### Backups (required for launch)

- **Export**: one JSON file with every table, a format version and the app version. Settings → Data → Export.
- **Import**: validate with zod, then replace or merge. The same file imports into a self-hosted install, which gives users a path from lite to full.
- A gentle reminder when the last export is older than two weeks.
- Later, optional: save to a file the user picks (File System Access API, Chrome and Edge only), or sync to the user's own Google Drive or Dropbox.

## 3. API keys

Keys are stored in the browser database. They cannot be meaningfully encrypted there, because the app needs the plain key to call the provider, so say so in Settings: "Your key is stored in this browser and sent only to the provider."

Because any script on the origin could read them:

- Keep sanitizing job descriptions (`lib/jobs/html.ts`, `sanitize-html`) and never render posting HTML unsanitized.
- Set a strict Content Security Policy: scripts only from the app, `connect-src` limited to the AI providers, the proxy route, and `http://localhost:*` / `http://127.0.0.1:*` for Ollama and JobSpy.
- No third-party analytics or ad scripts.

## 4. AI providers from the browser

`lib/ai/client.ts` gets a browser implementation behind the same interface. The prompts and zod schemas (`lib/ai/evaluate-job.ts`, `lib/ai/extract-profile.ts`) are shared unchanged.

| Provider | Browser access |
| --- | --- |
| Claude | Supported with the `anthropic-dangerous-direct-browser-access: true` header (the SDK's `dangerouslyAllowBrowser`) |
| OpenAI | Generally allowed; verify before launch |
| OpenRouter | Generally allowed; verify before launch |
| Groq | Verify before launch |
| Ollama | Works once the user allows the site; see §6 |

If a provider blocks browser requests, add it to the proxy route as a pass-through that never stores or logs the key, and say so in Settings.

## 5. Job sources through a stateless proxy

freehire, Jobicy and JSearch are called from the server today (`lib/jobs/sources/`). Most job APIs don't allow requests from other websites (CORS), so the lite version keeps one route handler, for example `app/api/lite/search/route.ts`:

- Takes the same search input as `lib/jobs/search.ts`, calls the sources, normalizes and dedupes, and returns jobs. The browser saves what it wants into its own database.
- Stores nothing. No user id, no request logging beyond what the host does by default.
- Caches public results briefly (same query, a few minutes) to stay inside the sources' rate limits.
- Rate-limits by IP.
- JSearch: try calling RapidAPI from the browser first. If that's blocked, the user's RapidAPI key passes through the route and is never stored.
- JobSpy is never called from here (see §7).

## 6. Ollama on the user's machine

The browser calls `http://localhost:11434/v1` directly. To make it work, users need to:

1. Allow the site's origin in Ollama, for example `OLLAMA_ORIGINS=https://<lite domain>` (Settings shows the exact command for Windows, macOS and Linux).
2. Accept Chrome's local network access prompt when it appears.

Notes:

- `http://localhost` from an HTTPS page is allowed by Chrome and Firefox. Safari is less reliable; tell Safari users to use Chrome or the self-hosted install.
- "Test connection" should tell apart: Ollama not running, origin not allowed, permission denied, model not pulled.

## 7. JobSpy on the user's machine

JobSpy cannot run on the hosted deployment (LinkedIn and Indeed terms). Instead the user runs it, and the browser connects to it, the same way as Ollama.

- Running it: `docker run` of the existing image, or `pip install -r services/jobspy/requirements.txt` then `python services/jobspy/server.py`. Later: a one-click download.
- The service needs CORS support with an allow-list of origins (a `JOBSPY_ALLOWED_ORIGINS` setting), defaulting to none. It keeps listening on `127.0.0.1` only.
- Settings → Job sources → "Connect JobSpy on this computer", with a URL field (default `http://127.0.0.1:8765`) and Test connection.
- Results go straight from the local service to the browser and are merged with the proxy results in the browser.
- Keep the warning from the README: personal use, read the boards' terms, results may be rate-limited.

## 8. Code changes

Today the database is read in server components and server actions:

- Server actions: `app/(app)/jobs/actions.ts`, `app/(app)/profile/actions.ts`, `app/(app)/settings/actions.ts`
- Data modules: `lib/jobs/data.ts`, `lib/jobs/evaluation.ts`, `lib/profile/data.ts`, `lib/ai/config.ts`, `lib/session.ts`
- Pages that load data on the server: home, jobs, job detail, pipeline, profile, settings

### Approach

1. **One codebase, a build mode.** `NEXT_PUBLIC_ROLEPORT_MODE=lite` at build time. Not a fork.
2. **Shared data interface.** Define the operations the UI needs (get profile, save profile, list saved jobs, set status, save evaluation…) as one interface with two implementations: the current server one, and a browser one on PGlite in a worker. Business logic that doesn't touch storage (`fit.ts`, `quick-match.ts`, `job-key.ts`, `detect-skills.ts`, `profile/dates.ts`) is shared as is.
3. **Same split for AI** (server or browser client) and **for search** (server sources or proxy route + local JobSpy).
4. **Client-side loading in lite mode.** The server has no data to render, so app pages render a client shell that loads from the browser database. Keep server rendering for self-hosted; the page components take data as props so both paths reuse them.
5. **CV import in the browser.** `unpdf` runs in the browser, so PDF text extraction moves client-side in lite mode.
6. **No auth.** Neither edition has accounts (they were removed from the self-hosted install too).
7. **Secrets.** `lib/secrets.ts` is server-only and not used in lite.

## 9. Phases

1. **Spike (1–2 days).** PGlite + Drizzle migrations in a worker on IndexedDB; one page (Profile) reading and writing through the browser implementation. Confirms bundle size and first-load time.
2. **Data layer.** The shared interface, both implementations, all pages moved to it. Self-hosted must work exactly as before.
3. **Search.** The proxy route, browser-side merge and save.
4. **AI in the browser.** Provider clients, Test connection, Ollama instructions.
5. **Backups and storage.** Export/import, `storage.persist()`, PWA install, reminders.
6. **JobSpy connect.** CORS allow-list in the service, Settings UI, docs.
7. **Launch polish.** CSP, landing page "Try it in your browser" next to "Install", privacy note, README section.

## 10. Open questions

- Which providers allow browser requests today (verify before phase 4)?
- ~~Do freehire and Jobicy allow browser requests?~~ Answered in LITE-IMPLEMENTATION.md phase 3: Jobicy does, freehire doesn't, so every source goes through the route.
- Hosting: any platform with route handlers works (Vercel, Netlify, Cloudflare). Pick one with a free tier and edge caching.
- Is a lite → self-hosted migration (export, then import) enough, or do we want a "Move to my install" button?
- Bundle size: PGlite's WASM is a few MB; load it only on app pages, never on the landing page.
