/**
 * Weights, verdict bands and veto rules from ai-job-search's 04-job-evaluation.md and
 * /rank (MIT, see THIRD_PARTY_NOTICES.md). Shared by the evaluator and the UI.
 */

export type GateVerdict = "pass" | "flag" | "fail" | "unverified";

export type FitScores = { skills: number; experience: number; culture: number; career: number };

/** Jobs per AI analysis run on the jobs list: they run one at a time, and local models take ~30-60s each. */
export const MAX_PER_RUN = 10;

/** Location is pass/fail, not weighted. */
export const FIT_WEIGHTS: FitScores = { skills: 0.3, experience: 0.25, culture: 0.15, career: 0.3 };

export function overallFitScore(s: FitScores): number {
  const total =
    s.skills * FIT_WEIGHTS.skills +
    s.experience * FIT_WEIGHTS.experience +
    s.culture * FIT_WEIGHTS.culture +
    s.career * FIT_WEIGHTS.career;
  return Math.round(Math.min(100, Math.max(0, total)));
}

export type FitBand = "strong" | "good" | "moderate" | "weak" | "poor";

export const FIT_BANDS: Record<FitBand, { label: string; advice: string; tone: "success" | "brand" | "warning" | "danger" }> = {
  strong: { label: "Strong fit", advice: "Definitely apply and tailor everything.", tone: "success" },
  good: { label: "Good fit", advice: "Apply, and address the gaps in your cover letter.", tone: "brand" },
  moderate: { label: "Moderate fit", advice: "Consider it carefully before investing time.", tone: "warning" },
  weak: { label: "Weak fit", advice: "Probably skip unless there's a strategic reason.", tone: "danger" },
  poor: { label: "Poor fit", advice: "Skip this one.", tone: "danger" },
};

export function fitBand(score: number): FitBand {
  if (score >= 75) return "strong";
  if (score >= 60) return "good";
  if (score >= 45) return "moderate";
  if (score >= 30) return "weak";
  return "poor";
}

/** Deal-breakers veto scores: a 90-point job that fails a gate is excluded, not ranked first. */
export function vetoReason(m: {
  eligibilityGate: GateVerdict;
  languageGate: GateVerdict;
  locationGate: GateVerdict;
  gateNote: string | null;
  postingClosed: boolean;
  deadline: string | null;
}, today = todayIso()): string | null {
  if (m.postingClosed) return "The posting says it's closed";
  if (m.deadline && m.deadline < today) return "The application deadline has passed";
  if (m.eligibilityGate === "fail") return "Eligibility requirement not met";
  if (m.languageGate === "fail") return "Requires a language you don't list";
  if (m.locationGate === "fail") return "Location doesn't work for you";
  if (m.gateNote) return "Hits one of your deal-breakers";
  return null;
}

export function todayIso(now = new Date()): string {
  // Dates are compared in Philippine time, where deadlines are set.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
}

/** Days until a YYYY-MM-DD deadline (negative once passed), or null. */
export function daysUntil(deadline: string | null, today = todayIso()): number | null {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
}

/** Whole days since a posting went up, for /rank's staleness flag (over 30 days). */
export function daysSince(date: Date | null, now = Date.now()): number | null {
  return date ? Math.floor((now - date.getTime()) / 86_400_000) : null;
}
