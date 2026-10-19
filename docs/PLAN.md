# HireMe — Feasibility & Build Plan

Reference: [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (MIT — we can reuse its ideas and code, keeping the copyright notice for anything copied).

## 1. What the reference actually is

It is **not a web app**. It is a set of Claude Code prompts (`.claude/commands/*.md`, `.claude/skills/*`) plus small Bun/Python scripts, run by one person on their own machine against local files (profile markdown, a CSV tracker, LaTeX templates). All of the "intelligence" lives in the prompts; the scripts only fetch job listings and keep state.

So porting it means: **turn each prompt into a server-side feature that calls an LLM with a structured output, and turn each local file into a database table.** Every feature is feasible in Next.js. A few need different technology (noted below).

## 2. Feature mapping

| Reference command | What it does | HireMe feature | Feasible? / notes |
|---|---|---|---|
| `/setup` | Builds the candidate profile from a CV, LinkedIn export, or an interview | **Onboarding**: upload a CV PDF or answer step-by-step questions (Duolingo style). LLM pulls out skills, experience, languages, goals, and deal-breakers into a structured profile | ✅ PDF text extraction + LLM structured output |
| `/scrape` + portal skills | Searches job boards, removes duplicates | **Discover feed**: one search across several job sources, with results deduplicated by a job key (port of `tools/job_key.py`) | ⚠️ Its sources are Danish portals plus LinkedIn scraping, which breaks LinkedIn's ToS, so we can't use that in a public app. Use legal APIs instead (see §3). The portal CLIs are already TypeScript, so their normalize/parse helpers can be adapted |
| `/rank` + `04-job-evaluation.md` | Eligibility and language gates, then 5 scores (skills, experience, culture, location, career fit) | **Match score** on each job card (ring/badge), with strengths, gaps, and "why" | ✅ The framework is just a prompt and a JSON schema. Run it in the background and cache the score per (user, job) |
| `/apply` | Drafter writes CV and cover letter → reviewer critiques → revise → ATS check | **Tailor & Apply**: one click makes a tailored CV and cover letter, with a live "reviewing…" progress UI | ✅ The 2-agent loop becomes 2–3 LLM calls. ⚠️ LaTeX won't run on serverless, so we swap it for **@react-pdf/renderer** templates. The ATS check means pulling the text back out of the generated PDF |
| `/outcome` + `job_search_tracker.csv` | Tracks status, archives materials, drafts follow-ups | **Pipeline board** (Kanban: Saved → Applied → Interview → Offer) with follow-up nudges and drafted messages | ✅ Postgres tables |
| `/interview` + `07-interview-prep.md` | Prep pack, STAR mapping, mock interview | **Interview Coach**: prep pack + chat-based mock interview that streams replies | ✅ Streaming chat |
| `/upskill` | Skill-gap heatmap + learning plan | **Skill Gaps** page with a heatmap and a learning path (Duolingo-style streaks/progress fit here naturally) | ✅ |
| `/html-report` | Stats dashboard | **Insights** dashboard (funnel, response rate, charts) | ✅ |
| `/expand` | Enrich the profile from GitHub, portfolio, etc. | Connect GitHub → suggest skills | ✅ GitHub public API |
| `/gmail-sync` | Reads application emails | Later. Gmail read scopes are "restricted" and need a Google security assessment before a public launch | ⏳ Phase 4+ |
| `/notion-sync` | Exports to Notion | Later / optional | ⏳ |
| `salary_lookup.py` | Danish salary tables | Skip. Danish data only | ❌ for now |
| `/add-portal`, `/add-template` | Developer extension points | Built into the code as a `JobSource` interface and a template registry | ✅ internal |

## 3. Job data sources (the main risk)

**Target market: the Philippines.** Each source is an adapter behind one interface (`search(query) → NormalizedJob[]`, `detail(id)`):

- **JSearch (RapidAPI)**: pulls listings from Google for Jobs, which collects postings from JobStreet, LinkedIn, Indeed PH, Kalibrr and company sites. This is the best broad coverage for the Philippines. Paid tiers, with a free tier for development. Primary source.
- **Greenhouse / Lever / Ashby public board APIs**: direct postings from companies hiring in PH (BPO, fintech, and tech hubs in BGC, Makati, Cebu). Free and very clean data.
- **freehire.me API**: free and tech-focused, filterable by country.
- **Remotive / Jobicy / Arbeitnow**: free remote-job feeds. Many remote roles are open to Filipino applicants.
- Not usable: Adzuna doesn't cover the Philippines. JobStreet, Kalibrr and LinkedIn have no public API, and scraping them breaks their ToS.

## 4. Recommended stack

- **Next.js 16 App Router** (this repo). Note the version changes: `middleware` is now `proxy.ts`, and Cache Components affect caching. Read `node_modules/next/dist/docs/` before writing each part.
- **UI**: Tailwind v4 (already installed) + shadcn/ui (Radix) + Motion for spring animations, Geist/Inter fonts, lucide icons. Premium feel = big rounded cards, soft shadows, generous spacing, playful micro-interactions and streaks (Duolingo), clean typography and blocks (Notion), restraint and polish (Apple).
- **DB**: Postgres (Supabase or Neon) + Drizzle ORM.
- **Auth**: Better Auth or Supabase Auth (Google + email).
- **Storage**: Supabase Storage / Vercel Blob for uploaded CVs and generated PDFs.
- **AI**: Anthropic SDK with structured outputs. Use a fast, cheap model (`claude-haiku-5-5`) for bulk match scoring and `claude-sonnet-5-5` for drafting, reviewing, and interviews. Port the reference prompts into `lib/ai/prompts/`.
- **Background jobs**: Inngest or Trigger.dev for batch ranking and the multi-step apply pipeline (each run takes longer than one request).

## 5. Data model (first pass)

`users` · `profiles` (structured JSON: skills, experience, languages, goals, deal-breakers, writing style) · `jobs` (normalized, `job_key` unique, source, raw) · `job_matches` (user, job, gates, 5 scores, strengths, gaps) · `applications` (user, job, status, dates, notes) · `documents` (CV/cover letter versions, PDF url) · `interview_sessions` · `skill_gaps`.

## 6. Things to carry over from the reference

- **Prompt-injection guard**: postings are untrusted input. Never follow instructions found inside them and never fetch links from them. Port its "trust boundary" wording into every prompt that reads a posting.
- **No invented experience**: CV and cover letter claims must come from the profile (the reviewer's "factual grounding audit").
- **Gates before scores**: eligibility and language failures veto a job and quote the posting text back.
- **Per-user data isolation**: CVs are PII. Check auth on every server function and route.
- **Cost control**: cache match scores, cap free-tier generations, use batch calls for ranking.

## 7. Phased roadmap

1. **Foundation**: design system (tokens, components, light/dark), app shell with nav, landing page, auth, DB schema.
2. **Profile & Discover**: CV upload → AI profile; 2–3 job-source adapters; search feed with filters; save jobs.
3. **Match & Apply**: match scoring with background jobs; job detail page with score breakdown; tailored CV and cover letter generation (drafter → reviewer) with PDF export.
4. **Track & Coach**: pipeline Kanban, follow-up drafts, interview coach chat, skill-gap page, insights dashboard.
5. **Later**: Gmail sync, Notion export, salary data, mobile PWA.
