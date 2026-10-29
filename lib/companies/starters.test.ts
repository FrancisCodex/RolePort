import { describe, expect, it } from "vitest";
import { boardCareersUrl, companyKey, findStarter, invalidStarters, REMOTE_LIST, STARTER_LISTS, starterListOrder } from "./starters";

describe("starter company lists", () => {
  it("are all well formed", () => {
    expect(invalidStarters()).toEqual([]);
    for (const [id, list] of Object.entries(STARTER_LISTS)) expect(list.length, id).toBeGreaterThan(2);
  });

  it("finds a listed company by key, and nothing else", () => {
    expect(findStarter("lever:palantir")).toMatchObject({ name: "Palantir", ats: "lever", slug: "palantir" });
    expect(findStarter("smartrecruiters:boschgroup")?.slug).toBe("BoschGroup");
    expect(findStarter("lever:not-on-a-list")).toBeNull();
    expect(companyKey({ ats: "smartrecruiters", slug: "BoschGroup" })).toBe("smartrecruiters:boschgroup");
  });

  it("offers the user's own countries first, then remote, then the rest", () => {
    const order = starterListOrder(["SG", "XX", "PH"]).map((l) => l.id);
    expect(order.slice(0, 3)).toEqual(["SG", "PH", REMOTE_LIST]);
    expect(new Set(order)).toEqual(new Set(Object.keys(STARTER_LISTS)));
    expect(starterListOrder([]).find((l) => l.id === "PH")?.label).toBe("Philippines");
  });

  it("links to the company's careers page on its hiring software", () => {
    expect(boardCareersUrl("greenhouse", "stripe")).toBe("https://job-boards.greenhouse.io/stripe");
    expect(boardCareersUrl("recruitee", "hostaway")).toBe("https://hostaway.recruitee.com");
  });
});
