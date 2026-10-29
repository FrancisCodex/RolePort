import { describe, expect, it } from "vitest";
import { fixture, mockFetch } from "@/test/mock-fetch";
import type { JobSearchParams } from "../../types";
import { isCompanyBrowse, parseCompanyBrowse } from "../../search-params";
import { BOARDS, boardFromHtml, boardFromUrl, COMPANY_SOURCES, readCompanyJobs } from "./index";
import { matchesSearch } from "./match";
import type { CompanyJob, CompanyRef } from "./types";

// Saved, made-up responses in each board's real shape (lib/jobs/sources/__fixtures__).
const fx = (name: string) => fixture(new URL("../x", import.meta.url).href, name);
const ph = (over: Partial<JobSearchParams> = {}): JobSearchParams => ({ query: "", country: "PH", ...over });

describe("company boards", () => {
  it("greenhouse: decodes escaped HTML and sanitizes it", async () => {
    const { calls } = mockFetch({ body: fx("greenhouse-jobs.json") });
    const { name, jobs } = await BOARDS.greenhouse.fetchJobs("examplelabs", {});
    expect(calls[0].href).toBe("https://boards-api.greenhouse.io/v1/boards/examplelabs/jobs?content=true");
    expect(name).toBe("Example Labs");
    expect(jobs[0]).toMatchObject({ source: "greenhouse", sourceId: "examplelabs:1001", location: "Manila, Philippines", team: "Engineering" });
    expect(jobs[0].description).toContain("<strong>payments</strong>");
    expect(jobs[0].description).not.toContain("script");
    expect(jobs[1].workSetup).toBe("remote");
  });

  it("lever: workplace, salary, country and the lists in the description", async () => {
    mockFetch({ body: fx("lever-postings.json") });
    const { jobs } = await BOARDS.lever.fetchJobs("samplehq", {});
    expect(jobs[0]).toMatchObject({
      workSetup: "hybrid",
      employmentType: "full_time",
      salaryMin: 8000,
      salaryCurrency: "SGD",
      salaryPeriod: "month",
      countries: ["SG"],
      team: "Product Engineering",
    });
    expect(jobs[0].description).toContain("3+ years of React");
    expect(jobs[1]).toMatchObject({ employmentType: "internship", workSetup: "onsite", city: "Cebu City" });
  });

  it("ashby: skips unlisted jobs and reads salary and countries", async () => {
    mockFetch({ body: fx("ashby-board.json") });
    const { jobs } = await BOARDS.ashby.fetchJobs("acmeai", {});
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ workSetup: "remote", salaryMin: 70000, salaryCurrency: "GBP", salaryPeriod: "year", countries: ["GB", "PH"] });
  });

  it("smartrecruiters: filters on the board's side and builds the job link", async () => {
    const { calls } = mockFetch({ body: fx("smartrecruiters-postings.json") });
    const { name, jobs } = await BOARDS.smartrecruiters.fetchJobs("ExampleGroup", { query: "engineer", country: "PH" });
    expect(calls[0].searchParams.get("q")).toBe("engineer");
    expect(calls[0].searchParams.get("country")).toBe("ph");
    expect(calls).toHaveLength(1); // totalFound fits on one page
    expect(name).toBe("Example Group");
    expect(jobs[0]).toMatchObject({ url: "https://jobs.smartrecruiters.com/ExampleGroup/744000000000001", workSetup: "hybrid", countries: ["PH"], team: "Engineering" });
  });

  it("workable: company name and remote flag", async () => {
    mockFetch({ body: fx("workable-account.json") });
    const { name, jobs } = await BOARDS.workable.fetchJobs("samplestudio", {});
    expect(name).toBe("Sample Studio");
    expect(jobs[0]).toMatchObject({ workSetup: "remote", countries: ["FR"], location: "Paris, Île-de-France, France" });
  });

  it("recruitee: reads the company's subdomain and skips drafts", async () => {
    const { calls } = mockFetch({ body: fx("recruitee-offers.json") });
    const { jobs } = await BOARDS.recruitee.fetchJobs("examplestays", {});
    expect(calls[0].hostname).toBe("examplestays.recruitee.com");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ salaryMin: 60000, salaryPeriod: "year", countries: ["US", "CA"], postedAt: "2026-10-22T13:10:36.000Z" });
  });
});

describe("boardFromUrl", () => {
  it.each([
    ["https://boards.greenhouse.io/examplelabs", "greenhouse", "examplelabs"],
    ["https://job-boards.greenhouse.io/examplelabs/jobs/123", "greenhouse", "examplelabs"],
    ["https://boards.greenhouse.io/embed/job_board?for=examplelabs", "greenhouse", "examplelabs"],
    ["https://jobs.lever.co/samplehq/a1b2c3/apply", "lever", "samplehq"],
    ["https://jobs.ashbyhq.com/acmeai", "ashby", "acmeai"],
    ["https://careers.smartrecruiters.com/ExampleGroup", "smartrecruiters", "ExampleGroup"],
    ["https://jobs.smartrecruiters.com/ExampleGroup/744000000000001", "smartrecruiters", "ExampleGroup"],
    ["https://apply.workable.com/samplestudio/", "workable", "samplestudio"],
    ["https://examplestays.recruitee.com/o/some-role", "recruitee", "examplestays"],
  ])("%s", (url, ats, slug) => expect(boardFromUrl(new URL(url))).toEqual({ ats, slug }));

  it.each(["https://example.com/careers", "https://apply.workable.com/j/ABC123", "https://www.recruitee.com/", "https://jobs.lever.co/"])(
    "doesn't guess for %s",
    (url) => expect(boardFromUrl(new URL(url))).toBeNull(),
  );
});

describe("boardFromHtml", () => {
  it("finds an embedded board on a company's own careers page", () => {
    const html = `<div id="grnhse_app"></div><script src="https://boards.greenhouse.io/embed/job_board/js?for=examplelabs&amp;b=x"></script>`;
    expect(boardFromHtml(html)).toEqual({ ats: "greenhouse", slug: "examplelabs" });
    expect(boardFromHtml(`<a href="https://jobs.lever.co/samplehq">Open roles</a>`)).toEqual({ ats: "lever", slug: "samplehq" });
    expect(boardFromHtml(`<a href="https://example.com/jobs">Jobs</a>`)).toBeNull();
  });
});

describe("matchesSearch", () => {
  const job = (over: Partial<CompanyJob>): CompanyJob => ({
    source: "greenhouse",
    sourceId: "x",
    url: "https://example.com",
    title: "Backend Engineer",
    company: "Example",
    companyLogo: null,
    location: null,
    city: null,
    workSetup: null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "USD",
    salaryPeriod: null,
    description: "<p>TypeScript and Postgres</p>",
    summary: null,
    skills: [],
    requirements: [],
    postedAt: null,
    possiblyStale: false,
    countries: [],
    team: null,
    ...over,
  });

  it("keeps jobs in the country, by code or by name", () => {
    expect(matchesSearch(job({ countries: ["PH"] }), ph())).toBe(true);
    expect(matchesSearch(job({ location: "Makati, Philippines" }), ph())).toBe(true);
    expect(matchesSearch(job({ location: "Austin, Texas" }), ph())).toBe(false);
    expect(matchesSearch(job({ countries: ["US"], location: "Austin" }), ph())).toBe(false);
  });

  it("keeps remote jobs open to anyone, not ones tied to another country", () => {
    expect(matchesSearch(job({ workSetup: "remote", location: "Remote, APAC" }), ph())).toBe(true);
    expect(matchesSearch(job({ workSetup: "remote", location: "Remote - United States" }), ph())).toBe(false);
    expect(matchesSearch(job({ workSetup: "onsite", location: "London" }), ph({ locationId: "remote" }))).toBe(false);
  });

  it("matches every word searched for in the title, team or description", () => {
    const j = job({ countries: ["PH"] });
    expect(matchesSearch(j, ph({ query: "backend typescript" }))).toBe(true);
    expect(matchesSearch(j, ph({ query: "backend golang" }))).toBe(false);
  });

  it("narrows to a Philippine area, and drops old postings", () => {
    expect(matchesSearch(job({ countries: ["PH"], location: "Cebu City, Philippines" }), ph({ locationId: "metro-manila" }))).toBe(false);
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    expect(matchesSearch(job({ countries: ["PH"], postedAt: old }), ph({ postedWithinDays: 30 }))).toBe(false);
  });

  it("without a country or words, keeps every job (the companies view)", () => {
    expect(matchesSearch(job({ location: "Austin, Texas" }), {})).toBe(true);
    expect(matchesSearch(job({ countries: ["US"] }), { workSetup: "remote" })).toBe(false);
  });
});

describe("readCompanyJobs", () => {
  it("lists every open job at the followed companies on one board, filtered without a search", async () => {
    mockFetch({ body: fx("greenhouse-jobs.json") });
    const jobs = await readCompanyJobs("greenhouse", [{ ats: "greenhouse", slug: "examplelabs", name: "Example Labs" }, { ats: "lever", slug: "other", name: "Other" }], {});
    expect(jobs.length).toBeGreaterThan(1);
    expect(new Set(jobs.map((j) => j.company))).toEqual(new Set(["Example Labs"]));
  });
});

describe("parseCompanyBrowse", () => {
  it("reads the view from the URL, with no country or words needed and newest first", () => {
    expect(isCompanyBrowse({ view: "companies" })).toBe(true);
    expect(isCompanyBrowse({ q: "engineer" })).toBe(false);
    expect(parseCompanyBrowse({ view: "companies", company: "abc" })).toEqual({
      company: "abc",
      query: "",
      country: undefined,
      workSetup: undefined,
      postedWithinDays: undefined,
      sort: "date",
    });
    expect(parseCompanyBrowse({ country: "sg", setup: "remote", days: "7", sort: "match", q: "design" })).toMatchObject({
      country: "SG",
      workSetup: "remote",
      postedWithinDays: 7,
      sort: "match",
      query: "design",
    });
    expect(parseCompanyBrowse({ country: "nowhere", setup: "beach", days: "5" })).toMatchObject({ country: undefined, workSetup: undefined, postedWithinDays: undefined });
  });
});

describe("company sources", () => {
  const ctx = (companies: CompanyRef[]) => ({ rapidApiKey: null, jobspyEnabled: false, companies });
  const gh = COMPANY_SOURCES.find((s) => s.id === "greenhouse")!;

  it("stay off and out of the source list until a company is followed", () => {
    expect(gh.enabled(ctx([]))).toBe(false);
    expect(gh.listWhenOff).toBe(false);
    expect(gh.enabled(ctx([{ ats: "greenhouse", slug: "examplelabs", name: "Example Labs" }]))).toBe(true);
  });

  it("return the followed company's jobs that fit the search, under the name the user follows", async () => {
    mockFetch({ body: fx("greenhouse-jobs.json") });
    const jobs = await gh.search(ph({ query: "engineer" }), ctx([{ ats: "greenhouse", slug: "examplelabs", name: "Example Labs Inc." }]));
    expect(jobs.map((j) => j.title)).toEqual(["Senior Backend Engineer", "Support Engineer"]);
    expect(jobs[0].company).toBe("Example Labs Inc.");
    expect(jobs[0]).not.toHaveProperty("countries");
  });
});
