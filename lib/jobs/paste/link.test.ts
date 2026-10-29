import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixture, mockFetch } from "@/test/mock-fetch";

vi.mock("server-only", () => ({}));
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);

const { checkPosting, readJobLink } = await import("./link");
const { BOARDS } = await import("@/lib/jobs/sources/companies");

const sources = (name: string) => fixture(new URL("../sources/x", import.meta.url).href, name) as Record<string, unknown>;
const page = readFileSync(new URL("./__fixtures__/careers-page.html", import.meta.url), "utf8");

beforeEach(() => dns.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]));

describe("reading a pasted link", () => {
  it("reads a Greenhouse posting from Greenhouse and offers to follow the company", async () => {
    const posting = (sources("greenhouse-jobs.json").jobs as unknown[])[0];
    const { calls } = mockFetch({ body: posting });
    const result = await readJobLink("https://job-boards.greenhouse.io/examplelabs/jobs/1001");
    expect(calls[0].href).toBe("https://boards-api.greenhouse.io/v1/boards/examplelabs/jobs/1001");
    expect(result.ok && result.data.kind === "review" && result.data.review).toMatchObject({
      how: "board",
      job: { source: "greenhouse", sourceId: "examplelabs:1001", company: "Example Labs" },
      board: { ats: "greenhouse", label: "Greenhouse", name: "Example Labs" },
      check: { status: "open" },
    });
  });

  it("says a posting that's gone from its hiring system is probably closed", async () => {
    mockFetch({ status: 404, body: { ok: false } });
    const result = await readJobLink("https://jobs.lever.co/samplehq/0c3a1d2e-0000-4000-8000-000000000000");
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("probably closed") });
  });

  it("finds a posting in the whole feed when the hiring system has no single-posting endpoint", async () => {
    const board = sources("ashby-board.json") as { jobs: { id: string }[] };
    mockFetch({ body: board });
    const result = await readJobLink(`https://jobs.ashbyhq.com/acmeai/${board.jobs[0].id}/application`);
    expect(result.ok && result.data.kind === "review" && result.data.review.job).toMatchObject({ source: "ashby", company: "Acmeai" });
  });

  it("doesn't read sites whose terms forbid it", async () => {
    const { calls } = mockFetch({ body: "" });
    const result = await readJobLink("https://www.linkedin.com/jobs/view/123");
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("paste the text") });
    expect(calls).toHaveLength(0);
  });

  it("reads a careers page's JobPosting", async () => {
    mockFetch({ body: page, headers: { "content-type": "text/html" } });
    const result = await readJobLink("https://careers.example.com/jobs/customer-success-lead");
    expect(result.ok && result.data.kind === "review" && result.data.review).toMatchObject({
      how: "page",
      job: { title: "Customer Success Lead", company: "Example Outsourcing Inc.", url: "https://careers.example.com/jobs/customer-success-lead" },
    });
  });

  it("refuses private addresses", async () => {
    const result = await readJobLink("http://192.168.1.1/jobs/1");
    expect(result.ok).toBe(false);
  });
});

describe("checking a saved job is still open", () => {
  it("closes a pasted link whose page is gone", async () => {
    mockFetch({ status: 404, body: "Not found" });
    const check = await checkPosting({ source: "pasted", sourceId: "x", url: "https://gone.example.com/jobs/1" });
    expect(check).toMatchObject({ status: "closed" });
  });

  it("closes a company-feed job that's left the feed", async () => {
    mockFetch({ body: sources("workable-account.json") });
    const check = await checkPosting({ source: "workable", sourceId: "acme:NOTTHERE", url: "https://apply.workable.com/acme/j/NOTTHERE/" });
    expect(check).toMatchObject({ status: "closed" });
  });

  it("keeps a company-feed job open while it's listed", async () => {
    const feed = sources("workable-account.json") as { jobs: { shortcode: string }[] };
    mockFetch({ body: feed });
    const check = await checkPosting({ source: "workable", sourceId: `acme:${feed.jobs[0].shortcode}`, url: "https://apply.workable.com/" });
    expect(check).toMatchObject({ status: "open" });
  });
});

describe("posting ids in links", () => {
  it.each([
    ["greenhouse", "https://job-boards.greenhouse.io/acme/jobs/4012345", "4012345"],
    ["greenhouse", "https://careers.acme.com/open-roles?gh_jid=4012345", "4012345"],
    ["lever", "https://jobs.lever.co/acme/0c3a1d2e-aaaa-4bbb-8ccc-123456789abc/apply", "0c3a1d2e-aaaa-4bbb-8ccc-123456789abc"],
    ["ashby", "https://jobs.ashbyhq.com/acme/0c3a1d2e-aaaa-4bbb-8ccc-123456789abc", "0c3a1d2e-aaaa-4bbb-8ccc-123456789abc"],
    ["smartrecruiters", "https://jobs.smartrecruiters.com/Acme/744000012345678-backend-engineer", "744000012345678"],
    ["workable", "https://apply.workable.com/acme/j/AB12CD34EF/", "AB12CD34EF"],
    ["recruitee", "https://acme.recruitee.com/o/backend-engineer", "backend-engineer"],
    ["lever", "https://jobs.lever.co/acme", null],
  ] as const)("%s: %s", (ats, link, id) => {
    expect(BOARDS[ats].postingId(new URL(link))).toBe(id);
  });
});
