import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closedNotice, findJobPosting, isPastDate, jobFromJsonLd, pageText, pageTitle } from "./page";

// A made-up careers page in the shape real ones use (lib/jobs/paste/__fixtures__).
const html = readFileSync(new URL("./__fixtures__/careers-page.html", import.meta.url), "utf8");

describe("reading a job page", () => {
  it("finds the JobPosting inside @graph and maps it", () => {
    const posting = findJobPosting(html);
    expect(posting).not.toBeNull();
    const job = jobFromJsonLd(posting!, "https://careers.example.com/jobs/42");
    expect(job).toMatchObject({
      source: "pasted",
      sourceId: "https://careers.example.com/jobs/42",
      url: "https://careers.example.com/jobs/42",
      title: "Customer Success Lead",
      company: "Example Outsourcing Inc.",
      companyLogo: "https://cdn.example.com/logo.png",
      location: "Taguig, Metro Manila, Philippines",
      employmentType: "full_time",
      salaryMin: 45000,
      salaryMax: 60000,
      salaryCurrency: "PHP",
      salaryPeriod: "month",
      skills: ["Zendesk", "Coaching", "Reporting"],
      postedAt: "2026-10-20T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
    });
    // Escaped HTML is decoded, then sanitized.
    expect(job.description).toContain("<strong>8 agents</strong>");
    expect(job.description).not.toContain("script");
  });

  it("reads remote postings and a hiring organization given as text", () => {
    const job = jobFromJsonLd(
      { "@type": "JobPosting", title: "Writer", hiringOrganization: "Acme", jobLocationType: "TELECOMMUTE", employmentType: "PART_TIME" },
      "https://acme.example/jobs/1",
    );
    expect(job).toMatchObject({ company: "Acme", workSetup: "remote", location: "Remote", employmentType: "part_time" });
  });

  it("returns null without a JobPosting, and skips broken JSON-LD", () => {
    expect(findJobPosting('<script type="application/ld+json">{ not json </script><p>Hello</p>')).toBeNull();
  });

  it("keeps the main text and drops scripts, styles and navigation", () => {
    const text = pageText(html);
    expect(text).toContain("Customer Success Lead\nLead a team of 8 agents.");
    expect(text).not.toMatch(/Home Jobs About|color:red|©/);
    expect(pageTitle(html)).toBe("Customer Success Lead | Example Outsourcing Inc.");
  });

  it("spots closed postings, but not a closing date", () => {
    expect(closedNotice("Sorry, this job is no longer available.")).toBe("this job is no longer available");
    expect(closedNotice("We are no longer accepting applications for this role.")).toBeTruthy();
    expect(closedNotice("This position has been filled.")).toBeTruthy();
    expect(closedNotice("Applications close on 30 November. Apply now!")).toBeNull();
  });

  it("treats a closing date as the whole day", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    expect(isPastDate("2026-10-29T00:00:00.000Z", now)).toBe(false);
    expect(isPastDate("2026-10-28T00:00:00.000Z", now)).toBe(true);
    expect(isPastDate("2026-10-29T09:00:00.000Z", now)).toBe(true);
    expect(isPastDate(null, now)).toBe(false);
  });
});
