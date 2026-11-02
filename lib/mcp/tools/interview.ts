import { z } from "zod";
import {
  answerInterview,
  endInterview,
  finishWithoutCoaching,
  gradeInterviewStep,
  readInterview,
  readInterviewList,
  skipInterviewQuestion,
  startInterview,
} from "@/lib/interview/sessions";
import {
  FOCUS_INFO,
  gradeScore,
  INTERVIEW_FOCUSES,
  INTERVIEW_LENGTHS,
  INTERVIEW_STYLES,
  interviewState,
  MAX_INTERVIEW_ANSWER,
  MAX_JOB_DESCRIPTION,
  MAX_ROLE,
  reportProgress,
  STYLE_INFO,
  verdictOf,
  averageScore,
  type InterviewView,
} from "@/lib/interview/types";
import { readApplication } from "@/lib/jobs/applications";
import { readProfile } from "@/lib/profile/queries";
import { AI_NOT_SET_UP, notFound } from "../errors";
import { AGENT_LABEL, answerInput, tool, ToolError, writerFor, type McpContext } from "../tool";

/*
 * The Interview Coach through an agent: RolePort plans the questions, plays the interviewer
 * (follow-ups included) and grades the answers; the agent only passes questions to the user and
 * the user's answers back, word for word. The session is saved like one run in the app, so it
 * shows on the Coach page with its report.
 */

const interviewId = z.string().min(1).max(100).describe("A mock interview id from start_mock_interview or list_mock_interviews.");

/** How long one get_interview_report call keeps grading before handing back progress (agents time out on long calls). */
const REPORT_BUDGET_MS = 45_000;

const RELAY =
  "Ask the user this exactly as written, then pass their reply to answer_interview word for word. Don't hint, coach or grade during the interview: the report comes after.";

function coachLink(id: string) {
  return `/coach/${id}`;
}

/** What the interviewer says now, if it's waiting for the user. */
function currentTurn(view: InterviewView) {
  const last = view.turns.at(-1);
  if (!last || last.from !== "interviewer") return null;
  const { q, inClosing } = interviewState(view);
  const speaker = view.panel && last.speaker !== undefined ? view.panel[last.speaker]?.role : undefined;
  return {
    kind: last.kind,
    say: [last.lead, last.text].filter(Boolean).join(" "),
    ...(speaker && { askedBy: speaker }),
    question: inClosing ? "closing" : `${q + 1} of ${view.plan.length}`,
  };
}

function reportOf(view: InterviewView) {
  const average = averageScore(view.report.results);
  return {
    ...(average !== null && { averageScore: Math.round(average * 100) / 100, verdict: `${verdictOf(average).label} (practice, not a prediction)` }),
    summary: view.report.summary,
    questions: view.plan.map((p, i) => {
      const r = view.report.results[i];
      if (!r) return { question: p.question, competency: p.competency, result: "not graded yet" };
      if (r.status !== "graded") return { question: p.question, competency: p.competency, result: r.status };
      return {
        question: p.question,
        competency: p.competency,
        score: Math.round(gradeScore(r) * 100) / 100,
        scores: r.scores,
        feedback: r.summary,
        strengths: r.strengths,
        improvements: r.improvements,
        ...(r.flags?.length && { doesntMatchWhatYouSent: r.flags.map((f) => ({ said: f.said, note: f.note, source: f.source })) }),
        ...(r.refined && { strongerAnswer: r.refined.answer }),
      };
    }),
    model: view.report.model,
  };
}

export const listMockInterviews = tool({
  name: "list_mock_interviews",
  title: "List mock interviews",
  description: "The user's mock interviews from RolePort's Interview Coach, newest first: what they were for, whether they're in progress or done, and the score once graded.",
  input: {},
  writes: false,
  async run(_, ctx) {
    const list = await readInterviewList(ctx.db, ctx.user.id);
    return {
      interviews: list.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        length: INTERVIEW_LENGTHS[i.length].label,
        style: STYLE_INFO[i.style].label,
        answered: `${i.answered} of ${i.questions}`,
        score: i.score === null ? null : Math.round(i.score * 100) / 100,
        at: i.createdAt.toISOString(),
      })),
    };
  },
});

export const getMockInterview = tool({
  name: "get_mock_interview",
  title: "Read a mock interview",
  description:
    "One mock interview: its status, the question waiting for the user if it's in progress (to pick up where it stopped), the transcript, and the report as far as it's graded.",
  input: { interview_id: interviewId },
  writes: false,
  async run({ interview_id }, ctx) {
    const view = await readInterview(ctx.db, ctx.user.id, interview_id);
    if (!view) throw new ToolError(`No mock interview with id ${interview_id}. Use an id from list_mock_interviews.`);
    const now = view.status === "active" ? currentTurn(view) : null;
    return {
      id: view.id,
      title: view.title,
      status: view.status,
      ...(now && { waitingFor: { ...now, next: RELAY } }),
      transcript: view.turns.map((t) => ({ from: t.from, kind: t.kind, text: [t.lead, t.text].filter(Boolean).join(" ") })),
      ...(view.status !== "active" && { report: reportOf(view) }),
      ...(view.status === "ended" && { grading: reportProgress(view) }),
      openInApp: coachLink(view.id),
    };
  },
});

export const startMockInterview = tool({
  name: "start_mock_interview",
  title: "Start a mock interview",
  description: `Starts a mock interview in RolePort's Interview Coach, for one of the user's applications (its posting, tailored CV and letter are used) or for a role. RolePort plans the questions and plays the interviewer; you only ask its questions and pass the user's answers back. Focus: ${INTERVIEW_FOCUSES.map((f) => `${f} (${FOCUS_INFO[f].label})`).join(", ")}. Length: quick (3 questions, ~10 min) or full (6, 30–40 min). Style: ${INTERVIEW_STYLES.map((s) => `${s} (${STYLE_INFO[s].label})`).join(", ")}. Planned by the AI set up in RolePort, or by you: then this returns a brief to answer.`,
  input: {
    application_id: z.string().min(1).max(100).optional().describe("Practise for this application. Leave out to practise for a role."),
    role: z.string().max(MAX_ROLE).optional().describe("The role, when there's no application. Defaults to the profile's first desired role."),
    company: z.string().max(MAX_ROLE).optional(),
    job_description: z.string().max(MAX_JOB_DESCRIPTION).optional().describe("A posting to practise for, when there's no application."),
    focus: z.enum(INTERVIEW_FOCUSES).optional().describe('Default "posting" when there is a posting, else "behavioral".'),
    length: z.enum(["quick", "full"]).optional().describe('Default "quick".'),
    style: z.enum(INTERVIEW_STYLES).optional().describe('Default "standard".'),
    panel: z.boolean().optional().describe("Two interviewers taking turns. Default false."),
    answer: answerInput,
  },
  writes: true,
  external: true,
  async run(args, ctx) {
    let hasPosting = Boolean(args.job_description?.trim());
    if (args.application_id) {
      const app = await readApplication(ctx.db, ctx.user.id, args.application_id);
      if (!app) throw notFound("application", args.application_id);
      hasPosting = Boolean(app.job);
    }
    const role = args.role?.trim() || (args.application_id ? "" : await defaultRole(ctx));
    if (!args.application_id && !role) throw new ToolError("Say which role to practise for: the profile has no desired roles to fall back on.");

    const config = await writerFor(ctx, args.answer, AI_NOT_SET_UP);
    const id = await startInterview(
      ctx.db,
      ctx.user,
      {
        applicationId: args.application_id ?? null,
        targetRole: role,
        company: args.company?.trim() ?? "",
        jobDescription: args.job_description?.trim() ?? "",
        focus: args.focus ?? (hasPosting ? "posting" : "behavioral"),
        length: args.length ?? "quick",
        style: args.style ?? "standard",
        panel: args.panel ?? false,
        drill: null,
      },
      config,
    );
    const view = (await readInterview(ctx.db, ctx.user.id, id))!;
    return {
      interview_id: id,
      title: view.title,
      questions: view.plan.length,
      style: STYLE_INFO[view.style].label,
      ...(view.panel && { panel: view.panel.map((p) => p.role) }),
      interviewer: { ...currentTurn(view), next: RELAY },
      note: "Tell the user the interview has started, then ask the first question. They can say \"skip\" to skip a question or \"stop\" to end early.",
      openInApp: coachLink(id),
    };
  },
});

async function defaultRole(ctx: McpContext): Promise<string> {
  const { profile } = await readProfile(ctx.db, ctx.user);
  return profile.desiredRoles[0] ?? profile.headline ?? "";
}

export const answerInterviewTool = tool({
  name: "answer_interview",
  title: "Answer the interviewer",
  description:
    "Sends the user's reply to the question in play, word for word (don't improve it), and returns what the interviewer says next: a follow-up, the next question, the closing question, or the end. The interviewer's decision is made by the AI set up in RolePort, or by you: then this returns a brief to answer.",
  input: {
    interview_id: interviewId,
    user_answer: z.string().min(1).max(MAX_INTERVIEW_ANSWER).describe("What the user said, exactly."),
    answer: answerInput,
  },
  writes: true,
  external: true,
  async run({ interview_id, user_answer, answer }, ctx) {
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const view = await answerInterview(ctx.db, ctx.user.id, interview_id, user_answer, config).catch(rethrowSession);
    return turnResult(view);
  },
});

export const skipInterviewQuestionTool = tool({
  name: "skip_interview_question",
  title: "Skip the question",
  description: "Skips the question in play when the user asks to, and returns the interviewer's next question. No AI needed.",
  input: { interview_id: interviewId },
  writes: true,
  async run({ interview_id }, ctx) {
    return turnResult(await skipInterviewQuestion(ctx.db, ctx.user.id, interview_id).catch(rethrowSession));
  },
});

export const endInterviewTool = tool({
  name: "end_interview",
  title: "End the interview",
  description: "Ends the interview early when the user asks to. What they answered still gets graded with get_interview_report.",
  input: { interview_id: interviewId },
  writes: true,
  async run({ interview_id }, ctx) {
    const view = await endInterview(ctx.db, ctx.user.id, interview_id).catch(rethrowSession);
    return { status: view.status, next: "Call get_interview_report for the grades.", openInApp: coachLink(view.id) };
  },
});

export const getInterviewReport = tool({
  name: "get_interview_report",
  title: "Grade the interview",
  description:
    "Grades a finished or ended mock interview the way the Coach does: each answer on five points (answered the question, structure, specifics, your part, result), then a summary. With coaching, each answer is also checked against the CV and letter the user sent and a stronger version written. One call works through as many steps as fit in about 45 seconds; call again until status is done. Graded by the AI set up in RolePort, or by you: then each step returns a brief to answer.",
  input: {
    interview_id: interviewId,
    coaching: z
      .boolean()
      .optional()
      .describe("Also check each answer against what the user sent and write a stronger one (2 more AI steps per answer). Default true when RolePort's AI grades, false when you do, to save usage. Without it the report is final: coaching can't be added later."),
    answer: answerInput,
  },
  writes: true,
  external: true,
  async run({ interview_id, coaching, answer }, ctx) {
    let view = await readInterview(ctx.db, ctx.user.id, interview_id);
    if (!view) throw new ToolError(`No mock interview with id ${interview_id}. Use an id from list_mock_interviews.`);
    if (view.status === "active") throw new ToolError("The interview is still going. Finish it, or call end_interview first.");

    let config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const agentWrites = config.provider === "agent" || ctx.writer === "agent";
    const withCoaching = coaching ?? !agentWrites;
    const deadline = Date.now() + REPORT_BUDGET_MS;

    while (view.status !== "done") {
      if (!withCoaching && view.report.summary) break;
      if (Date.now() > deadline) break;
      view = await gradeInterviewStep(ctx.db, ctx.user.id, interview_id, config);
      // An answer covers one step; the next one is the agent's turn again (a new brief).
      if (config.provider === "agent") config = { provider: "agent", model: AGENT_LABEL, source: "agent" };
    }

    // Without coaching the report is complete once the summary is in: mark it done so the Coach page shows and counts it.
    const coachingSkipped = !withCoaching && view.status === "ended" && view.report.summary !== null;
    if (coachingSkipped) view = await finishWithoutCoaching(ctx.db, ctx.user.id, interview_id);
    const progress = reportProgress(view);
    const finished = view.status === "done";
    return {
      status: finished ? "done" : "in progress",
      ...(!finished && { progress: `${progress.done} of ${progress.total} steps` }),
      ...reportOf(view),
      ...(!finished && { next: "Call get_interview_report again to continue grading." }),
      ...(coachingSkipped && { note: "Graded without coaching, to save usage: answers weren't checked against the CV and letter, and no stronger versions were written." }),
      openInApp: coachLink(view.id),
    };
  },
});

function turnResult(view: InterviewView) {
  const now = currentTurn(view);
  if (view.status !== "active" || !now || now.kind === "wrap") {
    return { status: "ended", interviewer: now?.say ?? null, next: "Tell the user the interview is over, then call get_interview_report for the grades.", openInApp: coachLink(view.id) };
  }
  return { status: "active", interviewer: { ...now, next: RELAY } };
}

/** The Coach's own messages ("isn't waiting for an answer", "isn't saved anymore") are for the agent to act on. */
function rethrowSession(error: unknown): never {
  // Plain Errors only: the agent's brief and AI failures are subclasses, handled by the server.
  if (error instanceof Error && error.constructor === Error && /interview|answer/i.test(error.message)) throw new ToolError(error.message);
  throw error;
}
