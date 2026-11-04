import type { ProfileInput } from "@/lib/profile/schema";
import type { OnboardingData } from "./onboarding-flow";

/** The guide's props, built the same way on the server and in the browser. A finished guide opens at the start; one in progress resumes. */
export function toOnboardingData(
  profile: ProfileInput,
  cvFileName: string | null,
  aiEnabled: boolean,
  onboarding: { done: boolean; step: number },
  inBrowser: boolean,
  desktopJobSpy: OnboardingData["desktopJobSpy"] = null,
): OnboardingData {
  // The desktop app has one more step (more job boards), so its guide ends at 7.
  const last = desktopJobSpy ? 7 : 6;
  return {
    profile,
    cvFileName,
    aiEnabled,
    done: onboarding.done,
    startStep: onboarding.done ? 0 : Math.max(0, Math.min(last, onboarding.step)),
    inBrowser,
    desktopJobSpy,
  };
}
