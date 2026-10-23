# HireMe Lite: implementation plan

Companion to [LITE.md](LITE.md), which says *what* and *why*. This file says *how*, file by file, in the order to build it.

## Progress

Branch: `feat/liveweb-update`. Update this table as phases land.

| Phase | Status | Notes |
| --- | --- | --- |
| [1. Spike](#phase-1-spike-pglite-in-a-worker-profile-page) | ✅ Done (`c23b821`) | Lite build mode, browser database (OPFS, IndexedDB fallback), starter database, Profile in lite. Results in §1.5. |
| [2. Data layer](#phase-2-data-layer-all-pages-both-modes) | ✅ Done (not committed yet) | Every page loads in both modes; Jobs search and AI are placeholders in lite until phases 3 and 4. See the Phase 2 checklist. |
| [3. Search](#phase-3-search-proxy-route--browser-merge) | ⏳ Not started | |
| [4. AI in the browser](#phase-4-ai-in-the-browser) | ⏳ Not started | |
| [5. Backups and storage](#phase-5-backups-and-storage) | ⏳ Not started | |
| [6. JobSpy connect](#phase-6-jobspy-on-the-users-machine) | ⏳ Not started | |
| [7. Launch polish](#phase-7-launch-polish) | ⏳ Not started | |

Open items carried from earlier phases: Safari and Firefox testing (§1.5 finding 3); Brotli and long-lived caching for the PGlite files and the starter database (phase 7).

Ground rules for every phase:

- **One codebase.** `NEXT_PUBLIC_HIREME_MODE=lite` at build time switches the build. No fork, no long-lived branch.
- **Self-hosted keeps working exactly as today** after every phase. Each phase ends with a self-hosted smoke test (profile save, search, save job, pipeline drag, evaluate) on a dev server on a spare port.
- **The lite server never touches a database.** Enforced in code (see 2.1), not just by convention.
- Each phase is one PR.

---

## 0. Decisions this plan makes

| Question | Decision | Why |
| --- | --- | --- |
| How do pages switch between server and browser data? | Each data page becomes **loader + view**. The view is a client component that takes data as props. `page.tsx` picks the server loader or the lite loader with a build-time constant. | Views stay shared; only the loading differs. Dead-code elimination drops the unused branch from the client bundle. |
| How do client components call mutations? | Through one module, `lib/client/mutations.ts`, that exports server actions in self-hosted builds and browser functions in lite builds. Components stop importing `actions.ts` directly. | One import site per mutation, no prop drilling, no context needed. |
| How does lite replace `refresh()`? | A tiny invalidation bus: mutations call `invalidate(tables)`, lite loaders re-run their query. A `BroadcastChannel` repeats it to other tabs. | `refresh()` re-renders server components; lite has none. Live queries are an option later; the bus is enough and easy to debug. |
| How do migrations reach the browser? | A script bundles `drizzle/*.sql` into `lib/db/migrations.generated.ts` (Drizzle's `readMigrationFiles` output as JSON). The browser calls the same `dialect.migrate()` that `drizzle-orm/pglite/migrator` calls. | Drizzle's browser-less migrator reads the filesystem; this is the same data without `fs`. |
| Where do API keys live in lite? | Same `user_settings` columns, stored as `plain.<key>`. Server `decryptSecret` already returns null for anything not `v1.`. Export leaves keys out unless the user ticks "include keys". | No schema change; a lite backup imported into self-hosted never carries a key the server can't read. |
| Which renderer for lite pages? | Static client shells (prerendered). The only dynamic route is `/api/lite/search`. | Cheap to host, fast first paint, nothing user-specific on the server. |
| CSP | `connect-src` allow-list is required at launch. Script nonces are decided in phase 7 (see 7.1). | `connect-src` is what stops key exfiltration; nonces force dynamic rendering. |

---

## Phase 1: Spike (PGlite in a worker, Profile page)

Goal: prove the hard parts before restructuring anything. Throwaway-friendly, but written so it can stay.

### 1.1 Mode flag

- `lib/mode.ts` (new, importable anywhere, no `server-only`):
  ```ts
  export const isLite = process.env.NEXT_PUBLIC_HIREME_MODE === "lite";
  ```
- `scripts/lite.mjs` sets the flag and runs `next` on any OS (no `cross-env` dependency). `package.json`: `dev:lite` (port 3100), `build:lite`, `start:lite`.
- `next.config.ts`: `distDir` is `.next-lite` in lite mode. Next 16 refuses a second `next dev` in the same folder, so without this the two modes can't run side by side. It also keeps their build caches apart.

### 1.2 Migrations bundle

- `scripts/bundle-migrations.mjs` (new): `readMigrationFiles({ migrationsFolder: "drizzle" })` → write `lib/db/migrations.generated.ts` exporting the array (`sql[]`, `hash`, `folderMillis`, `bps`).
- `package.json`: run it after `db:generate` (`"db:generate": "drizzle-kit generate && node scripts/bundle-migrations.mjs"`), and add a `db:check-bundle` script that fails if the generated file is stale. Commit the generated file.

### 1.3 Browser database

- `lib/db/browser/worker.ts` (new): the worker entry.
  ```ts
  import { PGlite } from "@electric-sql/pglite";
  import { worker } from "@electric-sql/pglite/worker";
  // OPFS where available, IndexedDB otherwise; durable writes. See 1.5.
  worker({ init: async () => new PGlite(hasOpfs ? "opfs-ahp://hireme" : "idb://hireme") });
  ```
- `lib/db/browser/index.ts` (new, `"use client"` consumers only):
  - `getBrowserDb()`: lazily creates `new PGliteWorker(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }))`, wraps it with `drizzle(pg, { schema })` from `drizzle-orm/pglite` (cast: `PGliteWorker` implements the PGlite interface), runs `db.dialect.migrate(migrations, db.session, {})`, inserts the built-in user `{ id: "local-user", ... }` with `onConflictDoNothing`, and caches the promise.
  - Every import of this module is a dynamic `import()` so PGlite never lands in the landing-page bundle.

### 1.4 Profile page through the browser

- Split `app/(app)/profile/page.tsx` into the server loader (today's `Editor`) and a lite loader `profile/lite-profile.tsx` (client) that reads with the same Drizzle query `getMyProfile` uses and renders `<ProfileEditor>`.
- Lite `saveProfile`: same zod validation + same upsert, against the browser db.

### 1.5 What the spike must answer

Results from the spike (2026-10-23, Next 16.4.2, PGlite 0.5, Chromium):

- [x] Turbopack bundles `new Worker(new URL("./worker.ts", import.meta.url))` and PGlite's `.wasm` / `.data` assets, in dev and in `next build`. No `public/` fallback needed.
- [x] Drizzle's PGlite driver works over `PGliteWorker` with a cast: select, update, `onConflictDoUpdate`, jsonb arrays, enums. Migrations go through `db.dialect.migrate()` (an internal API, also behind a cast; re-check on Drizzle upgrades).
- [x] Migrations 0000–0004 apply on a fresh database; later loads skip them.
- [x] Two tabs share the database: the second tab reads what the first saved, with no lock errors.
- [x] Landing page and `/profile` initial JS contain no PGlite. Lite `/profile` prerenders as fully static (○).
- [x] Self-hosted Profile, Home, Jobs, Pipeline and Settings unchanged (refactor of `lib/profile/data.ts` and the profile actions onto shared `lib/profile/queries.ts`).

Numbers (production build, gzip):

| What | Size | Loaded |
| --- | --- | --- |
| Browser db chunk (Drizzle, migrations, worker client) | 59 KB | on first data page, main thread |
| PGlite JS in the worker | ~330 KB | in the worker |
| PGlite WASM + data (`pglite.wasm`, `pglite.data`, `initdb.wasm`) | 5.7 MB (17 MB raw) | in the worker, then HTTP-cached |

#### Storage backend: OPFS vs IndexedDB

Measured with timing marks inside `getBrowserDb()` (production build, durable writes, Chromium, localhost so downloads are near-instant; one tab unless noted). "Ready" is navigation start until the database has opened, migrated and answered a first query. Cold = no stored database.

| | IndexedDB (`idb://`) | OPFS (`opfs-ahp://`) |
| --- | --- | --- |
| Cold: ready | 24.8 s (migrations 23.6 s) | **10.5 s** (migrations 10.2 s) |
| Warm: ready, 3 loads | 3.9 / 3.8 / 3.7 s | **2.1 / 1.8 / 1.9 s** |
| One simple query | ~200 ms | **~10 ms** |
| Profile save | ~1 s | **~130 ms** |
| Second tab (uses the first tab's database) | — | ready in 0.5 s |

Where the time goes: opening the worker takes ~160 ms either way. The "migrations" step is really PGlite starting Postgres and reading the data folder, plus the migrations on a cold start. IndexedDB is slow per query because in durable mode PGlite writes the whole data folder to IndexedDB after every query, reads included.

OPFS also passed: save → reload, a second tab reading the first tab's data, and the owning tab closing while a second tab saves (leadership moved, the save persisted).

**Decision: OPFS when the browser has sync access handles, IndexedDB otherwise** (`lib/db/browser/worker.ts`). Both are durable.

#### Starter database (first visit)

`scripts/build-seed-db.mjs` creates an empty database in Node, runs the migrations, and dumps it with `dumpDataDir("gzip")` to `public/pglite/seed.tar.gz` (gitignored; `scripts/lite.mjs` rebuilds it before every lite `dev` and `build`). On a first visit the worker fetches it and passes it to PGlite as `loadDataDir`, so no setup or migrations run in the browser. A plain URL rather than a bundler import keeps self-hosted builds independent of the file.

| | Size |
| --- | --- |
| Seed download, gzip (as served) | 4.6 MB |
| Seed download, Brotli (if the host precompresses) | 2.8 MB |
| Unpacked | 41 MB, 1,036 files: a 16 MB write-ahead log segment plus the `template0`, `template1` and `postgres` databases (~7.5 MB each). A database created in the browser has the same files. |

First visit, OPFS, ready = database open and migrated (same build, same conditions):

| | Runs | Average |
| --- | --- | --- |
| No seed (normal setup) | 11.1 s | 11.1 s |
| Seed, pool 1,500 | 7.2 / 6.5 / 7.8 s | 7.2 s |
| **Seed, pool 1,100 (chosen)** | 5.8 / 5.6 s | **5.7 s** |

So the seed takes the first visit from about 11 s to about 5.7 s (about half). Measured on localhost, so the 4.6 MB download is near-free here; on a 50 Mbit/s connection it adds about 0.7 s, and it downloads alongside the 5.7 MB PGlite runtime. Warm loads of a seeded database are unchanged (1.9 s), the second tab is ready in 0.5 s, and saves take ~150 ms.

What made it work, and what to keep:

- **OPFS handle pool.** PGlite's OPFS backend opens one handle per file from a pool that starts at 1,000 and refills 100 at a time between queries. Unpacking the seed creates all ~1,040 files at once, so the default pool ran out ("No more file handles available in the pool"). The worker gives the seed load a starting pool of 1,100. Each pooled handle costs about 4 ms on a first visit (1,500 was 1.5 s slower), so the pool stays just above the seed, and the seed build fails if the seed's file count gets within 30 of it.
- **Recovery from a failed first visit.** A failed load leaves the worker holding OPFS handles, so it can't clean up after itself. The worker writes a `hireme.ready` marker when a database is finished; at startup, a `hireme` folder without the marker is an interrupted first visit and is removed before any handle opens. If loading the seed fails, a `hireme.noseed` marker makes the next visit create the database the normal way. Both paths were tested (the no-seed path took 11.1 s, as expected).
- **Opening early.** `components/app/open-browser-db.tsx` starts opening the database when any app page loads (lite only). It doesn't change the numbers above, because Profile asks for data straight away; it pays off once other pages read data, by having the database ready on navigation.

Findings to act on:

1. **`relaxedDurability` hides failed writes.** With it, PGlite starts the IndexedDB flush without awaiting or catching it, and a failure on first setup showed as an unhandled `ErrnoError` (data was fine because later flushes copy everything again). The worker uses durable writes on both backends.
2. **The first visit is about 5.7 s with the starter database** (was ~11 s). During it, lite pages show "Setting up your data in this browser…" (`components/app/browser-db-setup.tsx`) instead of a skeleton; `hasBrowserDb()` in `lib/db/browser/storage.ts` tells a first visit apart on the main thread without loading PGlite, and returning visits keep the skeleton. Phase 2's lite loaders should use the same pair. Still to do: serving the seed and PGlite files precompressed with Brotli and long-lived caching (phase 7; the seed then needs a content-hashed file name instead of today's revalidated `seed.tar.gz`).
3. **Safari and Firefox are not measured yet.** Safari limits how many sync access handles a page can hold, and PGlite's OPFS backend keeps one open per database file (over 1,000). Test both before launch; if OPFS fails there, the IndexedDB fallback must be selected for them too, not just when the API is missing.
4. **Existing IndexedDB data isn't moved to OPFS.** It doesn't matter now (no users), but any later change of backend needs a migration path (export → import from phase 5 covers it).
5. `next dev` adds `.next-lite` type paths to `tsconfig.json` (kept), and ESLint must ignore `.next-lite/**` (done).
6. Testing note: the browser pane's main tab froze while the pane was hidden; tabs opened separately kept running. Use a separate tab for automated checks.

Exit: Profile loads and saves in lite, survives a reload, works in two tabs; self-hosted Profile unchanged. **Met.** Finding 2 (first-visit message, compression and caching) and finding 3 (Safari and Firefox) carry forward.

---

## Phase 2: Data layer (all pages, both modes)

### Status

| Item | State | Where |
| --- | --- | --- |
| 2.1 Server database guard | ✅ | `lib/db/index.ts` (landed in phase 1) |
| 2.2 Profile queries | ✅ | `lib/profile/queries.ts`, `cv-file.ts` (phase 1) |
| 2.2 Job and fit queries | ✅ | `lib/jobs/queries.ts`: `storeJobs`, `readJob`, `toListItem`, `readFitMatches`, `writeFitMatch` |
| 2.2 Pipeline | ✅ | `lib/jobs/applications.ts`: `toggleSaved`, `setStatus`, `readApplications`, `countApplications` |
| 2.2 Settings | ✅ | `lib/settings/queries.ts`; pure AI config, form input and checks in `lib/ai/settings.ts` |
| 2.2 Source credits | ✅ | `lib/jobs/sources/credits.ts`, shared by the sources and pages |
| 2.3 Invalidation bus | ✅ | `lib/client/bus.ts`, with cross-tab `BroadcastChannel` |
| 2.3 Lite loader | ✅ | `components/app/lite-data.tsx` (first-visit, loading, error, reload on invalidation) |
| 2.3 Mutations module | ✅ | `lib/client/mutations.ts` covers every write; no component imports an `actions.ts` |
| 2.4 Home, Profile, Pipeline, Job, Settings | ✅ | View + server loader + `lite-*.tsx` loader each |
| 2.4 Jobs (search) | ⏭ Phase 3 | Lite shows a "coming soon" state |
| 2.5 No auth in lite | ✅ | `proxy.ts` redirect, `(auth)/layout.tsx` 404, `/api/auth` 404 |

Verified (2026-10-23):

- **Shared queries:** a Node script ran them against a fresh in-memory PGlite with the real migrations. It covered profile, `storeJobs` (insert, order, refresh on conflict), `readJob` with quick match, save/unsave, status moves and events, pipeline cards, fit upsert, settings and lite key encoding. 7 of 7 checks passed.
- **Lite (production build, Chromium):** first visit shows the setup message, then Home. A profile save shows on Home. AI and RapidAPI settings save, and a save in one tab updates Settings in another tab. Test connection explains AI isn't available yet. Pipeline is empty, Jobs shows its placeholder, and an unknown job shows "Job not found". `/sign-in` redirects to `/home`, and `/api/auth/*` returns 404. All lite pages are static (○); the job page prerenders its shell.
- **Self-hosted:** Home, Pipeline, Settings and a Jobs search render with existing data. Writes were not exercised on the running install, only through the shared-query script.
- **Bundles:** no page's initial JS includes PGlite or `sanitize-html`. The lite data chunk loads on demand and includes `sanitize-html` (60 KB gzipped) for the quick-match text.

Known gaps, by design until later phases:

- Lite AI is off. `testAiConnection` and `fetchModels` return "not available yet", and choosing the Ollama preset in lite shows that message because the form loads models on pick (phase 4).
- `components/jobs/analyze-jobs.tsx` calls `router.refresh()` after a batch. Lite needs `invalidate("job_match")` there (phase 4, with evaluation).
- Lite hides the JobSpy switch (phase 6).

Testing note: in the browser pane, a hidden pane can keep server-streamed Suspense content hidden (React reveals it on an animation frame). Read the `S:` placeholders or bring the tab to the front.

### 2.1 Guard the server database

- `lib/db/index.ts`: `createDb()` throws `"The lite build has no server database"` when `isLite`. A wrong import then fails loudly in dev instead of quietly creating `.data/` on the host.

### 2.2 Separate storage from logic

Storage-free logic is already shared (`fit.ts`, `quick-match.ts`, `job-key.ts`, `detect-skills.ts`, `profile/dates.ts`, `geo/`, `format.ts`). Split the rest so the query code is written once against a `Db` argument:

| Today (server-only) | Becomes |
| --- | --- |
| `lib/profile/data.ts` `getMyProfile`, `getMyCvText` | `lib/profile/queries.ts`: `readProfile(db, user)`, `readCvText(db, userId)`, `writeProfile(db, userId, input)`, `writeCv(db, userId, file, text)`. Server `data.ts` becomes thin wrappers that pass `getDb()` + `getCurrentUser()`. |
| `lib/jobs/data.ts` `storeJobs`, `savedJobIds`, `getJob`, `getMyApplications`, `countMyApplications`, `toInsert`, `extrasOf`, `matchSortScore` | `lib/jobs/queries.ts` with `db` as first argument. `searchJobs` keeps its shape but its search step becomes a parameter (server: `searchAllSources`; lite: phase 3). |
| `lib/jobs/evaluation.ts` `runFitEvaluation`, `getMyFitMatches` | `lib/jobs/evaluation-queries.ts`: `saveFitResult(db, userId, jobId, result, config)`, `readFitMatches(db, userId, ids)`. The AI call moves out (phase 4). |
| `app/(app)/jobs/actions.ts` toggle / status logic | `lib/jobs/applications.ts`: `toggleSaved(db, userId, jobId)`, `setStatus(db, userId, appId, status)`. Actions call these, then `refresh()`. |
| `app/(app)/settings/actions.ts` upserts | `lib/settings/queries.ts`. The secret handling stays at the edges (server encrypts; lite writes `plain.`). |
| `lib/ai/config.ts` `getAiConfig` | `aiConfigFromRow(row, decrypt)` (pure) + server wrapper. Lite passes a `plain.` decoder. |

`Db` type: widen `lib/db/index.ts`'s `Db` to the shared Drizzle Postgres query surface so both `PostgresJsDatabase` and the PGlite database fit without casts at call sites.

### 2.3 Client-side plumbing (lite only)

- `lib/client/bus.ts`: `invalidate(...tables)`, `useInvalidation(tables)`; mirrors to other tabs over `BroadcastChannel("hireme")`.
- `lib/client/use-lite-query.ts`: `useLiteQuery(key, (db) => readSomething(db, ...), tables)`, returns `{ data, error, loading }`, re-runs on invalidation.
- `lib/client/mutations.ts`:
  ```ts
  import * as server from "./server-mutations"; // re-exports the server actions
  export const mutations = isLite ? liteMutations : server;
  ```
  where `liteMutations` are async functions that `await import("@/lib/db/browser")` and call the shared query functions, then `invalidate(...)`. Return types match the actions exactly (`Result`, `EvaluateResult`, `{ saved }`).
- Replace direct action imports in: `components/jobs/save-button.tsx`, `evaluate-button.tsx`, `analyze-jobs.tsx`, `app/(app)/pipeline/board.tsx`, `profile/profile-editor.tsx`, `settings/ai-settings-form.tsx`, `settings/job-source-form.tsx`.

### 2.4 Pages: loader + view

For each page: move the JSX that renders data into a view that takes props (most already exist), keep the server loader, add a lite loader, choose in `page.tsx`:

| Page | Server loader reads | View(s) |
| --- | --- | --- |
| `home/page.tsx` | profile, application count, AI configured | new `HomeView` |
| `jobs/page.tsx` | search params, profile, search, AI configured | `JobBrowser`, `JobCard`, `AnalyzePanel` (phase 3 for the search itself) |
| `jobs/[id]/page.tsx` | `getJob`, AI configured | `JobDetailView` |
| `pipeline/page.tsx` | `getMyApplications` | `PipelineBoard` |
| `profile/page.tsx` | done in phase 1 | `ProfileEditor` |
| `settings/page.tsx` | settings row, AI config, JobSpy health | `AiSettingsForm`, `JobSourceForm`, data card |
| layout `UserChip` | `getCurrentUser` | lite: reads the user row (name) client-side |

Lite loaders show the same skeletons as today's `Suspense` fallbacks while the database opens.

Lite `JobListItem` dates: PGlite returns `Date` objects for timestamps just like the server path, so views keep working; verify `timeAgo` and sorting.

### 2.5 No auth in lite

- `proxy.ts`: when `isLite`, treat it like local mode (redirect `/sign-in` and `/sign-up` to `/home`, otherwise pass through).
- `app/(auth)/*/page.tsx` and `app/api/auth/[...all]/route.ts`: `notFound()` / 404 when `isLite`.
- `components/app/user-chip.tsx`, `sign-out-button.tsx`: hidden in lite.

Exit: every app page works in both modes; self-hosted smoke test passes; `next build` with and without the lite flag.

---

## Phase 3: Search (proxy route + browser merge)

### 3.1 Route

`app/api/lite/search/route.ts` (new), `POST` only:

- Body: `JobSearchParams` validated with zod (same bounds `jobs/page.tsx` applies today: query length, allowed `days`, known country, location id).
- Optional header `x-rapidapi-key` for JSearch. Never logged, never stored, never part of a cache key.
- Calls `searchAllSources(params, { rapidApiKey, jobspyEnabled: false })` and returns `{ jobs: KeyedJob[], statuses }`. freehire and Jobicy are already cached for hours with `"use cache"`.
- JSearch's in-memory cache in `lib/jobs/sources/jsearch.ts` is keyed without the API key. On a shared host that means one user's paid results answer another user's identical query. In lite, either key the memo on a SHA-256 of the API key or skip the memo when `isLite`. Decide in this phase (lean: hash).
- Rate limit: per-IP token bucket in memory (best effort per instance) plus the host's firewall rule. Responses `429` with `Retry-After`.
- Returns `404` unless `isLite`, so self-hosted installs don't expose an open search proxy.

Before building, run the open question from LITE.md §10: if freehire and Jobicy answer browser requests with CORS, call them from the browser and keep the route for JSearch only.

### 3.2 Browser side

- `lib/jobs/lite-search.ts`: POST to the route, plus JobSpy (phase 6) in parallel, merge with the same `jobKey` dedupe order as `searchAllSources`, then the shared `storeJobs(db, jobs)`, `readFitMatches`, `quickMatch`, sort. Output: the same `{ jobs, statuses, hasSkills }` as `searchJobs`.
- `jobs/page.tsx` lite loader reads `useSearchParams()`, applies the same defaults (profile's first desired role, profile country), and renders the existing views. The `<Form>` GET submit keeps working as client navigation.

### 3.3 Storage hygiene

- Don't store `raw` beyond `JobExtras` (already the case).
- Prune jobs older than 60 days that are not saved and have no evaluation, on app start. Keeps browser storage small.

Exit: lite search returns, saves, and ranks jobs; statuses list matches self-hosted for the same query.

---

## Phase 4: AI in the browser

### 4.1 Shared AI core

- `lib/ai/structured.ts` (new, no `server-only`): `generateStructured({ config, ... })` with `config` **required**, `listModels`, `toStrictJsonSchema`, `extractJson`, and the OpenAI-compatible retry loop, moved from `client.ts` unchanged.
  - Anthropic: `new Anthropic({ apiKey, dangerouslyAllowBrowser: isLite })`.
  - Timeouts: `AbortSignal.timeout` works in browsers; keep 5 min for local models.
- `lib/ai/client.ts` (server): keeps `generateStructured(req)` with the `getAiConfig()` default, delegating to the core.
- `lib/ai/evaluate-job.ts`, `lib/ai/extract-profile.ts`: drop `import "server-only"`, take `config` and call the core. Prompts and zod schemas unchanged.

### 4.2 Lite flows

- Evaluate: lite `evaluateJob(jobId)` = read job + profile + CV → `evaluateJobFit(…, config)` → `saveFitResult` → `invalidate("job_match")`. Same error mapping as `jobs/actions.ts`, plus browser errors: `TypeError: Failed to fetch` → "Couldn't reach your AI provider (is it running, and does it allow this site?)".
- CV import: `unpdf` in the browser (`extractText(getDocumentProxy(bytes))`), same 5 MB / 50-char checks, then the same AI-or-`detectSkills` fallback.
- Settings: `testAiConnection`, `fetchModels`, `saveAiSettings`, `turnOffAi` as lite mutations. `checkBaseUrl` allows private hosts in lite (they are the user's own machine, called from their own browser), keeps the http(s) check.

### 4.3 Provider checks (do first, record results here)

For each, from a page on an HTTPS origin: preflight with `Authorization` / `x-api-key` / `anthropic-beta` headers, `/models`, and one structured call.

| Provider | CORS OK? | Notes |
| --- | --- | --- |
| Claude | | needs `anthropic-dangerous-direct-browser-access`; check the `server-side-fallback` beta header passes preflight |
| OpenAI | | |
| OpenRouter | | |
| Groq | | |
| Ollama | | `OLLAMA_ORIGINS`, Chrome Local Network Access prompt |

Any provider that fails gets a pass-through in a second route (`app/api/lite/ai/route.ts`) that forwards the request and body unchanged, stores and logs nothing. Only built if needed.

### 4.4 Ollama setup UI

In the AI settings form, lite only, when the preset is Ollama: show the `OLLAMA_ORIGINS=<this origin>` command for Windows (PowerShell `setx`), macOS (`launchctl setenv`) and Linux (systemd override), with copy buttons. "Test connection" tells apart:

1. `fetch` rejects on `/api/tags` → Ollama not running, or origin not allowed (an opaque CORS failure and "not running" look the same from JS; try a `no-cors` request to tell them apart: it resolves when something is listening).
2. Local network access denied → Chrome permission message.
3. `404` from chat with the model name → "Run `ollama pull <model>`".

Exit: evaluate, CV import, test connection and model list work in lite with at least Claude and Ollama.

---

## Phase 5: Backups and storage

- `lib/backup/format.ts`: zod schema `{ format: "hireme-backup", version: 1, appVersion, exportedAt, includesKeys, tables: { user, profile, job, job_match, application, application_event, document, user_settings } }`. Dates as ISO strings. Auth tables (`session`, `account`, `verification`) are never exported.
- `lib/backup/export.ts` / `import.ts` take a `Db`, so they run in the browser **and** on the server.
  - Import: validate, then **replace** (wipe and load in one transaction) or **merge** (upsert by `job_key` for jobs, by id for the rest; remap `user_id` to the target's built-in user).
  - Self-hosted gets the same Settings → Data → Import/Export via server actions, so lite → self-hosted works on day one.
- Settings → "Your data" card in lite: export, import, last export date, storage used (`navigator.storage.estimate()`), and persistence status from `navigator.storage.persist()` (requested after the first profile save, not on first visit).
- Reminder: a dismissible banner in the app layout when the last export is older than 14 days and there is something to lose (a profile or any saved job). Last export date stored in `user_settings` (new nullable column, new migration, harmless for self-hosted).
- PWA: `app/manifest.ts` (lite only content: name, icons, `display: "standalone"`, `start_url: "/home"`) and icons in `public/`. A service worker is not needed for installability in Chrome; add a minimal one only if Safari's home-screen install needs it. Follow `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.

Exit: export from lite, import into a fresh self-hosted install, everything shows up; and the reverse.

---

## Phase 6: JobSpy on the user's machine

### 6.1 Service (`services/jobspy/server.py`)

- `JOBSPY_ALLOWED_ORIGINS` (comma-separated, default empty). For an allowed `Origin`: `Access-Control-Allow-Origin: <origin>`, `Vary: Origin`, and `do_OPTIONS` answering preflights, including `Access-Control-Allow-Private-Network: true` for Chrome's local network checks. Disallowed origins get no CORS headers.
- Keep binding to `127.0.0.1` by default; the Docker image keeps its internal `0.0.0.0` but every documented `docker run` maps `127.0.0.1:8765:8000`.
- Publish the image to GHCR so lite users don't need to clone the repo: `docker run --rm -p 127.0.0.1:8765:8000 -e JOBSPY_ALLOWED_ORIGINS=https://<lite domain> ghcr.io/<owner>/hireme-jobspy`.

### 6.2 App

- Move `normalize()` and `locationFor()` out of `lib/jobs/sources/jobspy.ts` into a storage-free module both modes import. The server source keeps its `"use cache"` fetch.
- Lite: `lib/jobs/lite-jobspy.ts` calls `http://127.0.0.1:8765/search` once per covered board from the browser, sanitizes descriptions (`cleanDescription`, so `sanitize-html` ships to the browser here; measure its size and switch this path to DOMPurify if it's large), and feeds results into the phase 3 merge.
- Settings → Job sources (lite): "Connect JobSpy on this computer": URL (default `http://127.0.0.1:8765`), Test connection (`/health`), the personal-use warning from the README, and the `docker run` / `pip` commands. Stored as `jobspyEnabled` + a new `jobspyUrl` column (same migration as phase 5's).
- `boardSource.enabled` in lite: `ctx.jobspyEnabled` only (no `isLocalMode`/`JOBSPY_URL` check, since the browser is the caller).

Exit: with the service running locally, lite search includes LinkedIn/Indeed results; without it, the statuses list says how to connect it.

---

## Phase 7: Launch polish

### 7.1 Content Security Policy

- `connect-src 'self' https://api.anthropic.com https://api.openai.com https://openrouter.ai https://api.groq.com https://jsearch.p.rapidapi.com http://localhost:* http://127.0.0.1:*` (trim to what phase 4 actually needs). Set in `next.config.ts` `headers()` for the lite build. This is the part that matters for keys.
- `script-src`: Next injects inline scripts, and `app/layout.tsx` has an inline theme script. Two options:
  1. Nonces via `proxy.ts` (Next's documented approach). Forces dynamic rendering of every page: one serverless call per page view, but still no user data on the server.
  2. `'self'` + a hash for the theme script + `'unsafe-inline'` fallback. Static pages stay static; weaker against injected inline script.
  Lean: option 1 if the host's free tier absorbs it, since the keys are in the page. Decide with numbers from phase 1.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- No third-party scripts, fonts from self (`next/font` already self-hosts).

### 7.2 Copy and docs

- Landing page (`app/(marketing)/page.tsx`): "Try it in your browser" next to "Install". In the lite build, "Try it" is primary.
- Settings copy: "Your key is stored in this browser and sent only to the provider." Replace "Everything stays on your server" in lite.
- Privacy note page (`/privacy`): what the host sees (search queries to the proxy, IP for rate limiting), what it doesn't (everything else).
- README: "Lite (in your browser)" section, Ollama + JobSpy setup, how to move to self-hosted.

### 7.3 Hosting

- Pick the host (LITE.md §10). Build command `NEXT_PUBLIC_HIREME_MODE=lite next build`. Turn off request logging of bodies if the host offers it.

---

## Cross-cutting checks (every phase)

- `npm run lint` and `next build` in both modes.
- Self-hosted smoke test on a spare port (never touch a running server on 3000 or its `.data`).
- Lite smoke test in Chrome and Firefox; Safari best effort.
- Landing page: no PGlite, no AI SDK in its bundle.

## Suggested PR order

1. Phase 1 spike (mode flag, migrations bundle, browser db, Profile).
2. Phase 2a: query split + `mutations` module, no lite pages yet (pure refactor, self-hosted only, easy to review).
3. Phase 2b: lite loaders for the remaining pages, auth off in lite.
4. Phase 3, 4, 5, 6, 7 as listed. 5 can run in parallel with 3–4 since export/import only needs the `Db` interface.
