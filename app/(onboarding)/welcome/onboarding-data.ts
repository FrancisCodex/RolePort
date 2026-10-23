import type { ProfileInput } from "@/lib/profile/schema";
import type { OnboardingData } from "./onboarding-flow";

/** The guide's props, built the same way on the server and in the browser. A finished guide opens at the start; one in progress resumes. */
export function toOnboardingData(
  profile: ProfileInput,
  cvFileName: string | null,
  aiEnabled: boolean,
  onboarding: { done: boolean; step: number },
  inBrowser: boolean,
): OnboardingData {
  return {
    profile,
    cvFileName,
    aiEnabled,
    done: onboarding.done,
    startStep: onboarding.done ? 0 : Math.max(0, Math.min(5, onboarding.step)),
    inBrowser,
  };
}
