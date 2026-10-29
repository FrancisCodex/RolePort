import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "@/test/mock-fetch";

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);

const { assertPublicUrl, isPrivateAddress, safeFetchText, UnsafeUrlError } = await import("./safe-url");

function resolvesTo(table: Record<string, string[]>) {
  dns.lookup.mockImplementation(async (host: string) => {
    if (!table[host]) throw new Error("ENOTFOUND");
    return table[host].map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  });
}

beforeEach(() => resolvesTo({ "jobs.example.com": ["93.184.216.34"] }));

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::6810:85e5", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it("accepts a public https link", async () => {
    await expect(assertPublicUrl("https://jobs.example.com/apply/1")).resolves.toBeInstanceOf(URL);
  });

  it.each([
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://2130706433/", // 127.0.0.1 written as a number
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://printer.local/",
    "http://intranet/",
    "file:///etc/passwd",
    "ftp://jobs.example.com/",
    "https://user:pass@jobs.example.com/",
    "https://jobs.example.com:8080/",
    "not a url",
  ])("refuses %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toThrow(UnsafeUrlError);
  });

  it("refuses a public-looking name that resolves to a private address", async () => {
    resolvesTo({ "sneaky.example.com": ["93.184.216.34", "10.0.0.5"] });
    await expect(assertPublicUrl("https://sneaky.example.com/")).rejects.toThrow(/private/);
  });

  it("explains a name that doesn't resolve", async () => {
    await expect(assertPublicUrl("https://nope.example.org/")).rejects.toThrow(/Couldn't find/);
  });
});

describe("safeFetchText", () => {
  it("checks every redirect", async () => {
    mockFetch({ status: 302, headers: { location: "http://127.0.0.1/admin" } });
    await expect(safeFetchText("https://jobs.example.com/1")).rejects.toThrow(/private/);
  });

  it("follows a public redirect and caps the body", async () => {
    const { calls } = mockFetch(
      { status: 301, headers: { location: "/job/1" } },
      { body: "x".repeat(5000), headers: { "content-type": "text/html" } },
    );
    const result = await safeFetchText("https://jobs.example.com/old", { maxBytes: 1000 });
    expect(calls.map((u) => u.pathname)).toEqual(["/old", "/job/1"]);
    expect(result).toMatchObject({ url: "https://jobs.example.com/job/1", status: 200, contentType: "text/html" });
    expect(result.body).toHaveLength(1000);
  });
});
