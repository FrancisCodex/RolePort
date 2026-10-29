# Adding a job source

Each job board is one file in `lib/jobs/sources/` that implements `JobSource` from `lib/jobs/types.ts`:

```ts
export const mySource: JobSource = {
  id: "myboard",
  label: "My Board",
  attribution: { name: "My Board", url: "https://myboard.example" }, // shown on job pages
  enabled: (ctx) => true,                  // or require a key from ctx
  disabledNote: "Add a key in Settings…",  // shown when enabled() is false
  covers: (params) => true,                // e.g. remote-only boards return false for city searches
  async search(params, ctx) {
    const raw = await fetchMyBoard(params.query);
    return raw.map(normalize);             // → NormalizedJob[]
  },
};
```

Then add it to `JOB_SOURCES` in `lib/jobs/search.ts`. The order there decides which source wins when two carry the same posting.

## Checklist

1. **Check the terms first.** Use an official or public API. Don't scrape sites whose terms forbid automated access (LinkedIn, Indeed, JobStreet, …). The one exception is `sources/jobspy.ts`: it's opt-in, self-hosted only (`JOBSPY_URL`), and off by default. Don't add other scrapers outside it.
2. **Cache responses.** For key-less sources, use `"use cache"` with `cacheLife("hours")` like `freehire.ts`. For sources that need a user's key, **don't** pass the key into a `"use cache"` function, because cache keys are stored in plain text. Use an in-memory cache like `jsearch.ts` does.
3. **Map every field you can** into `NormalizedJob`, especially `workSetup`, salary (with `salaryCurrency` and `salaryPeriod`), `skills` and `requirements`. Better data means better match scores.
4. **Sanitize descriptions** with `cleanDescription()` from `lib/jobs/html.ts`.
5. **Call the board with `fetchJson()` from `sources/http.ts`**, listing the hosts it may reach in `allowedHosts`. It enforces HTTPS, a timeout, retries on 429/5xx and redirects that stay on those hosts. For paginated boards use `fetchPages()`, which never reads more than 20 pages. A failing source should never break search: `searchAllSources` reports it as unavailable and shows the other sources' results.
6. **URLs from users** (a careers page, a pasted job link) must go through `assertPublicUrl()` or `safeFetchText()` in `lib/net/safe-url.ts`, which refuse local and private addresses.
7. **Add a test** in `lib/jobs/sources/sources.test.ts` against a saved, made-up sample response in `lib/jobs/sources/__fixtures__/` (use `mockFetch()` and `fixture()` from `test/mock-fetch.ts`). Tests never call the live board. Run them with `npm test`.
8. **Keys:** if the source needs a key, add it to `SourceContext`, store it encrypted in `user_settings` (see the RapidAPI key), and add a field to the Settings page.
9. **Countries and locations:** map `params.country` (ISO code, see `lib/geo/countries.ts`) to the source's own country filter, and return `false` from `covers()` for countries the source doesn't have. In the Philippines `params.locationId` is an area from `lib/ph-locations.ts`; elsewhere `params.city` is free text. Fall back to the country's currency when a posting doesn't state one.
