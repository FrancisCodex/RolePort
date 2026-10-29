# RolePort: next roadmap (after the Interview Coach)

Goal: RolePort works for job seekers in any country. The Philippines stays the default and the first market.

Order: **1. More job sources → 2. Paste a job → 3. Email applications and follow-ups → 4. Desktop app (and the agent question)**.
Each step ships on its own branch and works in self-hosted and Lite, unless it says otherwise.

## Status

| Phase | Status | Branch |
| --- | --- | --- |
| 0. Groundwork: tests, fetch helper, private-address guard | ✅ Built | `feat/more-job-sources` |
| 1A. Company job-board feeds, Companies I follow, starter lists | ✅ Built (closed-job check moved to Phase 2) | `feat/more-job-sources` |
| 1B. Official boards and remote feeds | ✅ Built: Remotive, Remote OK, Himalayas, Arbeitnow, Platsbanken. Others are waiting, see 1B | `feat/more-job-sources` |
| 1C. Contributor kit | ✅ Built | `feat/more-job-sources` |
| Extra: old and ghost postings hidden, past month by default | ✅ Built | `feat/more-job-sources` |
| 2. Paste a job (and "still open" checks) | Next | — |
| 3. Email applications and follow-ups | Not started | — |
| MCP server | Not started | — |
| 4. Desktop app: job scout, apply assistant | Not started | — |

---

## 0. Groundwork (small, do first)

Built. `npm test` runs Vitest; `lib/jobs/sources/http.ts` and `lib/net/safe-url.ts` hold the helper and the guard.

- **Tests for sources.** Add Vitest. Each source gets a test against a saved sample response in `lib/jobs/sources/__fixtures__/`, never a live site, so CI never depends on a job board being up.
- **Shared fetch helper** (`lib/jobs/sources/http.ts`): timeout, retry with backoff, a host allowlist, a page cap and a polite delay between pages. Every new source uses it.
- **Block private addresses.** Any URL that comes from a user (careers pages, pasted jobs) goes through a guard that refuses `localhost`, private IPs and cloud metadata addresses, both before and after DNS lookup. Phases 1 and 2 need this, especially on the hosted Lite relay.

## 1. More job sources

Three kinds of source, in this order. Each one is one file in `lib/jobs/sources/` implementing `JobSource`, with `covers(country)`.

### 1A. Company job-board feeds + "Companies I follow" (built)

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
- **Still open (moved to Phase 2):** a job from a feed is open while it's still in its company's feed. Saved and applied jobs show "Closed" when it disappears. Built together with Phase 2's "Check again", so both kinds of job share one check.
- **Lite:** the search relay (`/api/lite/search`) fetches the feeds with the host allowlist above. Followed companies live in the browser's database like everything else.
- **Porting:** career-ops (MIT) has working modules for these in `providers/*.mjs`. Port the logic to TypeScript and credit it in `THIRD_PARTY_NOTICES.md`.

### 1B. Country-wide official sources and remote feeds

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

### 1C. Make it easy for contributors to add sources (built)

- **One registry:** a new source is one file, one fixture test and one line in `lib/jobs/sources/registry.ts` (no edit to `search.ts`). A test fails if a source file isn't listed. Bundlers can't load files by name at runtime, so this is the closest safe version.
- **README table from metadata:** each source declares `kind`, `coverage` and `needs`; `npm run docs:sources` writes the README's "Job sources" table, and a test fails when it's out of date.
- **Issue template** "Propose a job source" (`.github/ISSUE_TEMPLATE/job-source.yml`).
- **Source policy** in `docs/ADDING_A_JOB_SOURCE.md`: core sources use official APIs, open data or pages `robots.txt` allows, identify as RolePort, and never work around a refusal. A board's internal website API only goes behind the opt-in, self-hosted-only setting, like JobSpy.

**Done when:** you can follow a company by pasting its careers URL, its jobs show up in search, closed jobs are marked, and there are fixture tests for every source. *(All done except closed jobs, which moved to Phase 2 so pasted jobs share the same check.)*

## 2. Paste a job

One input on **Jobs** (and on the home page): "Paste a job link or the job description".

1. **A link from a supported hiring system** (Greenhouse, Lever and the others): fetch the posting through that source. You get structured data and the "still open" check, and RolePort offers "Follow this company".
2. **Any other link:** fetch that one page (it passes the private-address guard, follows at most 3 redirects, is capped at 2 MB, and isn't fetched again within 1 hour). Read the `schema.org/JobPosting` JSON-LD most careers pages include. If it isn't there, extract the page text.
3. **Pasted text, or a link that can't be read** (LinkedIn, Facebook groups, OnlineJobs.ph, a recruiter's email): the AI pulls out title, company, location, work setup, salary and requirements with `generateStructured()`. Code checks that every extracted value appears in the pasted text. Anything that fails is left empty for the user to fill in.
4. **Review screen:** the user checks the fields, then **Save**, **Evaluate fit** or **Apply**. From there it's the same pipeline as any job (`source: "pasted"`). The text is treated as untrusted input, with the same prompt-injection guard as postings.

- **Still open, for pasted links:** "Check again" on the job page. It's closed if the page returns 404/410, the JSON-LD `validThrough` date has passed, or the page says it's no longer accepting applications.
- **Lite:** fetching a link goes through the server relay with the same guard. Pasting text needs no server at all.

**Done when:** a Greenhouse link, a company page with JSON-LD and a pasted LinkedIn description each end up as a saved, evaluated job.

## 3. Email applications and follow-ups (reaching people directly)

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

**Done when:** from an applied job you can produce an application email and a follow-up after 7 days, mark both as sent, and see the next one on the dashboard.

## 4. Desktop app and the in-app AI agent

### Recommendation: not a general chat agent. Build two narrow desktop-only features instead.

A general "chat with an agent that runs the app" mostly repeats what RolePort's one-click buttons already do. It also works poorly on the 12B local models RolePort promises to support, since their tool use is unreliable. And it adds cost and a new safety surface (the agent acting on postings that may contain injected instructions). career-ops is popular *because* it is an agent, but its users are developers in a terminal. RolePort's advantage is a clear app for everyone.

What a desktop app can do that the web can't, and where "agent-like" automation earns its place:

1. **Job scout (background):** while the app sits in the tray, it checks followed companies and saved searches on a schedule, scores new jobs with the quick match (no AI cost), runs the AI evaluation on the top few, and sends a desktop notification ("3 new strong fits"). It also re-checks that saved jobs are still open and flags follow-ups due today.
2. **Apply assistant:** opens the employer's application form in a window inside the app and fills it from the profile, tailored CV and saved answers. It uploads the CV PDF and highlights the fields it couldn't fill. **The user always presses Submit.** This is the autofill idea from the earlier roadmap, without a browser extension.

Cheap extras that ride the agent wave without building an agent:

- **An MCP server for RolePort** (search jobs, evaluate, tailor CV, draft an email, update the tracker). Users who already use Claude Desktop, Codex or another agent can drive RolePort from there. It's a small amount of code over functions RolePort already has, and it can ship before the desktop app.
- **Later, if users ask:** an "Ask about my search" panel that answers questions over the user's own data ("which applications need a follow-up?", "what skills do I keep missing?"), read-only, with actions confirmed through the normal buttons.

Desktop-only isn't required for any of this except the two features above. Keep everything else working in Lite and self-hosted.

---

## Order and size (rough)

| Step | Size | Depends on |
| --- | --- | --- |
| 0. Tests, fetch helper, address guard ✅ | S | — |
| 1A. Company feeds + Companies I follow ✅ | L | 0 |
| 2. Paste a job | M | 0 (1A for supported links) |
| 3A. Email application + contacts | M | — |
| 3B. Follow-ups | M | 3A |
| 1B. Government and remote feeds ✅ (more to come) | M (per source: S) | 0 |
| 1C. Contributor kit ✅ | S | 1A |
| MCP server | S–M | — |
| 4. Desktop app: job scout, apply assistant | L | 1A, 2 |

1B and 1C can run alongside 2 and 3, since they touch different files.
