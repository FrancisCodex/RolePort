# RolePort: next roadmap (after the Interview Coach)

Goal: RolePort works for job seekers in any country. The Philippines stays the default and the first market.

Order: **1. More job sources → 2. Paste a job → 3. Email applications and follow-ups → 4. Documentation page → MCP server → MCP: Interview Coach and prompts → Sign in with ChatGPT → 5. Desktop app (and the agent question)**.
Each step ships on its own branch and works in self-hosted and Lite, unless it says otherwise.

## Status

| Phase | Status | Branch |
| --- | --- | --- |
| 0. Groundwork: tests, fetch helper, private-address guard | ✅ Done | `feat/more-job-sources` |
| 1A. Company job-board feeds, Companies I follow, starter lists | ✅ Done (its closed-job check was finished in Phase 2) | `feat/more-job-sources` |
| 1B. Official boards and remote feeds | ✅ Done: Remotive, Remote OK, Himalayas, Arbeitnow, Platsbanken. More can be added later, see 1B | `feat/more-job-sources` |
| 1C. Contributor kit | ✅ Done | `feat/more-job-sources` |
| Extra: old and ghost postings hidden, past month by default | ✅ Done | `feat/more-job-sources` |
| 2. Paste a job (and "still open" checks) | ✅ Done | `feat/paste-a-job` |
| 3. Email applications and follow-ups | ✅ Done (pasting an employer's reply is still for later, see 3B) | `feat/email-and-follow-ups` |
| 4. Documentation page (`/docs`) with search | ✅ Done (screenshots still to add) | `feat/docs-page` |
| MCP server | ✅ Done, and the agent can do the AI writing (merged in #24; still to try: Claude Desktop itself, a real agent model) | `feat/mcp-server` |
| MCP: Interview Coach tools and ready-made prompts | ✅ Built | `feat/mcp-coach-and-prompts` |
| Sign in with ChatGPT: a ChatGPT plan as RolePort's AI | 🧪 Built on its branch, waiting for a ChatGPT account to try it (not merged) | `feat/chatgpt-sign-in` |
| 5A. Desktop app: install and run RolePort with no setup | 🚧 In progress | `feat/desktop-app` |
| 5B. Desktop app: LinkedIn, Indeed and more without Python or Docker | After 5A | `feat/desktop-app` |
| 5C. Desktop app: job scout, apply assistant | After 5B | — |

**Next up: the desktop app (5A, 5B)**, so people who aren't technical can install RolePort like any other program, with no hosting, Docker or Python. Sign in with ChatGPT waits on its branch until someone with a ChatGPT plan can try it. Everything marked ✅ Done is finished.

---

## 0. Groundwork ✅ Done

Built. `npm test` runs Vitest; `lib/jobs/sources/http.ts` and `lib/net/safe-url.ts` hold the helper and the guard.

- **Tests for sources.** Add Vitest. Each source gets a test against a saved sample response in `lib/jobs/sources/__fixtures__/`, never a live site, so CI never depends on a job board being up.
- **Shared fetch helper** (`lib/jobs/sources/http.ts`): timeout, retry with backoff, a host allowlist, a page cap and a polite delay between pages. Every new source uses it.
- **Block private addresses.** Any URL that comes from a user (careers pages, pasted jobs) goes through a guard that refuses `localhost`, private IPs and cloud metadata addresses, both before and after DNS lookup. Phases 1 and 2 need this, especially on the hosted Lite relay.

## 1. More job sources ✅ Done

Three kinds of source, in this order. Each one is one file in `lib/jobs/sources/` implementing `JobSource`, with `covers(country)`.

### 1A. Company job-board feeds + "Companies I follow" ✅ Done

Most employers post through hiring software that publishes a public, key-less JSON feed for each company's careers page.

| Hiring software | Feed |
| --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings` |
| Workable | `apply.workable.com/api/v1/widget/accounts/{slug}` |
| Recruitee | `{slug}.recruitee.com/api/offers` |

Later: Teamtailor, Personio, BambooHR, Workday (harder).

- **Companies I follow** (new table `followed_companies`: name, hiring software, slug, country, added date). Add a company by pasting its careers page URL. RolePort detects which hiring software it uses from the URL, plus a JSON-LD/HTML fallback for branded careers domains.
- **How search uses them:** a search also runs over the followed companies' feeds, filtered by the query, country and work setup in code. Feeds are cached for a few hours.
- **Starter lists (built):** "Popular employers" in **Follow companies**: well-known employers with open jobs in each country, one JSON file per country in `lib/companies/starters/` (PH, SG, AU, US, GB, DE, SE and "hiring remotely"). Follow one or all in one click; the user's own countries come first. Contributed per country (docs/ADDING_A_JOB_SOURCE.md).
- **Jobs at companies you follow (built):** on Jobs, "All their jobs" or one company's name shows every opening they have, with optional filters, newest first.
- **Still open (built in Phase 2):** a job from a feed is open while it's still in its company's feed. Saved and applied jobs show "Closed" when it disappears. Built together with Phase 2's "Check again", so both kinds of job share one check.
- **Lite:** the search relay (`/api/lite/search`) fetches the feeds with the host allowlist above. Followed companies live in the browser's database like everything else.
- **Porting:** career-ops (MIT) has working modules for these in `providers/*.mjs`. Port the logic to TypeScript and credit it in `THIRD_PARTY_NOTICES.md`.

### 1B. Country-wide official sources and remote feeds ✅ Done (more sources can be added any time)

**Built:**

- **Platsbanken (Sweden):** Arbetsförmedlingen's board, through JobTech's open JobSearch API. No key; JobTech matches the words (Swedish or English) and dates.
- **Arbeitnow (Germany):** a free job board API, newest postings.
- **Remote feeds:** Remotive (whole feed read every six hours, as its terms ask), Remote OK (posting links are followed links, as its terms ask), Himalayas (search). Jobicy was already there.
- Remote postings that name a region ("Europe", "LATAM", "APAC") now only show to people in that region.

**Waiting, and why:**

- **Germany (Arbeitsagentur):** its API refused plain requests from RolePort (403). Under the source policy, RolePort doesn't work around that. Revisit if it publishes an open client.
- **Singapore (MyCareersFuture):** only an internal website API, which didn't answer. Not a core source under the policy.
- **Canada (Job Bank):** publishes open data as downloads, not a search API. Could be imported on a schedule later.
- **US (USAJOBS):** needs a free key and an email address in each request. Needs a Settings field like the RapidAPI key: next candidate.
- **Belgium (VDAB):** needs registration for API access.
- **Philippines (PhilJobNet):** no open feed found. JSearch, JobSpy and the starter company list cover the Philippines.
- **We Work Remotely:** RSS only, and its terms don't clearly allow reuse. Left out for now.

### 1C. Make it easy for contributors to add sources ✅ Done

- **One registry:** a new source is one file, one fixture test and one line in `lib/jobs/sources/registry.ts` (no edit to `search.ts`). A test fails if a source file isn't listed. Bundlers can't load files by name at runtime, so this is the closest safe version.
- **README table from metadata:** each source declares `kind`, `coverage` and `needs`; `npm run docs:sources` writes the README's "Job sources" table, and a test fails when it's out of date.
- **Issue template** "Propose a job source" (`.github/ISSUE_TEMPLATE/job-source.yml`).
- **Source policy** in `docs/ADDING_A_JOB_SOURCE.md`: core sources use official APIs, open data or pages `robots.txt` allows, identify as RolePort, and never work around a refusal. A board's internal website API only goes behind the opt-in, self-hosted-only setting, like JobSpy.

**Done when:** you can follow a company by pasting its careers URL, its jobs show up in search, closed jobs are marked, and there are fixture tests for every source. *(All done except closed jobs, which moved to Phase 2 so pasted jobs share the same check.)*

## 2. Paste a job ✅ Done

An **Add a job** card on **Jobs** (beside **Follow companies**) and on the home page opens a dialog: "Paste a job link or the job description".

1. **A link from a supported hiring system** (Greenhouse, Lever and the others): fetch the posting through that source. You get structured data and the "still open" check, and RolePort offers "Follow this company".
2. **Any other link:** fetch that one page (it passes the private-address guard, follows at most 3 redirects, is capped at 2 MB, and isn't fetched again within 1 hour). Read the `schema.org/JobPosting` JSON-LD most careers pages include. If it isn't there, extract the page text.
3. **Pasted text, or a link that can't be read** (LinkedIn, Facebook groups, OnlineJobs.ph, a recruiter's email): the AI pulls out title, company, location, work setup, salary and requirements with `generateStructured()`. Code checks that every extracted value appears in the pasted text. Anything that fails is left empty for the user to fill in.
4. **Review screen:** the user checks the fields, then **Save**, **Evaluate fit** or **Apply**. From there it's the same pipeline as any job (`source: "pasted"`). The text is treated as untrusted input, with the same prompt-injection guard as postings.

- **Still open, for pasted links:** "Check again" on the job page. It's closed if the page returns 404/410, the JSON-LD `validThrough` date has passed, or the page says it's no longer accepting applications.
- **Lite:** fetching a link goes through the server relay with the same guard. Pasting text needs no server at all.

**Done when:** a Greenhouse link, a company page with JSON-LD and a pasted LinkedIn description each end up as a saved, evaluated job.

### How it was built

- **The dialog** (`components/jobs/paste-job.tsx`): three short steps on how it works, the box for a link or text, and a "Good to know" list of what isn't read (LinkedIn, Facebook, Indeed, Glassdoor, OnlineJobs.ph, private or local addresses, pages that only show the job in a browser). The review screen opens in the same dialog, with **Back** to change what was pasted.
- **Hiring systems:** Greenhouse, Lever and SmartRecruiters postings are read through their single-posting APIs; Ashby, Workable and Recruitee postings are looked up in the company's feed (`postingId()` and `fetchPosting()` on each board). The review offers to follow the company.
- **Other pages** (`lib/jobs/paste/link.ts`, `page.ts`): the address guard, 3 redirects, 2 MB, one fetch per link per hour, then the page's `JobPosting` JSON-LD, else its readable text. Sites whose terms don't allow reading are never fetched; RolePort asks for the text instead.
- **AI is optional.** Hiring-system links and pages with JSON-LD fill in without it. Only plain text (pasted, or from a page without JSON-LD) needs the AI (`lib/ai/extract-job.ts`), and `lib/jobs/paste/verify.ts` empties every field the text doesn't back up word for word. Without AI the user fills those fields in. Tested on gemma4 12B.
- **Saving** (`lib/jobs/paste/store.ts`) always puts the job on the user's list, so it can't get lost. Pasting the same link or text again updates the same job.
- **Still open:** "Check again" on the job page covers company-feed jobs and pasted links, and a saved job is checked once a day when its page opens. The answer is kept on the job; closed jobs are marked on the job page, job cards and the Applied list ("Posting closed").
- **Lite:** `/api/lite/job-link` reads links and `/api/lite/job-check` checks them; pasted text is read by the user's AI in the browser.
- **Tests:** `lib/jobs/paste/*.test.ts` (JSON-LD, page text, closed wording, the extraction checks, link reading and checks with saved responses).

## 3. Email applications and follow-ups (reaching people directly) ✅ Done

All of this lives on the application page (`/applied/[id]`) and reuses the cover-letter pipeline (`lib/letter`): profile facts in code, the prompt editable in Settings, checks for unsupported numbers, placeholders and clichés. **RolePort never sends anything**: copy, download, or open in the user's mail app (`mailto:` with subject and body).

### 3A. Email application

- **Who:** the recipient name and email (optional), filled in by the user or copied from the posting if it's there. Add a small **Contacts** list on each application (name, role, email, LinkedIn URL, notes). No contact scraping.
- **Draft:** a subject line in the usual format ("Application: {Role} – {Name}") and a short body. It's shorter than the cover letter, which goes in as the attachment.
- **Attachments checklist:** tailored CV PDF, cover letter PDF and anything the posting asks for (portfolio, references). Links to the files RolePort already made.
- **Variants:** formal application, referral request to someone you know, and a cold note to a hiring manager (LinkedIn version ≤300 characters).

### 3B. Follow-ups

- **When:** default rules in Settings, each one editable:
  - **Applied, no reply:** first nudge after 7 days, a second after 14.
  - **After an interview:** a thank-you within 24 hours, then a check-in 5 working days after the date they gave you.
  - **After an offer:** reply or negotiate by the deadline.

  The dashboard's existing "follow-ups due" uses these rules, and each due item opens the draft.
- **Draft:** written from the application's history: the role, the date applied, the interview date and what was discussed (pulled from the Interview Coach notes and the user's notes). It's checked like the letter.
- **Log it:** "Mark as sent" adds an entry to the status history and schedules the next follow-up. "Got a reply" pauses them all.
- **Later:** paste an employer's reply and RolePort suggests a status change (interview invite, rejection, offer).

**Done when:** from an applied job you can produce an application email and a follow-up after 7 days, mark both as sent, and see the next one on the dashboard. *(All done. Pasting an employer's reply to suggest a status is still for later.)*

### How it was built

- **The mailbox** (`/applied/[id]/emails`, opened from an **Emails and follow-ups** row in the application kit and from Home): a list of what's due, drafts and everything sent, beside the open message. **Compose** asks what you want to send, then a mail-style composer takes who it's for, the subject and the message. **Copy**, open it filled in on **Gmail** or **Outlook**, in the computer's **Mail app** (`mailto:`) or, for LinkedIn, open the contact's profile. **Mark as sent** moves the message to Sent with a full copy, so any kind can be sent as many times as needed. A sent message can be read, used as a starting point (**Send again**) or taken back to drafts (**I didn't send this**). Edits save as you type.
- **Storage:** one `follow_up` document per application (`lib/outreach/types.ts`) holds the contacts, a draft per kind, every sent message, "Got a reply", the reply-by and offer-deadline dates, what came up in the interview and the attachments checklist. Backups carry it with the other documents. Marking sent adds a note to the status history ("Sent: First follow-up"), updates `last_contact_at`, `follow_up_count` and `next_follow_up_at`, and sending the application email moves a saved job to Applied.
- **Contacts:** added by hand per application (name, role, email, LinkedIn, notes); email addresses written in the posting are offered with one click. Nothing is looked up.
- **AI drafts** (`lib/ai/write-email.ts`, prompt in `lib/ai/email-prompt.ts`, editable in Settings → Email prompt): the model writes the greeting and message from the profile, the posting and the application's history (`lib/outreach/view.ts` builds the prompt, shown word for word on the page). The subject and sign-off come from code. Checks flag numbers not in the profile, CV or application, placeholders, clichés, length (LinkedIn's 300 characters) and a missing employer name. Without AI, everything works except the draft button.
- **What came up:** thank-you and check-in drafts only use what the user writes there. Points from the Interview Coach for the application can be added with one click, labelled as practice, not the real interview.
- **Attachments checklist:** the tailored CV and cover letter (with their status and links), plus what the posting asks for (portfolio, references, transcript, samples, certificates, NBI clearance).
- **Follow-up rules** (`lib/outreach/rules.ts`, Settings → Follow-up reminders, each one can be changed or switched off): first nudge 7 days after applying (or after the application email was sent), second at 14; thank-you within 24 hours of the interview; check-in 5 working days after the date they gave (or the interview); offer reply 2 days before the deadline. **Got a reply** pauses them until the application moves to another status. Home's **Follow up** panel lists what's due and what's coming in the next two weeks, each opening its draft.
- **Why you're writing:** follow-ups carry a reason (where the application stands, the timeline, next steps, sharing something new), with the user's own details. **Other reason** covers anything outside the reminders: confirming, asking about or moving an interview. The reason and details go to the model, and the subject follows the reason.
- **Stepping away:** **Withdraw**, **Cancel interview**, **Decline offer** and **Rejection reply** each take a reason, including "I'd rather not say". Marking one sent asks first, moves the application to Withdrawn or Offer declined and stops its follow-ups; cancelling also clears the interview date. **I didn't send this** puts it all back.
- **Lite:** the same code runs on the browser database; drafts go from the browser to the user's AI.
- **Tests:** `lib/outreach/rules.test.ts` (the rules, labels, mailto links) and `lib/ai/write-email.test.ts` (composing, checks, the prompt).

## 4. Documentation page (`/docs`) ✅ Done

One place where anyone can learn RolePort end to end, before the desktop app adds a third way to run it. It's public (no sign-in), part of the marketing site, and works the same for self-hosted and Lite, since it's static pages.

### What's in it

- **Introduction:** what RolePort is, who it's for, the two editions (self-hosted and Lite) and how to choose, and what "bring your own key" means.
- **Quick start:** one short path per edition: open Lite or install self-hosted, add an AI key (or a local model), import your CV, set your countries, run your first search, evaluate a job.
- **How the app works,** one page per area: Profile and CV import, Jobs (search, filters, date range, why old and ghost postings are hidden), Companies you follow, match scores and AI evaluations, tailored CVs and cover letters, the Applied tracker, the Interview Coach, emails and follow-ups (Phase 3), Paste a job (Phase 2), Settings.
- **Job portal guides:** one page per job source: what it covers, what it needs (a key, an opt-in), how to set it up, and its limits. The source list and its details come from the registry (`kind`, `coverage`, `needs`) like the README table, so the docs never fall behind the code. Also a guide to following companies by hiring system (Greenhouse, Lever and the others), with how to find a company's careers link.
- **AI providers and models:** setting up each provider's key, using a local model, what works on small models, and what each feature costs roughly.
- **Privacy and data:** where data lives in each edition, what the Lite relay sees, how to export and delete it. Links to the Privacy page rather than repeating it.
- **FAQ:** short answers to the common questions ("Why don't I see LinkedIn jobs?", "Why did a job disappear?", "Does RolePort apply for me?", "Is my CV sent anywhere?").
- **Contributing:** adding a job source or a starter list (from `docs/ADDING_A_JOB_SOURCE.md`), proposing one, and running the project locally.

### How it works

- **Pages:** written in Markdown/MDX in the repo, one file per page, so contributors can fix the docs in the same pull request as the code. Sidebar navigation by section, a table of contents on each page, previous/next links, and "Edit this page on GitHub".
- **Search:** a search box in the landing page header and in the docs (also opened with `Ctrl K` / `⌘ K`). It searches page titles, headings and text, and jumps to the matching section. The search index is built with the site, so searching needs no server or outside service and works in Lite.
- **In the app:** a "Docs" link in the app's navigation, and small "Learn more" links from screens to their page (for example the job sources card in Settings opens the job portal guides).
- **Screenshots** from the demo's sample data, never from a real user's data.
- Follows the site's existing look, light and dark mode, and works on phones.

**Done when:** `/docs` has the introduction, the quick start for both editions, a page for every app area and every job source, and the FAQ; the landing page's search finds a page by a word in its text; and a test fails if a job source has no docs page. *(All done. Screenshots are still to add.)*

### How it was built

- **Pages:** one Markdown file per page in `content/docs`, listed in `lib/docs/nav.ts`, rendered with `react-markdown` when the site is built, so they're static in both editions. Plain Markdown rather than MDX, so nothing in the build changes and a contributor only needs to know Markdown.
- **Job source pages:** a page names its sources in its front matter (`sources: remotive`), and `lib/docs/content.ts` adds their facts from the registry. All the JobSpy boards share one page, and so do the company hiring systems.
- **Search:** `/docs-index.json` is prerendered with one entry per heading. The landing page's command menu (`Ctrl K` / `⌘ K`, also on every docs page) fetches it the first time it opens and searches in the browser (`lib/docs/search.ts`). Results jump to the heading.
- **In the app:** a **Docs** link in the sidebar and the mobile header, and **Learn more** links on Jobs, Applied, Pipeline, Coach, Profile and each Settings card. They take a page's slug, so a wrong link fails type checking.
- **Tests:** `lib/docs/docs.test.ts` fails if a page and the sidebar disagree, a page has no title or description, a job source has no page, or a link inside the docs points at a missing page or heading.

## MCP server ✅ Built

Lets people who already use an AI agent (Claude Desktop, Claude Code, Codex, Cursor and others) drive RolePort from there: "find me data analyst jobs in Cebu posted this week, evaluate the top five and save the good ones". It's a thin layer over what RolePort already does, so it ships before the desktop app, and the desktop app's job scout reuses it. Branch: `feat/mcp-server`.

### Where it runs

- **Inside the running app, at `/api/mcp`** (MCP's Streamable HTTP transport, stateless). Not a separate process: the embedded database (PGlite) can only be opened by one process, so a second process would fail while the app is running. With `DATABASE_URL` set it would work, but one way for everyone is simpler.
- **Agents that only speak stdio** (some Claude Desktop setups) use a small bridge in the repo, `scripts/mcp-stdio.mjs`, that forwards to `/api/mcp`. Claude Code, Codex and Cursor connect over HTTP directly.
- **Self-hosted only.** Lite keeps all data in the browser and its server has none, so there's nothing for an agent to reach. The docs say so and point to self-hosted. The desktop app (Phase 5) will have it built in.
- **Library:** the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`) with the zod schemas RolePort already uses. Check the route handler guide in `node_modules/next/dist/docs/` before writing the route.

### Turning it on (off by default)

RolePort has no sign-in, and the Docker setup publishes port 3000 on every interface, so an open endpoint would hand anyone on the network the user's data.

- **Settings → Connect an AI agent:** a switch, then a token shown once (stored encrypted with `lib/secrets.ts`, like API keys), **Regenerate** and **Turn off**. Copy-paste setup for Claude Desktop, Claude Code, Codex and Cursor, with the token and the address filled in.
- **Every request** needs `Authorization: Bearer <token>`. Requests with a browser `Origin` that isn't the app itself are refused (stops other web pages from calling it through the user's browser), and it's rate-limited with `lib/rate-limit.ts`.
- **Which tools:** a choice between **Read only** and **Read and change** (default). Read only hides every tool that writes.

### Tools

Each tool is one file in `lib/mcp/tools/`, listed in one registry (like the job sources), calling the same functions the server actions call. Where an action still holds its logic, move the logic into `lib` first so the button and the tool share it.

**Read (marked read-only for the agent):**

| Tool | What it returns |
| --- | --- |
| `get_profile` | Headline, skills, experience summary, countries, work setup, salary wish. Not contact details unless asked for. |
| `search_jobs` | The same search as Jobs: query, country, work setup, date range. Jobs with their quick match. |
| `get_job` | One job: description, fit evaluation if there is one, still-open check, saved or applied. |
| `list_applications` | The tracker: role, company, status, dates, next follow-up. Filter by status. |
| `get_application` | One application: status history, notes, interview date, contacts, which documents exist. |
| `follow_ups_due` | What Home's **Follow up** panel shows: due now and in the next two weeks. |
| `list_followed_companies` | Followed companies and their open jobs count. |

**Change (marked so agents ask the user first):**

| Tool | What it does |
| --- | --- |
| `save_job` / `unsave_job` | Same as the save button. |
| `add_job` | Paste a job: a link or the text, through Phase 2's pipeline and its checks. Saves it and returns the review. |
| `check_job_open` | "Check again". |
| `evaluate_job` | The AI fit evaluation, saved on the job. |
| `apply_to_job` | Moves a job to Applied (doesn't apply anywhere). |
| `set_status`, `set_notes`, `set_interview_date` | The tracker's own fields. |
| `tailor_cv`, `draft_cover_letter` | Write and save the draft. Returns the text and its checks; the PDF stays in the app. |
| `draft_email` | A draft of a kind (application, follow-up, thank-you…), saved like Compose. |
| `mark_email_sent` | Same as **Mark as sent**, with the history note and next follow-up. |

**Left out on purpose:** deleting anything, Settings, API keys and prompts, editing the profile or CV, backups and imports. Those stay in the app. Nothing sends an email; the agent gets the draft and a `mailto:` link like the app's buttons.

### Safety and cost

- **Postings are untrusted.** Job text goes back to the agent labelled as the employer's text, not instructions, with the same prompt-injection guard as the app's own prompts. Pasted links still go through the private-address guard.
- **Changes are visible.** Every change made through MCP adds "(via AI agent)" to the application's status history.
- **Whose AI:** `evaluate_job`, `tailor_cv`, `draft_cover_letter`, `draft_email`, `import_cv` and `add_job` (for text) use the AI set up in RolePort, or the agent's own model when RolePort has none (or Settings says so). That second way is for people with a Claude or ChatGPT plan but no API key or capable computer: see **The agent writes** below.
- **Small results.** Lists are capped and paged, and long descriptions are cut with a way to ask for the rest, so a small local model's context isn't flooded.

### Docs and tests

- A docs page, **Connect an AI agent** (`content/docs`), with setup per agent and example requests. **Learn more** from the Settings card.
- Tests run the server through the SDK's in-memory transport against an in-memory database: the token is required, a wrong `Origin` is refused, Read only hides the changing tools, every tool in the registry has a description and a schema, and a search, evaluate, apply, draft flow ends in the tracker.

**Done when:** from Claude Desktop or Claude Code, with the token from Settings, you can search for jobs, evaluate one, apply to it, draft its follow-up and see all of it in the app, and turning the switch off makes every call fail. *(Checked with the MCP SDK's own client over HTTP and through the stdio bridge, against a running install: search, read, save, apply, status, wrong token, other origin, switch off, and the agent-writes flow for CV import, evaluation and an email, which showed up in the app labelled "Your AI agent". Still to try: Claude Desktop itself, a real agent model answering the briefs, and RolePort's own AI through MCP.)*

### The agent writes (no API key needed)

Added because the main audience may have a Claude or ChatGPT plan but no API key or computer that runs a good local model.

- **How:** a fourth provider, `agent`, in `lib/ai/settings.ts`. Every AI feature already goes through `generateStructured()`; on the agent provider with no answer it throws an `AgentBrief` holding the exact system prompt, input, schema and effort. The tool returns that as a brief (`lib/mcp/brief.ts`: instructions, input, the answer's JSON Schema, an approximate input size, the effort RolePort would use, the user's usage choice). The agent calls the same tool again with `answer`; `generateStructured()` validates it against the schema (listing up to 20 problems to fix) and returns it, so each feature's own checks and saving run unchanged. Paste-a-job's text reading passes the brief through instead of falling back to manual.
- **New tool `import_cv`:** the CV into the profile, draft first, saved only with `save: true` after the user agrees.
- **Settings:** **Who writes** (RolePort's AI, else the agent / Always the agent / Only RolePort's AI; `mcp_writer`) and **When the agent writes** (Keep usage low / Balanced / Best quality; `mcp_usage`), passed to the agent in every brief.
- **Usage:** RolePort can't choose the agent's model or effort; the agent app does. Each brief says how big the task is and how much effort is enough, the server's instructions say these are routine tasks, and Settings and the docs say where each agent picks its model and effort.
- **Labelled:** what the agent wrote shows "Your AI agent" where the app shows which model wrote something.

### How it was built

- **The route** (`app/api/mcp/route.ts` → `lib/mcp/handler.ts`): checks the rate limit, reads the user's settings, checks the switch, token and `Origin` (`lib/mcp/access.ts`), then answers with a fresh stateless server (`WebStandardStreamableHTTPServerTransport`, JSON responses). Lite answers 404. SDK pinned at `@modelcontextprotocol/sdk@1.32.1`.
- **The token** is stored as a SHA-256 hash (`user_settings.mcp_token_hash`, with `mcp_access` = `read` / `write` / null), not encrypted: RolePort only needs to compare it. Turning off forgets it. Backups leave both columns out, like API keys.
- **Tools** are grouped by area in `lib/mcp/tools/` (profile, jobs, applications, documents) and listed in `lib/mcp/registry.ts`. They call the existing `lib` functions with a `McpContext` (database, user, AI config, search and link readers), so tests swap in an in-memory database and no network. The server actions didn't need moving: their logic already lived in `lib`.
- **Marked changes:** `setStatus` and `markApplied` take an optional history note; status changes from agents carry "(via AI agent)". Other edits (notes, interview date) don't add history entries, same as in the app.
- **Settings → Connect an AI agent** (`app/(app)/settings/mcp-form.tsx`): Read and change / Read only, **Turn on**, **New token**, **Turn off**, and the setup for Claude Code, Claude Desktop, Codex and Cursor (`lib/mcp/setup.ts`) with this install's address and the token filled in while it's shown.
- **Claude Desktop bridge:** `scripts/mcp-stdio.mjs`, no dependencies, forwards stdin JSON-RPC lines to `/api/mcp`.
- **Docs:** `content/docs/ai/agents.md`, linked from the Settings card and the Settings docs table.
- **Tests:** `lib/mcp/mcp.test.ts` (access checks, the registry, Read only, a search → save → apply → status flow with the agent note, the brief → wrong answer → saved answer flow, Only RolePort's AI, the usage choice, unknown-id messages).

**Later:** MCP prompts for common requests ("weekly job hunt"), and the same agent-writes flow for application questions and the Interview Coach if people ask.

## MCP: Interview Coach and ready-made prompts ✅ Built

Two gaps after the MCP server: an agent couldn't run a mock interview (it could only improvise one, unsaved and ungraded), and users had to work out what to ask. Branch: `feat/mcp-coach-and-prompts`.

### How it was built

- **Interview Coach tools** (`lib/mcp/tools/interview.ts`): `list_mock_interviews`, `get_mock_interview` (transcript, the question waiting, the report), `start_mock_interview`, `answer_interview`, `skip_interview_question`, `end_interview`, `get_interview_report`. They call the Coach's own steps in `lib/interview/sessions.ts`, so RolePort stays the interviewer: it plans the questions, decides follow-ups and grades. The agent only relays questions and the user's replies word for word (the tool results and the server instructions say so). Sessions are saved like the app's and show on the Coach page.
- **The agent can be the AI here too.** Planning, each follow-up decision and each grading step go through `generateStructured()`, so without RolePort's AI each one is a brief for the agent.
- **Grading in steps.** `get_interview_report` runs as many grading steps as fit in about 45 seconds and reports progress; call again to continue. When the agent grades, coaching (checking each answer against the CV and letter, writing a stronger one: 2 more steps per answer) is off by default to save usage, and the report is marked done once the summary is in (`finishWithoutCoaching`), so the Coach page shows it, scores it and counts it in progress. Coaching can't be added afterwards; ask for it up front.
- **Ready-made prompts** (`lib/mcp/prompts.ts`): Find and evaluate jobs, Mock interview, Prepare an application, Follow-ups due, Import my CV, Look back at evaluated jobs, My job search this week. Slash commands in Claude Code (`/mcp__roleport__…`), the + menu in Claude Desktop. Read only offers only the two that don't change anything.
- **Copy-paste requests in the app** (`lib/mcp/agent-prompts.ts`, `components/app/agent-prompt.tsx`): where a screen needs AI and RolePort has none (MCP on with Read and change, and the agent writing), an "Or ask your AI agent" box offers a request filled in with that job, application or interview, to paste into the agent: Jobs results (top 5), a job, an application's kit, tailored CV, cover letter, emails, Coach setup, an interrupted interview, a pending report, Profile CV import and Home. One server action (`getAgentPromptsMode`) decides, asked once per page. Application questions has no MCP tool yet, so no box there.
- **Docs:** "Ready-made prompts", "Copy-paste requests in the app" and "Mock interviews in the chat" on `/docs/ai/agents`.
- **Tests:** a full interview in agent-writes mode (plan, a turn, a skip, end, grade, summary, listed with its score); the prompts: Read only filtering, arguments filled in, and every tool a prompt names exists (read-only prompts name only reading tools); the in-app requests name only real tools and carry the right ids (`lib/mcp/agent-prompts.test.ts`).

**Still to try:** a real interview in Claude Code and Claude Desktop, with RolePort's AI and with the agent writing; whether Codex and Cursor show the prompts.

## Sign in with ChatGPT ⏭️ Next

Many job seekers pay for ChatGPT Plus or Pro but have no API key and no computer that runs a good local model. OpenAI's **Sign in with ChatGPT** lets an app's AI requests count against the user's ChatGPT plan instead of an API key, and it's open to **open-source, locally hosted apps** with no approval or client secret. That describes self-hosted RolePort. Branch: `feat/chatgpt-sign-in`.

This is better for them than the MCP agent-writes mode: every AI button in RolePort works directly, with no agent in between. The agent mode stays for Claude users, since Claude has nothing like this.

### What it is

- **A new choice in Settings → AI provider: "ChatGPT (your plan)".** A **Sign in with ChatGPT** button opens the system browser to OpenAI's sign-in; the user approves using their plan; RolePort lists the models their account offers. After that, evaluations, tailored CVs, cover letters, emails, CV import, pasted jobs and the Interview Coach all use it.
- **Usage control is on OpenAI's side:** users see each app's usage and set a weekly cap for it in ChatGPT under Settings → Usage. RolePort links there and says so.
- **Self-hosted only.** Lite is a hosted website, which OpenAI puts on the separate commercial path (an interest form). Lite keeps API keys and the MCP agent route.

### How it works (from OpenAI's open-source docs)

- **Sign-in:** OAuth with PKCE in the system browser. `https://auth.openai.com/api/accounts/authorize` with `client_id=dynamic_agent_client` on the first sign-in (the callback returns the issued `client_id`, saved for later sign-ins), `agent_name_hint=RolePort`, a stable `ext_agent_host_id` per install (`urn:uuid:…` generated once), `scope=openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`, `resource=https://api.openai.com/v1`, fresh `state`, `nonce` and S256 `code_challenge`.
- **Callback:** `http://127.0.0.1:<port>/…` (not `localhost`; the path must stay the same). RolePort's own server can take it at e.g. `/api/chatgpt/callback` on its port. Exchange the code at `https://auth.openai.com/api/accounts/oauth/token` (form-encoded, no secret). Verify the ID token against OpenAI's JWKS (issuer, audience, expiry, nonce) and check `chatgpt.tokens.use.direct` was granted.
- **Tokens:** access tokens last an hour; refresh tokens last 30 days and are replaced on each refresh. Store them encrypted with `lib/secrets.ts`, like API keys, refresh before expiry, and never log them.
- **Calls:** `POST https://api.openai.com/v1/responses` with the access token as the bearer. Rules: `store: false`, `stream: true`, the full context in `input`, system text in `instructions`. Not allowed: `temperature`, `max_output_tokens`, `previous_response_id`, `metadata`, `user` and others on the preview limitations page. Models from `GET /v1/models` (those with `visibility == "list"`).
- **Errors:** `subscription_sharing_usage_limit_exceeded` and `subscription_sharing_usage_unavailable` can arrive as `response.failed` mid-stream; show "Your ChatGPT plan's limit for RolePort is used up" with the reset hint and a link to ChatGPT's usage settings. Don't retry in a loop.
- **Code:** a third provider in `generateStructured()` (`lib/ai/structured.ts`), next to Anthropic and OpenAI-compatible, reading the streamed Responses API. Everything after the model call (checks, saving) stays the same.

### Check first (day one)

1. **Structured output.** The docs don't say whether `text.format` with a JSON schema is allowed on this route. Every RolePort AI feature expects JSON matching a schema. Test with a real Plus account: if it works, use it; if not, ask for JSON in the instructions and use the existing "that didn't match the schema, reply again" retry the local-model path already has.
2. **Which plans work.** The developer quickstart says Plus and Pro; the help article says supported open-source tools are available to all ChatGPT users. Say "Plus or Pro" until a Free and a Go account have been tried.
3. **Reasoning effort.** Not documented for this route; check whether `reasoning.effort` is accepted before passing RolePort's per-task effort.
4. **The refresh request.** The token reference describes refreshing but the exact request is on another page ("Refreshing tokens"); read it before writing the refresh.
5. **Remote self-hosted servers.** The callback has to reach `127.0.0.1` on the computer whose browser signs in. Fine for RolePort on your own PC (Docker included, with the port published as now). For a VPS, read OpenAI's "Self-hosted VMs" page, or show a clear "sign in on the computer RolePort runs on" message.
6. **Branding.** Follow OpenAI's Sign in with ChatGPT UI guidelines for the button and the plan-usage wording.

**Done when:** on a self-hosted install with no API key, a user with a ChatGPT plan signs in from Settings, picks a model, evaluates a job, tailors a CV and drafts an email, and sees RolePort's usage in ChatGPT's usage settings; signing out (and disconnecting in ChatGPT) stops it; an exhausted weekly cap shows a clear message instead of an error.

Sources: [Using your ChatGPT plan in other apps](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites), [Quickstart](https://developers.openai.com/siwc/quickstart), [Open-source plan usage](https://developers.openai.com/siwc/token-sharing-open-source), [Sign in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [Token reference](https://developers.openai.com/siwc/token-sharing-open-source/token-reference). It's a preview, so check them again when starting.

## 5. Desktop app and the in-app AI agent

Most job seekers can't host a web app, run Docker or install Python. The desktop app is RolePort as a normal program: download the installer, double-click, use it. Everything stays on the user's computer, as with self-hosting. Branch: `feat/desktop-app`.

### 5A. Install and run with no setup 🚧

- **Electron**, because RolePort is a Next.js server with an embedded database and Electron already ships Node. (Tauri would still need Node bundled beside it, plus Rust.)
- **The server inside the app:** `next build` with `output: "standalone"` (only when `ROLEPORT_DESKTOP_BUILD=1`, so `next start`, Docker and Vercel are unchanged) makes a self-contained server folder (~93 MB) plus `public`, `.next/static` and `drizzle`. The app runs it in an Electron utility process on `127.0.0.1` only, at a fixed port (`47100`, the next free one if that's taken, so the browser storage that settings like voice use survives restarts).
- **Data** goes in the system's app-data folder (`%APPDATA%\RolePort` on Windows, `~/Library/Application Support/RolePort` on macOS, `~/.config/RolePort` on Linux), with the encryption key beside it. Uninstalling doesn't delete it; Settings says where it is.
- **One window, one copy:** a second launch focuses the open window (two copies can't share the database). Links to other sites open in the normal browser, including OpenAI's sign-in for Sign in with ChatGPT, which comes back to `127.0.0.1` on the app's port.
- **Its own folder** (`desktop/`) with its own `package.json`, so `npm install` for the web version doesn't download Electron. `npm run desktop` builds the server and opens the app; `npm run desktop:dist` makes the installer.
- **Installers:** Windows (NSIS `.exe`) first, then macOS (`.dmg`) and Linux (`.AppImage`) from a GitHub Actions workflow on release tags. Unsigned at first, so Windows SmartScreen and macOS Gatekeeper warn on first launch; the download page explains the click-through. Code signing (a Windows certificate, an Apple developer account) and auto-update come later.

**Done when:** on a Windows PC with nothing else installed, the installer puts RolePort in the Start menu, it opens in its own window, the profile, jobs and applications survive restarts and updates, and AI works with an API key or Ollama.

### 5B. LinkedIn, Indeed and more without Python or Docker

- **JobSpy as one program file:** a GitHub Actions job builds `services/jobspy/server.py` with PyInstaller into `jobspy-server` for Windows, macOS and Linux and attaches it to each release with its SHA-256.
- **Downloaded only when asked:** JobSpy stays opt-in (LinkedIn's and Indeed's terms forbid scraping). Turning the boards on in the desktop app's Settings shows the file, its size, where it comes from and where it will be stored, and downloads it only after the user agrees. The app checks the SHA-256, runs it on a private `127.0.0.1` port, tells RolePort's server where it is (`JOBSPY_URL`), and stops it on quit. **Remove** deletes it.

**Done when:** on a PC with no Python, turning on the boards downloads JobSpy after a clear prompt, and a LinkedIn search returns jobs.

### 5C. Job scout and apply assistant

The two desktop-only features below, once 5A and 5B are out.

### Recommendation: not a general chat agent. Build two narrow desktop-only features instead.

A general "chat with an agent that runs the app" mostly repeats what RolePort's one-click buttons already do. It also works poorly on the 12B local models RolePort promises to support, since their tool use is unreliable. And it adds cost and a new safety surface (the agent acting on postings that may contain injected instructions). career-ops is popular *because* it is an agent, but its users are developers in a terminal. RolePort's advantage is a clear app for everyone.

What a desktop app can do that the web can't, and where "agent-like" automation earns its place:

1. **Job scout (background):** while the app sits in the tray, it checks followed companies and saved searches on a schedule, scores new jobs with the quick match (no AI cost), runs the AI evaluation on the top few, and sends a desktop notification ("3 new strong fits"). It also re-checks that saved jobs are still open and flags follow-ups due today.
2. **Apply assistant:** opens the employer's application form in a window inside the app and fills it from the profile, tailored CV and saved answers. It uploads the CV PDF and highlights the fields it couldn't fill. **The user always presses Submit.** This is the autofill idea from the earlier roadmap, without a browser extension.

Cheap extras that ride the agent wave without building an agent:

- **An MCP server for RolePort** (search jobs, evaluate, tailor CV, draft an email, update the tracker). Users who already use Claude Desktop, Codex or another agent can drive RolePort from there. It's a small amount of code over functions RolePort already has, and it ships before the desktop app (see **MCP server** above).
- **Later, if users ask:** an "Ask about my search" panel that answers questions over the user's own data ("which applications need a follow-up?", "what skills do I keep missing?"), read-only, with actions confirmed through the normal buttons.

Desktop-only isn't required for any of this except the two features above. Keep everything else working in Lite and self-hosted.

---

## Order and size (rough)

| Step | Size | Depends on |
| --- | --- | --- |
| 0. Tests, fetch helper, address guard ✅ | S | — |
| 1A. Company feeds + Companies I follow ✅ | L | 0 |
| 2. Paste a job ✅ | M | 0 (1A for supported links) |
| 3A. Email application + contacts ✅ | M | — |
| 3B. Follow-ups ✅ | M | 3A |
| 1B. Government and remote feeds ✅ (more to come) | M (per source: S) | 0 |
| 1C. Contributor kit ✅ | S | 1A |
| MCP server ✅ | S–M | — |
| MCP: Interview Coach and prompts ✅ | S | MCP server |
| Sign in with ChatGPT | M | — (self-hosted only) |
| 4. Documentation page with search ✅ | M | 1C (sources table), ideally 2 and 3 so their pages are written once |
| 5. Desktop app: job scout, apply assistant | L | 1A, 2, 4 |

1B and 1C can run alongside 2 and 3, since they touch different files. The docs' framework, search and first pages can start any time; the pages for Phases 2 and 3 are finished as those ship.
