import { describe, expect, it } from "vitest";
import { pastedLink } from "./types";
import { amountsIn, closeEnough, currencyIn, verifyExtraction, wordIn, type ExtractedJob } from "./verify";

const POSTING = `We're hiring! Senior Accountant – Acme Shared Services
Location: Ortigas, Pasig City (Hybrid, 3 days onsite)
Full-time | ₱60,000 - ₱80k per month

Qualifications:
• CPA license required
• 3+ years of experience in month-end close
• Experience with SAP is a plus`;

const found = (over: Partial<ExtractedJob> = {}): ExtractedJob => ({
  title: "Senior Accountant",
  company: "Acme Shared Services",
  location: "Ortigas, Pasig City",
  workSetup: "hybrid",
  employmentType: "full_time",
  salaryMin: 60000,
  salaryMax: 80000,
  salaryCurrency: "PHP",
  salaryPeriod: "month",
  requirements: [
    { text: "CPA license required", priority: "required" },
    { text: "3+ years of experience in month-end close", priority: "required" },
    { text: "Experience with SAP is a plus", priority: "preferred" },
  ],
  skills: ["SAP", "month-end close"],
  ...over,
});

describe("checking what the AI read", () => {
  it("keeps values that are in the text", () => {
    const job = verifyExtraction(found(), POSTING);
    expect(job).toMatchObject({
      title: "Senior Accountant",
      company: "Acme Shared Services",
      location: "Ortigas, Pasig City",
      workSetup: "hybrid",
      employmentType: "full_time",
      salaryMin: 60000,
      salaryMax: 80000,
      salaryCurrency: "PHP",
      salaryPeriod: "month",
      dropped: [],
    });
    expect(job.requirements).toHaveLength(3);
    expect(job.skills).toEqual(["SAP", "month-end close"]);
  });

  it("empties invented values and says which", () => {
    const job = verifyExtraction(
      found({
        title: "Senior Accounting Manager",
        company: "Acme Corp",
        workSetup: "remote",
        employmentType: "contract",
        salaryMax: 90000,
        requirements: [{ text: "Must have an MBA from a top school", priority: "required" }],
        skills: ["Go", "Excel"],
      }),
      POSTING,
    );
    expect(job).toMatchObject({ title: "", company: "", workSetup: null, employmentType: null, salaryMin: null, salaryMax: null, salaryCurrency: "" });
    expect(job.requirements).toEqual([]);
    expect(job.skills).toEqual([]);
    expect(job.dropped).toEqual(["job title", "company", "work setup", "employment type", "salary", "1 requirement"]);
  });

  it("drops pay in a currency the text doesn't show", () => {
    expect(verifyExtraction(found({ salaryCurrency: "USD" }), POSTING).salaryMin).toBeNull();
  });

  it("reads amounts the way postings write them", () => {
    expect([...amountsIn("₱60,000 - ₱80k, 1.5M, 45.000 EUR, $25/hr")]).toEqual(expect.arrayContaining([60000, 80000, 1500000, 45000, 25]));
    expect(currencyIn("PHP", "₱50,000")).toBe(true);
    expect(currencyIn("SGD", "S$5,000")).toBe(true);
    expect(currencyIn("EUR", "$5,000")).toBe(false);
  });

  it("matches whole words and near-copies", () => {
    expect(wordIn("Go", "Good communication")).toBe(false);
    expect(wordIn("C++", "Strong C++ skills")).toBe(true);
    expect(closeEnough("3+ years experience in month-end close", POSTING)).toBe(true);
    expect(closeEnough("Ten years of tax law", POSTING)).toBe(false);
  });
});

describe("pastedLink", () => {
  it("tells a link from text", () => {
    expect(pastedLink("  https://jobs.lever.co/acme/123  ")).toBe("https://jobs.lever.co/acme/123");
    expect(pastedLink("careers.acme.com/jobs/42")).toBe("https://careers.acme.com/jobs/42");
    expect(pastedLink("Senior Accountant at Acme")).toBeNull();
    expect(pastedLink("https://a.com/1\nhttps://b.com/2")).toBeNull();
  });
});
