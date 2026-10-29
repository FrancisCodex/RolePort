import { z } from "zod";
import { INTERVIEW_STYLES, type InterviewStyle } from "@/lib/ai/interview-prompt";

export { INTERVIEW_STYLES, STYLE_INFO, type InterviewStyle } from "@/lib/ai/interview-prompt";

/*
 * Mock interviews (the Interview Coach): one interview_session row holds the setup, a frozen
 * snapshot of what the candidate sent, the question plan, the transcript and the report.
 * The interview runs one question at a time with a capped number of follow-ups, so it ends.
 */

export const INTERVIEW_FOCUSES = ["screen", "behavioral", "role", "posting"] as const;
export type InterviewFocus = (typeof INTERVIEW_FOCUSES)[number];

export const FOCUS_INFO: Record<InterviewFocus, { label: string; description: string }> = {
  screen: {
    label: "Recruiter screen",
    description: "Tell me about yourself, why this role, salary and availability. The usual first call.",
  },
  behavioral: {
    label: "Behavioral",
    description: "Tell me about a time when… Past situations told as stories, probed for your part and the result.",
  },
  role: {
    label: "Role-specific",
    description: "Knowledge and judgement for this job title, drilling into how and why you'd do the work.",
  },
  posting: {
    label: "Job posting",
    description: "A full round built from a posting's requirements: an opener, stories and role questions.",
  },
};

export const INTERVIEW_LENGTHS = {
  quick: { label: "Quick drill", questions: 3, time: "about 10 minutes" },
  full: { label: "Full round", questions: 6, time: "30–40 minutes" },
} as const;
export type InterviewLength = keyof typeof INTERVIEW_LENGTHS;

export const MAX_ROLE = 120;
export const MAX_JOB_DESCRIPTION = 15000;
export const MAX_INTERVIEW_ANSWER = 5000;
/** A posting pasted for the "Job posting" focus needs enough text to plan from. */
export const MIN_JOB_DESCRIPTION = 80;

export const interviewSetupSchema = z
  .object({
    applicationId: z.string().trim().min(1).max(60).nullable(),
    targetRole: z.string().trim().max(MAX_ROLE, `Keep the role under ${MAX_ROLE} characters.`),
    company: z.string().trim().max(MAX_ROLE, `Keep the company under ${MAX_ROLE} characters.`),
    jobDescription: z.string().trim().max(MAX_JOB_DESCRIPTION, `Keep the job description under ${MAX_JOB_DESCRIPTION} characters.`),
    focus: z.enum(INTERVIEW_FOCUSES),
    length: z.enum(["quick", "full"]),
    style: z.enum(INTERVIEW_STYLES),
    /** Two interviewers taking turns instead of one. */
    panel: z.boolean(),
    /** Weak spots from past interviews to build every question around, or null for a normal interview. */
    drill: z
      .object({
        competencies: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
        dimensions: z.array(z.string().trim().min(1).max(80)).max(3),
      })
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.applicationId) return;
    if (!v.targetRole) ctx.addIssue({ code: "custom", path: ["targetRole"], message: "Add the role you're interviewing for." });
    if (v.focus === "posting" && v.jobDescription.length < MIN_JOB_DESCRIPTION) {
      ctx.addIssue({ code: "custom", path: ["jobDescription"], message: "Paste the job posting to practise for it." });
    }
  });

export type InterviewSetup = z.infer<typeof interviewSetupSchema>;

/** One main question, with what the interviewer listens for (shown only after the interview). */
export type PlannedQuestion = {
  question: string;
  competency: string;
  /** Why an interviewer asks it. */
  intent: string;
  strongSignals: string[];
  redFlags: string[];
  /** In a panel interview, which panelist asks it (an index into the session's panel). */
  panelist?: number;
};

/** One interviewer on a panel. */
export type Panelist = { role: string; focus: string };

/** The two interviewers on a panel: who they are and what each listens for. */
export function panelFor(focus: InterviewFocus): Panelist[] {
  return focus === "screen"
    ? [
        { role: "Recruiter", focus: "background, motivation, salary and availability" },
        { role: "Hiring manager", focus: "fit for the team and what you'd bring to the role" },
      ]
    : [
        { role: "Hiring manager", focus: "ownership, results, judgement and motivation" },
        { role: "Team lead", focus: "the day-to-day work, depth in the role and working with others" },
      ];
}

export type InterviewTurn = {
  id: string;
  from: "interviewer" | "candidate";
  /** question: a main question; closing: "any questions for me?"; wrap: the interview is over. */
  kind: "question" | "follow_up" | "closing" | "wrap" | "answer" | "skip";
  /** The main question this turn belongs to; plan.length for the closing exchange. */
  q: number;
  text: string;
  /** The interviewer's short reaction to the previous answer, said before this turn. */
  lead?: string;
  /** In a panel interview, which panelist is speaking. */
  speaker?: number;
  /** An answer given out loud: how long the candidate spoke, for pace feedback. */
  spoken?: { seconds: number };
  at: string;
};

/* Delivery (answers given out loud) ------------------------------------------ */

/** Verbal fillers worth noticing. "Like" and "so" are left out: as often as not they're real words. */
const FILLERS = ["um", "uh", "er", "ah", "hmm", "you know", "i mean", "basically", "actually", "literally", "kind of", "sort of"];

export type Delivery = {
  /** Spoken answers only. */
  answers: number;
  wordsPerMinute: number;
  fillers: { word: string; count: number }[];
  fillersPer100: number;
  longestSeconds: number;
};

/** Pace and fillers across the answers given out loud, or null if none were. */
export function deliveryOf(turns: InterviewTurn[]): Delivery | null {
  const spoken = turns.filter((t) => t.from === "candidate" && t.kind === "answer" && t.spoken && t.spoken.seconds >= 3);
  if (spoken.length === 0) return null;
  const words = spoken.reduce((n, t) => n + (t.text.trim().match(/\S+/g) ?? []).length, 0);
  const seconds = spoken.reduce((n, t) => n + t.spoken!.seconds, 0);
  const text = ` ${spoken.map((t) => t.text.toLowerCase().replace(/[^\p{L}\s']/gu, " ")).join(" ")} `.replace(/\s+/g, " ");
  // Lookarounds so back-to-back fillers ("um um") both count.
  const fillers = FILLERS.map((word) => ({ word, count: text.match(new RegExp(`(?<= )${word}(?= )`, "g"))?.length ?? 0 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
  const fillerTotal = fillers.reduce((n, f) => n + f.count, 0);
  return {
    answers: spoken.length,
    wordsPerMinute: Math.round(words / (seconds / 60)),
    fillers,
    fillersPer100: words ? (fillerTotal / words) * 100 : 0,
    longestSeconds: Math.max(...spoken.map((t) => t.spoken!.seconds)),
  };
}

/** How long an answer was spoken for, if it was, kept within reason (an hour at most). Input comes from the client. */
export function spokenTime(spoken: unknown): { seconds: number } | null {
  const seconds = (spoken as { seconds?: unknown } | null)?.seconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? { seconds: Math.min(Math.round(seconds), 3600) } : null;
}

/** Plain-language read on a speaking pace. Conversational English runs about 120-160 words a minute. */
export function paceNote(wpm: number): { label: string; tone: "success" | "warning" } {
  if (wpm < 105) return { label: "On the slow side: tighten pauses and get to the point sooner.", tone: "warning" };
  if (wpm > 175) return { label: "Fast: slow down so key points land.", tone: "warning" };
  return { label: "A comfortable pace.", tone: "success" };
}

/**
 * What the candidate had sent when the interview started, frozen so later checks compare the
 * interview with what the employer actually received.
 */
export type InterviewContext = {
  candidateName: string;
  /** The profile as the models see it, without the CV text. */
  candidate: string;
  /** The posting or pasted job description, or null for a role-only practice. */
  job: string | null;
  documents: { label: string; text: string }[];
};

export const RUBRIC = {
  relevance: { label: "Answered the question", hint: "Did it address what was asked?" },
  structure: { label: "Structure", hint: "Easy to follow: situation, what you did, how it ended." },
  evidence: { label: "Specifics", hint: "Concrete details: tools, names, numbers, scale." },
  ownership: { label: "Your part", hint: "What you did yourself, not just the team." },
  impact: { label: "Result", hint: "The outcome and what it changed." },
} as const;
export type RubricKey = keyof typeof RUBRIC;

export const answerGradeSchema = z.object({
  scores: z.object({
    relevance: z.number().int().min(1).max(4),
    structure: z.number().int().min(1).max(4),
    evidence: z.number().int().min(1).max(4),
    ownership: z.number().int().min(1).max(4),
    impact: z.number().int().min(1).max(4),
  }),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type AnswerGrade = z.infer<typeof answerGradeSchema>;

/**
 * Something the candidate said that doesn't line up with what they sent. Both quotes are
 * checked in code: `said` must be in their answers, `sourceQuote` in the named document.
 */
export type ConsistencyFlag = {
  kind: "contradiction" | "inflation" | "unbacked";
  said: string;
  /** The document it conflicts with ("Tailored CV", "Cover letter"…), or null for a claim no document backs. */
  source: string | null;
  sourceQuote: string | null;
  note: string;
};

export const FLAG_INFO: Record<ConsistencyFlag["kind"], { label: string; tone: "danger" | "warning" | "neutral" }> = {
  contradiction: { label: "Contradicts what you sent", tone: "danger" },
  inflation: { label: "Bigger than what you sent", tone: "warning" },
  unbacked: { label: "Not in what you sent", tone: "neutral" },
};

/** Another go at one question after the interview, graded on the same rubric. */
export type RedoAttempt = { answer: string; at: string; words: number } & AnswerGrade;

/** The average of one grade's five rubric scores. */
export const gradeScore = (grade: Pick<AnswerGrade, "scores">) => Object.values(grade.scores).reduce((a, b) => a + b, 0) / 5;

/** A stronger version of the candidate's answer, built from what they said and their profile only. */
export type RefinedAnswer = {
  answer: string;
  /** What changed and why, in a sentence or two. */
  notes: string;
  /** The app's checks: numbers no source states, and placeholders to fill in. */
  warnings: string[];
};

export type QuestionResult =
  | ({
      status: "graded";
      words: number;
      followUps: number;
      /** Set once the answer has been checked against the documents (`flags`), a step after grading. */
      checked?: boolean;
      /** Set once a stronger answer has been written (`refined`), the step after that. */
      coached?: boolean;
      flags?: ConsistencyFlag[];
      refined?: RefinedAnswer | null;
    } & AnswerGrade)
  | { status: "skipped" }
  | { status: "not_reached" };

/** The pre-interview briefing: what to expect and what to bring, without giving away the questions. */
export type InterviewBriefing = {
  roleSummary: string;
  mustHaves: string[];
  /** Likely question themes; `quote` is posting text that points to it, checked in code. */
  themes: { theme: string; why: string; quote: string | null }[];
  /** A story from the candidate's own experience for each competency; `from` is null when they have none yet. */
  stories: { competency: string; from: string | null; angle: string }[];
  gaps: { gap: string; howToAddress: string }[];
  questionsToAsk: string[];
  model: string;
  at: string;
};

export type InterviewSummary = {
  headline: string;
  strengths: string[];
  focusAreas: string[];
  /** On the candidate's own questions at the end, or advice to prepare some. */
  questionsFeedback: string;
};

export type InterviewReport = {
  /** One entry per planned question; null until graded. */
  results: (QuestionResult | null)[];
  summary: InterviewSummary | null;
  model: string | null;
  at: string | null;
  /** Later attempts at a question from the report, by question index, newest last. Any question can be redone. */
  redos?: Record<string, RedoAttempt[]>;
};

/** Most attempts kept per question. */
export const MAX_REDOS = 5;

/** Across all finished interviews: scores over time, rubric trends, weak spots and what's coming up. */
export type InterviewProgress = {
  /** Finished, graded interviews, oldest first (the latest 12). */
  sessions: { id: string; title: string; date: Date; score: number }[];
  /** Each rubric dimension over the last 3 interviews, and over the ones before for comparison. */
  dimensions: { key: RubricKey; recent: number; earlier: number | null }[];
  /** The lowest-scoring competencies in recent interviews. */
  weakest: { competency: string; score: number }[];
  /** What a weak-spot drill would practise, or null until there's enough to go on. */
  drill: {
    applicationId: string | null;
    role: string;
    company: string | null;
    focus: InterviewFocus;
    competencies: string[];
    dimensions: string[];
  } | null;
  /** Applications with an interview date from yesterday on, soonest first. */
  upcoming: { applicationId: string; role: string; company: string; interviewAt: Date }[];
};

export type InterviewStatus = "active" | "ended" | "done";

/** A session as the pages see it (the context snapshot stays on the server side of the data layer). */
export type InterviewView = {
  id: string;
  applicationId: string | null;
  title: string;
  targetRole: string;
  company: string | null;
  focus: InterviewFocus;
  length: InterviewLength;
  style: InterviewStyle;
  /** A drill built from weak spots in past interviews. */
  drill: boolean;
  /** The two interviewers of a panel interview, or null for one interviewer. */
  panel: Panelist[] | null;
  status: InterviewStatus;
  plan: PlannedQuestion[];
  turns: InterviewTurn[];
  report: InterviewReport;
  briefing: InterviewBriefing | null;
  /** Whether there's a posting or job description to brief from (a role-only practice has neither). */
  hasJob: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InterviewPageData = { interview: InterviewView; aiEnabled: boolean };

export type InterviewListItem = {
  id: string;
  applicationId: string | null;
  title: string;
  focus: InterviewFocus;
  length: InterviewLength;
  style: InterviewStyle;
  status: InterviewStatus;
  questions: number;
  answered: number;
  /** Average rubric score (1–4) once graded. */
  score: number | null;
  createdAt: Date;
};

export type InterviewSetupData = {
  aiEnabled: boolean;
  profileEmpty: boolean;
  /** A role to suggest for a standalone practice, from the profile. */
  suggestedRole: string;
  /** Applications to practise for, newest first. */
  applications: { id: string; role: string; company: string; hasPosting: boolean; documents: string[] }[];
  /** The application the page was opened for, if it exists. */
  selectedApplicationId: string | null;
};

/* Derived state ------------------------------------------------------------- */

/** Where the interview stands: the main question in play and the follow-ups already used on it. */
export function interviewState(view: Pick<InterviewView, "plan" | "turns" | "status">) {
  const last = view.turns.at(-1);
  const q = last?.q ?? 0;
  const followUps = view.turns.filter((t) => t.kind === "follow_up" && t.q === q).length;
  const awaitingAnswer = view.status === "active" && last?.from === "interviewer" && last.kind !== "wrap";
  return { q, followUps, awaitingAnswer, inClosing: q >= view.plan.length };
}

/** "today", "tomorrow", "in 3 days", "yesterday": calendar days from now until `date`. */
export function daysUntil(date: Date, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date(date)) - day(now)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Rough verdict from the average rubric score, labelled as practice, not a prediction. */
export function verdictOf(score: number): { label: string; tone: "danger" | "warning" | "success" | "brand" } {
  if (score < 2) return { label: "Not yet", tone: "danger" };
  if (score < 2.75) return { label: "Borderline", tone: "warning" };
  if (score < 3.4) return { label: "Likely pass", tone: "success" };
  return { label: "Strong pass", tone: "brand" };
}

/** The report's model calls, done and in total: a grade and a coaching pass per answered question, then the summary. */
export function reportProgress(view: Pick<InterviewView, "plan" | "turns" | "report">): { done: number; total: number } {
  let done = view.report.summary ? 1 : 0;
  let total = 1;
  view.plan.forEach((_, i) => {
    const r = view.report.results[i];
    if (!view.turns.some((t) => t.q === i && t.kind === "answer")) return;
    total += 3;
    // Grade, check, stronger answer. Sessions graded before the check was its own step have coached without checked.
    if (r?.status === "graded") done += r.coached ? 3 : r.checked ? 2 : 1;
  });
  return { done, total };
}

/** The average of every graded answer's rubric scores, or null if nothing was graded. */
export function averageScore(results: (QuestionResult | null)[]): number | null {
  const scores = results.flatMap((r) => (r?.status === "graded" ? Object.values(r.scores) : []));
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}
