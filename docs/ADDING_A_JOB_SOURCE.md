# Adding a job source

RolePort is for job seekers in every country, and most countries have a board or two that publishes its jobs openly. If you know one, adding it helps everyone there. Not a coder? [Propose a source](https://github.com/FrancisCodex/RolePort/issues/new?template=job-source.yml) instead and someone can build it.

## Which sources are allowed

**Core sources** (on by default, also searched by the hosted Lite relay) must use one of:

- an official, documented API or feed (with or without a free key),
- a government or public-service board's open data,
- pages that the site's `robots.txt` and terms allow to be read automatically.

And they must:

- send no anti-bot workarounds: no faked browser or app identities, no rotating addresses, no solving CAPTCHAs. Requests identify as RolePort (`USER_AGENT` in `sources/http.ts`).
- follow the source's terms: the credit and link it asks for (`attribution`, shown on every job), how often it may be called (cache for longer if it asks), and anything it forbids.

**A board's internal website API** (the private calls its own site makes, like JobStreet's or Kalibrr's) is never a core source. It can only go behind the same opt-in, self-hosted-only setting as JobSpy (`kind: "opt-in"`), off by default and never on the hosted relay.

If a board refuses plain requests (403 for RolePort's user agent, say), it isn't open: leave it out rather than working around it.

## The file

Each source is one file in `lib/jobs/sources/` that implements `JobSource` from `lib/jobs/types.ts`:

```ts
export const mySource: JobSource = {
  id: "myboard",
  label: "My Board",
  kind: "board",                            // "board" | "official" | "remote" | "company" | "opt-in"
  coverage: "Kenya",                        // where its jobs are, for the README's table
  needs: "A free key from My Board",        // leave out when it needs nothing
  attribution: { name: "My Board", url: "https://myboard.example" }, // shown on job pages
  enabled: (ctx) => true,                   // or require a key from ctx
  disabledNote: "Add a key in Settings…",   // shown when enabled() is false
  covers: (params) => params.country === "KE", // which searches it has anything for
  async search(params, ctx) {
    const raw = await fetchMyBoard(params.query);
    return raw.map(normalize);              // → NormalizedJob[]
  },
};
```

Then:

1. Add one line for it to `JOB_SOURCES` in `lib/jobs/sources/registry.ts`. The order there decides which source wins when two carry the same posting (the employer's own page first, then big aggregators, then official boards, then remote feeds). A test fails if a source file isn't listed.
2. Run `npm run docs:sources`. It rewrites the README's "Job sources" table from each source's `kind`, `coverage` and `needs`; a test fails if the table is out of date.
3. Add a docs page: `content/docs/job-sources/<id>.md` with `sources: <id>` in its front matter, plus one line in `lib/docs/nav.ts`. Say what it covers, how to set it up and its limits. The facts table is added from the source's metadata, and a test fails if a source has no page.

**Feeds that return everything** (a remote-jobs feed, a whole board) can map their postings with `emptyJob()` and filter them with `keepMatching()` from `sources/feed.ts`: it applies the search's words, country (including regions like "Europe" or "APAC" in remote postings), area, work setup and date. `remotive.ts` is a short example; `platsbanken.ts` is one where the board does the searching.

## Checklist

1. **Check the terms first.** Use an official or public API. Don't scrape sites whose terms forbid automated access (LinkedIn, Indeed, JobStreet, …). The one exception is `sources/jobspy.ts`: it's opt-in, self-hosted only (`JOBSPY_URL`), and off by default. Don't add other scrapers outside it.
2. **Cache responses.** For key-less sources, use `"use cache"` with `cacheLife("hours")` like `freehire.ts`. For sources that need a user's key, **don't** pass the key into a `"use cache"` function, because cache keys are stored in plain text. Use an in-memory cache like `jsearch.ts` does.
3. **Map every field you can** into `NormalizedJob`, especially `workSetup`, salary (with `salaryCurrency` and `salaryPeriod`), `skills` and `requirements`. Better data means better match scores. Set `postedAt` whenever the board gives a date, and `possiblyStale` when it says a posting is old or reposted: `searchAllSources` drops anything outside the user's date range (a month by default, three at most) and anything flagged stale (`lib/jobs/freshness.ts`). Pass `params.postedWithinDays` to the board too, if it can filter by date, so fewer old postings are downloaded.
4. **Sanitize descriptions** with `cleanDescription()` from `lib/jobs/html.ts`.
5. **Call the board with `fetchJson()` from `sources/http.ts`**, listing the hosts it may reach in `allowedHosts`. It enforces HTTPS, a timeout, retries on 429/5xx and redirects that stay on those hosts. For paginated boards use `fetchPages()`, which never reads more than 20 pages. A failing source should never break search: `searchAllSources` reports it as unavailable and shows the other sources' results.
6. **URLs from users** (a careers page, a pasted job link) must go through `assertPublicUrl()` or `safeFetchText()` in `lib/net/safe-url.ts`, which refuse local and private addresses.
7. **Add a test** in `lib/jobs/sources/sources.test.ts` or `feeds.test.ts` against a saved, made-up sample response in `lib/jobs/sources/__fixtures__/` (use `mockFetch()` and `fixture()` from `test/mock-fetch.ts`). Tests never call the live board. Run them with `npm test`.
8. **Keys:** if the source needs a key, add it to `SourceContext`, store it encrypted in `user_settings` (see the RapidAPI key), and add a field to the Settings page.
9. **Countries and locations:** map `params.country` (ISO code, see `lib/geo/countries.ts`) to the source's own country filter, and return `false` from `covers()` for countries the source doesn't have. In the Philippines `params.locationId` is an area from `lib/ph-locations.ts`; elsewhere `params.city` is free text. Fall back to the country's currency when a posting doesn't state one.

## Starter company lists

The "Popular employers" lists in **Follow companies** are one JSON file per country in `lib/companies/starters/` (`ph.json`, `de.json`, …, plus `remote.json` for companies hiring remotely across countries):

```json
[{ "name": "Example Labs", "ats": "greenhouse", "slug": "examplelabs" }]
```

- `ats` is one of `greenhouse`, `lever`, `ashby`, `smartrecruiters`, `workable`, `recruitee`, and `slug` is the company's name on it: the part after `jobs.lever.co/`, `job-boards.greenhouse.io/` and so on.
- Only add companies whose public job feed answers and that have open jobs in that country now. Opening the careers link in **Follow companies** and seeing the job count is enough to check.
- A new country is a new file plus one line in `STARTER_LISTS` in `lib/companies/starters.ts`. `npm test` checks every entry is well formed.
