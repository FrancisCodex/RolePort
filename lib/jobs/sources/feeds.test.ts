import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixture, mockFetch } from "@/test/mock-fetch";
import type { JobSearchParams } from "../types";
import { arbeitnowSource } from "./arbeitnow";
import { countryCode } from "./feed";
import { himalayasSource } from "./himalayas";
import { platsbankenQuery, platsbankenSource } from "./platsbanken";
import { JOB_SOURCES, HOSTED_SOURCES } from "./registry";
import { remoteOkSource } from "./remoteok";
import { remotiveSource } from "./remotive";

// The remote and official feeds, each against a saved, made-up sample in its real shape.

const ctx = { rapidApiKey: null, jobspyEnabled: false, companies: [] };
const search = (over: Partial<JobSearchParams> = {}): JobSearchParams => ({ query: "designer", country: "PH", ...over });
const titles = (jobs: { title: string }[]) => jobs.map((j) => j.title);

describe("remotive", () => {
  it("reads the whole feed once and keeps remote jobs open to the searcher's country", async () => {
    const { calls } = mockFetch({ body: fixture(import.meta.url, "remotive-jobs.json") });
    const jobs = await remotiveSource.search(search(), ctx);
    expect(calls[0].href).toBe("https://remotive.com/api/remote-jobs");
    // Worldwide and "Philippines, Singapore" are open to someone in the Philippines; Europe and the US aren't.
    expect(titles(jobs)).toEqual(["Product Designer", "Brand Designer"]);
    expect(jobs[0]).toMatchObject({ source: "remotive", sourceId: "501", workSetup: "remote", employmentType: "full_time", location: "Remote · Worldwide" });
    expect(jobs[0].postedAt).toBe("2026-10-20T08:00:00.000Z");
    expect(jobs[0].description).not.toContain("script");
    expect(jobs[0]).not.toHaveProperty("countries");
  });

  it("only covers searches open to remote work", () => {
    expect(remotiveSource.covers(search())).toBe(true);
    expect(remotiveSource.covers(search({ workSetup: "onsite" }))).toBe(false);
    expect(remotiveSource.covers(search({ country: "US", city: "Austin" }))).toBe(false);
  });
});

describe("remote ok", () => {
  it("skips the terms notice, reads yearly salaries and respects country limits", async () => {
    mockFetch({ body: fixture(import.meta.url, "remoteok-api.json") });
    const ph = await remoteOkSource.search(search(), ctx);
    expect(titles(ph)).toEqual(["Senior Designer"]);
    expect(ph[0]).toMatchObject({ salaryMin: 90000, salaryMax: 120000, salaryPeriod: "year", url: "https://remoteOK.com/remote-jobs/remote-designer-example-1" });
    const us = await remoteOkSource.search(search({ country: "US" }), ctx);
    expect(titles(us)).toEqual(["Senior Designer", "Designer"]);
  });
});

describe("himalayas", () => {
  it("maps country limits, salary and closing dates", async () => {
    const { calls } = mockFetch({ body: fixture(import.meta.url, "himalayas-search.json") });
    const jobs = await himalayasSource.search(search({ query: "Designer" }), ctx);
    expect(calls[0].searchParams.get("q")).toBe("designer");
    // Fewer than 20 results: no second page.
    expect(calls).toHaveLength(1);
    expect(titles(jobs)).toEqual(["Senior UX Designer", "UI Designer", "Designer"]);
    expect(jobs[0]).toMatchObject({ employmentType: "full_time", salaryMin: 60000, salaryPeriod: "year", location: "Remote · Philippines, Singapore, Malaysia and 1 more" });
    expect(jobs[2].possiblyStale).toBe(true);
  });

  it("keeps jobs limited to other countries out", async () => {
    mockFetch({ body: fixture(import.meta.url, "himalayas-search.json") });
    expect(titles(await himalayasSource.search(search({ country: "DE" }), ctx))).toEqual(["UI Designer"]);
  });
});

describe("arbeitnow", () => {
  it("covers Germany, decodes the escaped HTML and maps German job types", async () => {
    expect(arbeitnowSource.covers(search())).toBe(false);
    expect(arbeitnowSource.covers(search({ country: "DE" }))).toBe(true);
    mockFetch({ body: fixture(import.meta.url, "arbeitnow-page.json") });
    const jobs = await arbeitnowSource.search(search({ query: "", country: "DE" }), ctx);
    expect(jobs).toHaveLength(4); // two pages of the same sample
    expect(jobs[0]).toMatchObject({ city: "Berlin", location: "Berlin, Germany", employmentType: "full_time", workSetup: null, salaryCurrency: "EUR" });
    expect(jobs[0].description).toContain("<strong>TypeScript</strong>");
    expect(jobs[1]).toMatchObject({ employmentType: "part_time", workSetup: "remote", location: "München, Germany" });
  });
});

describe("platsbanken", () => {
  it("lets JobTech match the words and the date, and flags ads past their last day", async () => {
    const now = Date.parse("2026-10-29T00:00:00Z");
    const q = platsbankenQuery(search({ country: "SE", city: "Malmö", postedWithinDays: 30 }), now);
    expect(q.get("q")).toBe("designer Malmö");
    expect(q.get("published-after")).toBe("2026-09-29T00:00:00");
    expect(platsbankenQuery(search({ country: "SE", locationId: "remote" })).get("remote")).toBe("true");

    const { calls } = mockFetch({ body: fixture(import.meta.url, "platsbanken-search.json") });
    const [junior, temp] = await platsbankenSource.search(search({ country: "SE" }), ctx);
    expect(calls[0].hostname).toBe("jobsearch.api.jobtechdev.se");
    expect(junior).toMatchObject({ company: "Exempel AB", location: "Stockholm, Stockholms län, Sweden", employmentType: "full_time", salaryCurrency: "SEK", possiblyStale: false });
    expect(junior.description).toBe("<p>Du designar.</p><p>Vi erbjuder &lt;mycket&gt;.</p>");
    expect(temp).toMatchObject({ employmentType: "part_time", city: "Malmö", possiblyStale: true });
  });
});

describe("countryCode", () => {
  it("reads the names and codes feeds use", () => {
    expect(countryCode("Philippines")).toBe("PH");
    expect(countryCode("USA")).toBe("US");
    expect(countryCode("uk")).toBe("GB");
    expect(countryCode("de")).toBe("DE");
    expect(countryCode("Worldwide")).toBeNull();
  });
});

describe("source registry", () => {
  it("lists every source file in this folder", () => {
    const dir = new URL(".", import.meta.url);
    const registry = readFileSync(new URL("registry.ts", dir), "utf8");
    const sourceFiles = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "registry.ts" && /:\s*JobSource(\[\])?\s*=/.test(readFileSync(new URL(f, dir), "utf8")),
    );
    expect(sourceFiles.length).toBeGreaterThan(5);
    for (const file of sourceFiles) {
      expect(registry, `Add ${file} to lib/jobs/sources/registry.ts`).toContain(`from "./${file.replace(/\.ts$/, "")}"`);
    }
  });

  it("gives every source a unique id, a credit and its metadata, and keeps opt-in scrapers off the hosted relay", () => {
    const ids = JOB_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of JOB_SOURCES) {
      expect(s.attribution?.url, s.id).toMatch(/^https:\/\//);
      expect(s.coverage, s.id).toBeTruthy();
    }
    expect(HOSTED_SOURCES.some((s) => s.kind === "opt-in")).toBe(false);
  });
});
