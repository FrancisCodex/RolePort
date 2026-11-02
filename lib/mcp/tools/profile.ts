import { z } from "zod";
import { followedCompanyView, readFollowedCompanies } from "@/lib/companies/queries";
import { readProfile } from "@/lib/profile/queries";
import { tool } from "../tool";

export const getProfile = tool({
  name: "get_profile",
  title: "Read the profile",
  description:
    "The user's job-search profile: headline, summary, skills, experience, education, languages, the roles and countries they're looking in, work setup and salary wish. Contact details only with include_contact.",
  input: { include_contact: z.boolean().optional().describe("Also return email, phone and links.") },
  writes: false,
  async run({ include_contact }, ctx) {
    const { profile, hasCv, isComplete } = await readProfile(ctx.db, ctx.user);
    const { email, phone, links, ...rest } = profile;
    return {
      ...rest,
      ...(include_contact && { email, phone, links }),
      hasCv,
      isComplete,
      ...(!isComplete && { note: "The profile has no skills or desired roles yet. The user can import their CV on RolePort's Profile page." }),
    };
  },
});

export const listFollowedCompanies = tool({
  name: "list_followed_companies",
  title: "List followed companies",
  description: "Companies the user follows. Their open jobs are part of every search_jobs call.",
  input: {},
  writes: false,
  async run(_, ctx) {
    const rows = await readFollowedCompanies(ctx.db, ctx.user.id);
    return { companies: rows.map(followedCompanyView).map((c) => ({ id: c.id, name: c.name, hiringSystem: c.boardLabel, careersUrl: c.careersUrl })) };
  },
});
