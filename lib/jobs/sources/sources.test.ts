import { describe, expect, it } from "vitest";
import { fixture, mockFetch } from "@/test/mock-fetch";
import { freehireSource } from "./freehire";
import { jobicySource } from "./jobicy";

// Each source is tested against a saved sample response, never the live board.

describe("jobicy", () => {
  it("maps postings and drops ones older than the date filter", async () => {
    const { calls } = mockFetch({ body: fixture(import.meta.url, "jobicy-search.json") });
    const jobs = await jobicySource.search({ query: "React", country: "PH", postedWithinDays: 30 }, ctx);

    expect(calls[0].hostname).toBe("jobicy.com");
    expect(calls[0].searchParams.get("geo")).toBe("philippines");
    expect(calls[0].searchParams.get("tag")).toBe("react");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "jobicy",
      sourceId: "101",
      title: "Senior Frontend Engineer",
      company: "Example Labs",
      location: "Remote · Philippines, APAC",
      workSetup: "remote",
      employmentType: "full_time",
      salaryMin: 3000,
      salaryCurrency: "USD",
      salaryPeriod: "month",
    });
    expect(jobs[0].description).not.toContain("<script");
  });

  it("only covers remote searches in countries Jobicy knows", () => {
    expect(jobicySource.covers({ query: "", country: "PH" })).toBe(true);
    expect(jobicySource.covers({ query: "", country: "PH", city: "Cebu" })).toBe(false);
    expect(jobicySource.covers({ query: "", country: "PH", workSetup: "onsite" })).toBe(false);
  });
});

describe("freehire", () => {
  it("maps enrichment, falls back to the country's currency and flags stale postings", async () => {
    const { calls } = mockFetch({ body: fixture(import.meta.url, "freehire-search.json") });
    const [backend, analyst] = await freehireSource.search({ query: "engineer", country: "PH" }, ctx);

    expect(calls[0].pathname).toBe("/api/v1/agent/jobs/search");
    expect(calls[0].searchParams.get("countries")).toBe("ph");
    expect(backend).toMatchObject({
      sourceId: "example-labs-backend-engineer-1",
      workSetup: "hybrid",
      employmentType: "full_time",
      salaryCurrency: "PHP",
      salaryPeriod: "month",
      skills: ["TypeScript", "PostgreSQL"],
      requirements: [
        { text: "3+ years with Node.js", priority: "required" },
        { text: "Experience with Kafka", priority: "preferred" },
      ],
      possiblyStale: false,
    });
    expect(backend.description).not.toContain("onerror");
    expect(analyst).toMatchObject({ company: "Unknown company", workSetup: null, possiblyStale: true });
  });

  it("reports a failing board instead of returning nothing", async () => {
    mockFetch({ status: 404, body: "not found" });
    await expect(freehireSource.search({ query: "x", country: "PH" }, ctx)).rejects.toThrow(/404/);
  });
});

const ctx = { rapidApiKey: null, jobspyEnabled: false };
