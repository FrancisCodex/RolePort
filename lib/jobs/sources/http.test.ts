import { describe, expect, it, vi } from "vitest";
import { mockFetch } from "@/test/mock-fetch";
import { fetchJson, fetchPages, hostAllowed, PAGE_CEILING, SourceHttpError } from "./http";

const opts = { allowedHosts: ["api.example.com", "*.boards.example"], retries: 2 };

describe("hostAllowed", () => {
  it("matches exact hosts and wildcard subdomains only", () => {
    expect(hostAllowed("api.example.com", opts.allowedHosts)).toBe(true);
    expect(hostAllowed("acme.boards.example", opts.allowedHosts)).toBe(true);
    expect(hostAllowed("boards.example", opts.allowedHosts)).toBe(false);
    expect(hostAllowed("evilboards.example", opts.allowedHosts)).toBe(false);
    expect(hostAllowed("api.example.com.evil.net", opts.allowedHosts)).toBe(false);
  });
});

describe("fetchJson", () => {
  it("refuses hosts and protocols the source didn't name", async () => {
    const { fn } = mockFetch({ body: {} });
    await expect(fetchJson("https://other.example.com/x", opts)).rejects.toThrow(SourceHttpError);
    await expect(fetchJson("http://api.example.com/x", opts)).rejects.toThrow(/HTTPS/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("retries a busy board, then succeeds", async () => {
    vi.useFakeTimers();
    const { calls } = mockFetch({ status: 503 }, { status: 429, headers: { "retry-after": "0" } }, { body: { ok: 1 } });
    const result = fetchJson<{ ok: number }>("https://api.example.com/jobs", opts);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(3);
    vi.useRealTimers();
  });

  it("doesn't retry a 404", async () => {
    const { calls } = mockFetch({ status: 404 });
    await expect(fetchJson("https://api.example.com/jobs", opts)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(1);
  });

  it("follows redirects on allowed hosts and refuses ones that leave them", async () => {
    mockFetch({ status: 301, headers: { location: "https://acme.boards.example/jobs" } }, { body: [1] });
    await expect(fetchJson("https://api.example.com/jobs", opts)).resolves.toEqual([1]);

    mockFetch({ status: 302, headers: { location: "http://169.254.169.254/latest" } });
    await expect(fetchJson("https://api.example.com/jobs", opts)).rejects.toThrow(/HTTPS/);
  });

  it("says when a board sends something that isn't JSON", async () => {
    mockFetch({ body: "<html>maintenance</html>" });
    await expect(fetchJson("https://api.example.com/jobs", opts)).rejects.toThrow(/isn't JSON/);
  });
});

describe("fetchPages", () => {
  it("stops at the last page, an empty page, or the ceiling", async () => {
    const pages = [[1, 2], [3], []];
    expect(await fetchPages(async (p) => ({ items: pages[p] }), { maxPages: 10, delayMs: 0 })).toEqual([1, 2, 3]);
    expect(await fetchPages(async (p) => ({ items: [p], done: p === 1 }), { maxPages: 10, delayMs: 0 })).toEqual([0, 1]);

    const seen: number[] = [];
    await fetchPages(async (p) => (seen.push(p), { items: [p] }), { maxPages: 1000, delayMs: 0 });
    expect(seen).toHaveLength(PAGE_CEILING);
  });
});
