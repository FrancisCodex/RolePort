import { describe, expect, it } from "vitest";
import { cleanExtractedSections, fitProfileLimits } from "@/lib/ai/extract-profile";
import { DEFAULT_PROFILE_PROMPT, profileSystemPrompt, PROFILE_FIXED_RULES, withSection, withWrittenSummary } from "@/lib/ai/profile-prompt";
import { candidateBlock, sourceOf } from "@/lib/ai/tailor-cv";
import { cvFromProfile } from "@/lib/cv/queries";
import { cvContentSchema } from "@/lib/cv/types";
import { emptyProfile, profileError, profileSchema, type ProfileSection } from "./schema";
import { mergeSections, sectionBlock, tidySections } from "./sections";

const item = (title: string, details: string[] = []) => ({ title, subtitle: "", date: "", link: "", details });
const projects: ProfileSection = { title: "Projects", items: [item("RolePort", ["Built a job tracker"])] };

describe("tidySections", () => {
  it("drops blank entries and empty sections, and joins repeated titles", () => {
    const out = tidySections([
      { title: " Projects ", items: [item(" RolePort ", [" Built it ", " "]), item("  ")] },
      { title: "Awards", items: [item("")] },
      { title: "projects", items: [item("Second")] },
    ]);
    expect(out).toEqual([{ title: "Projects", items: [item("RolePort", ["Built it"]), item("Second")] }]);
  });

  it("keeps an entry with no name, so saving can ask for one", () => {
    const out = tidySections([{ title: "Projects", items: [{ ...item(""), date: "2024" }] }]);
    expect(profileSchema.shape.sections.safeParse(out).error?.issues[0]?.message).toBe("Give each section entry a name");
  });
});

describe("mergeSections", () => {
  it("adds what the CV has, updates same-named entries and keeps what the user typed", () => {
    const talks: ProfileSection = { title: "Talks", items: [item("By hand")] };
    const current = [{ ...projects, items: [...projects.items, item("Mine")] }, talks];
    const merged = mergeSections(current, [
      { title: "PROJECTS", items: [item("roleport", ["New wording"])] },
      { title: "Certifications", items: [item("AWS")] },
    ]);
    expect(merged.map((s) => s.title)).toEqual(["Projects", "Talks", "Certifications"]);
    expect(merged[0].items).toEqual([item("Mine"), item("roleport", ["New wording"])]);
  });

  it("replaces an entry an earlier read filed under its role", () => {
    const swapped = { ...item("Lead Developer"), subtitle: "RolePort" };
    const merged = mergeSections([{ title: "Projects", items: [swapped] }], [{ title: "Projects", items: [item("RolePort")] }]);
    expect(merged[0].items).toEqual([item("RolePort")]);
  });
});

describe("what a model writes", () => {
  it("fits the saved limits, and a long field is named when it doesn't", () => {
    const long = "x".repeat(500);
    const draft = fitProfileLimits({
      name: "Juan",
      headline: long,
      summary: null,
      city: null,
      region: null,
      yearsExperience: null,
      desiredRoles: [],
      workSetups: [],
      skills: [],
      experience: [],
      education: [{ school: long, degree: long, field: null, year: null }],
      languages: [],
      careerGoals: [],
    });
    const valid = profileSchema.safeParse({ ...emptyProfile, ...draft });
    expect(valid.success).toBe(true);
    const tooLong = profileSchema.safeParse({ ...emptyProfile, name: "Juan", headline: long });
    expect(profileError(tooLong.error!)).toBe("Your headline is too long. Keep it to 160 characters.");
  });
});

describe("cleanExtractedSections", () => {
  const raw = (title: string, items: { title: string | null; details: string[] }[]) => ({
    title,
    items: items.map((i) => ({ ...i, subtitle: null, date: null, link: null })),
  });

  it("leaves out headings the profile already covers", () => {
    const out = cleanExtractedSections([
      raw("Work Experience", [{ title: "Dev", details: [] }]),
      raw("Technical Skills", [{ title: "React", details: [] }]),
      raw("Open Source", [{ title: "Next.js", details: [] }]),
    ]);
    expect(out.map((s) => s.title)).toEqual(["Open Source"]);
  });

  it("turns a nameless one-line entry's bullet into its name, and nulls into blanks", () => {
    const out = cleanExtractedSections([raw("Achievements", [{ title: null, details: ["Won the 2023 hackathon"] }, { title: null, details: [] }])]);
    expect(out).toEqual([{ title: "Achievements", items: [item("Won the 2023 hackathon")] }]);
  });

  it("keeps a project's name as its title and leaves roles out", () => {
    const project = (title: string, subtitle: string) => ({ title: "Projects", items: [{ title, subtitle, date: null, link: null, details: [] }] });
    expect(cleanExtractedSections([project("Lead Developer", "RolePort")])[0].items).toEqual([item("RolePort")]);
    expect(cleanExtractedSections([project("RolePort", "Lead Developer")])[0].items).toEqual([item("RolePort")]);
    expect(cleanExtractedSections([project("Task Manager", "React, Node")])[0].items).toEqual([item("Task Manager", ["React, Node"])]);
  });

  it("calms headings written in capitals", () => {
    const out = cleanExtractedSections([raw("VOLUNTEER WORK", [{ title: "Mentor", details: [] }]), raw("Open Source", [{ title: "Next.js", details: [] }])]);
    expect(out.map((s) => s.title)).toEqual(["Volunteer work", "Open Source"]);
  });

  it("always passes the save validation, however much a model returns", () => {
    const many = Array.from({ length: 40 }, (_, i) => raw(`Section ${i}`, Array.from({ length: 50 }, (_, j) => ({ title: `Item ${j}`, details: Array(20).fill("x".repeat(900)) }))));
    expect(profileSchema.shape.sections.safeParse(cleanExtractedSections(many)).success).toBe(true);
  });
});

describe("the CV reading prompt", () => {
  it("always ends with the fixed rules, even on a custom prompt", () => {
    expect(profileSystemPrompt(null)).toBe(`${DEFAULT_PROFILE_PROMPT}\n\n${PROFILE_FIXED_RULES}`);
    expect(profileSystemPrompt("  mine ")).toBe(`mine\n\n${PROFILE_FIXED_RULES}`);
  });

  it("swaps the summary rule rather than adding a second one", () => {
    const once = withWrittenSummary(DEFAULT_PROFILE_PROMPT);
    expect(once).not.toContain("the CV's own summary");
    expect(once.match(/- summary:/g)).toHaveLength(1);
    expect(withWrittenSummary(once)).toBe(once);
    expect(withWrittenSummary("Custom.")).toMatch(/^Custom\.\n- summary: write/);
  });

  it("adds a section rule once, without stray quotes", () => {
    const once = withSection("Rules", ' Open "Source"\n');
    expect(once).toContain('section titled "Open Source"');
    expect(withSection(once, 'Open "Source"\n')).toBe(once);
    expect(withSection("Rules", "  ")).toBe("Rules");
  });
});

describe("sections downstream", () => {
  const profile = { ...emptyProfile, name: "Juan", sections: [{ title: "Certifications", items: [{ ...item("AWS Solutions Architect", ["Scored 912"]), subtitle: "Amazon", date: "2024" }] }] };

  it("reach the models and the fact checks", () => {
    expect(sectionBlock(profile.sections[0])).toBe("Certifications:\n- AWS Solutions Architect, Amazon (2024): Scored 912");
    expect(candidateBlock(profile, null)).toContain("AWS Solutions Architect");
    expect(sourceOf(profile, null)).toContain("912");
  });

  it("print on the CV, and CVs saved before them still load", () => {
    const cv = cvFromProfile(profile);
    expect(cvContentSchema.parse(cv).sections).toEqual(profile.sections);
    expect(cvContentSchema.parse({ ...cv, sections: undefined }).sections).toEqual([]);
  });
});
