import { describe, expect, it } from "vitest";
import { isFresh, MAX_POSTED_DAYS } from "./freshness";
import { parseJobSearch } from "./search-params";

const now = Date.parse("2026-10-29T00:00:00Z");
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

describe("isFresh", () => {
  it("keeps postings inside the chosen range and drops older ones", () => {
    expect(isFresh({ postedAt: daysAgo(10), possiblyStale: false }, 30, now)).toBe(true);
    expect(isFresh({ postedAt: daysAgo(40), possiblyStale: false }, 30, now)).toBe(false);
  });

  it("never shows anything older than three months, even with no range set", () => {
    expect(isFresh({ postedAt: daysAgo(MAX_POSTED_DAYS - 1), possiblyStale: false }, undefined, now)).toBe(true);
    expect(isFresh({ postedAt: daysAgo(200), possiblyStale: false }, undefined, now)).toBe(false);
    expect(isFresh({ postedAt: daysAgo(200), possiblyStale: false }, 365, now)).toBe(false);
  });

  it("drops postings a source flags as stale or reposted, and keeps undated ones", () => {
    expect(isFresh({ postedAt: daysAgo(1), possiblyStale: true }, 30, now)).toBe(false);
    expect(isFresh({ postedAt: null, possiblyStale: false }, 30, now)).toBe(true);
  });
});

describe("parseJobSearch date range", () => {
  const profile = { desiredRoles: ["Designer"], country: "PH" };
  it("defaults to the past month and only allows the listed ranges", () => {
    expect(parseJobSearch({}, profile).params.postedWithinDays).toBe(30);
    expect(parseJobSearch({ days: "90" }, profile).params.postedWithinDays).toBe(90);
    expect(parseJobSearch({ days: "365" }, profile).params.postedWithinDays).toBe(30);
  });
});
