import type { DashboardStats } from "@/lib/jobs/dashboard";
import type { ProfileView } from "@/lib/profile/queries";
import type { HomeData } from "./home-view";

/** The dashboard's props, built the same way from the server's and the browser's data. */
export function toHomeData(view: ProfileView, stats: DashboardStats, aiEnabled: boolean, onboarding: { done: boolean }): HomeData {
  const { profile } = view;
  return {
    firstName: profile.name.split(" ")[0] ?? "",
    stats,
    setup: {
      hasRoles: profile.desiredRoles.length > 0,
      hasSkills: profile.skills.length > 0,
      hasCv: view.hasCv,
      aiEnabled,
      firstRole: profile.desiredRoles[0] ?? null,
      country: profile.country,
    },
    needsOnboarding: !onboarding.done,
  };
}
