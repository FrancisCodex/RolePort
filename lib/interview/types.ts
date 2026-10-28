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
};

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
  at: string;
};

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
      /** Set once the answer has been checked against the documents and rewritten (a second step after grading). */
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
    total += 2;
    if (r?.status === "graded") done += r.coached ? 2 : 1;
  });
  return { done, total };
}

/** The average of every graded answer's rubric scores, or null if nothing was graded. */
export function averageScore(results: (QuestionResult | null)[]): number | null {
  const scores = results.flatMap((r) => (r?.status === "graded" ? Object.values(r.scores) : []));
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}
