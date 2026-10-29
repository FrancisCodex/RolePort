# RolePort: next roadmap (after the Interview Coach)

Goal: RolePort works for job seekers in any country. The Philippines stays the default and the first market.

Order: **1. More job sources → 2. Paste a job → 3. Email applications and follow-ups → 4. Desktop app (and the agent question)**.
Each step ships on its own branch and works in self-hosted and Lite, unless it says otherwise.

---

## 0. Groundwork (small, do first)

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
- **Starter lists:** an optional seed list of well-known employers per country (`lib/jobs/seed-companies/{country}.json`). It's contributed per country, and users can import it in one click.
- **Still open (moved to Phase 2):** a job from a feed is open while it's still in its company's feed. Saved and applied jobs show "Closed" when it disappears. Built together with Phase 2's "Check again", so both kinds of job share one check.
- **Lite:** the search relay (`/api/lite/search`) fetches the feeds with the host allowlist above. Followed companies live in the browser's database like everything else.
- **Porting:** career-ops (MIT) has working modules for these in `providers/*.mjs`. Port the logic to TypeScript and credit it in `THIRD_PARTY_NOTICES.md`.

### 1B. Country-wide official sources and remote feeds

- **Government job boards with open data:** Germany (Arbeitsagentur), Sweden (Platsbanken), Canada (Job Bank), Singapore (MyCareersFuture), Belgium (VDAB), US (USAJOBS, free key). Each one says which country it covers.
- **Philippines:** check PhilJobNet (DOLE) for an open feed. If there isn't one, there's no change: JSearch and JobSpy already cover the Philippines.
- **Remote feeds (RSS/JSON):** We Work Remotely, Remotive, RemoteOK, Himalayas, Arbeitnow.

### 1C. Make it easy for contributors to add sources

- Load sources by file name, so a new source is one file plus one fixture and no edit to `search.ts`.
- Generate the supported-sources table in the README from each source's metadata (`id`, label, countries, kind).
- Add an issue template "Propose a job source" (country, URL, how it's accessed, a link to its terms or robots.txt).
- Write the source policy into `docs/ADDING_A_JOB_SOURCE.md`. **Core sources** use public APIs, official feeds or pages that `robots.txt` allows, with no anti-bot workarounds. A board's **internal website API** (like JobStreet's and Kalibrr's) goes behind the same opt-in, self-hosted-only setting as JobSpy, never into core.

**Done when:** you can follow a company by pasting its careers URL, its jobs show up in search, closed jobs are marked, and there are fixture tests for every source.

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
| 0. Tests, fetch helper, address guard | S | — |
| 1A. Company feeds + Companies I follow | L | 0 |
| 2. Paste a job | M | 0 (1A for supported links) |
| 3A. Email application + contacts | M | — |
| 3B. Follow-ups | M | 3A |
| 1B. Government and remote feeds | M (per source: S) | 0 |
| 1C. Contributor kit | S | 1A |
| MCP server | S–M | — |
| 4. Desktop app: job scout, apply assistant | L | 1A, 2 |

1B and 1C can run alongside 2 and 3, since they touch different files.
