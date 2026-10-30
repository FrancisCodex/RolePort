import { and, asc, desc, eq } from "drizzle-orm";
import { clip, jobBlock } from "@/lib/ai/evaluate-job";
import { checkClaims, decideTurn, gradeAnswer, planInterview, prepareBriefing, refineAnswer, summarizeInterview } from "@/lib/ai/interview";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import { candidateBlock } from "@/lib/ai/tailor-cv";
import { sectionBlock } from "@/lib/profile/sections";
import { readCv } from "@/lib/cv/queries";
import { cvDates, type CvContent } from "@/lib/cv/types";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { readAppDocument } from "@/lib/documents/queries";
import { readApplication, readApplications } from "@/lib/jobs/applications";
import { evaluationJobOf } from "@/lib/jobs/fit-evaluation";
import { letterText, type LetterContent } from "@/lib/letter/types";
import { readCvText, readProfile } from "@/lib/profile/queries";
import { questionsSchema } from "@/lib/questions/types";
import {
  averageScore,
  FOCUS_INFO,
  gradeScore,
  INTERVIEW_LENGTHS,
  interviewState,
  panelFor,
  MAX_REDOS,
  RUBRIC,
  STYLE_INFO,
  type InterviewContext,
  type InterviewFocus,
  type InterviewLength,
  type InterviewListItem,
  type InterviewProgress,
  type InterviewReport,
  type InterviewSetup,
  type InterviewSetupData,
  type InterviewStatus,
  type InterviewStyle,
  type InterviewTurn,
  type InterviewView,
  type Panelist,
  type QuestionResult,
  type RubricKey,
} from "./types";

/*
 * Mock interview sessions, shared by the server (pages, actions) and the lite edition's
 * browser database. No auth here: callers pass the user. Each write that needs the model
 * makes the call first and saves after, so a failed call leaves the session as it was.
 */

type User = { id: string; name: string };
type Row = typeof schema.interviewSession.$inferSelect;

const now = () => new Date().toISOString();
const turn = (t: Omit<InterviewTurn, "id" | "at">): InterviewTurn => ({ ...t, id: crypto.randomUUID(), at: now() });

const CLOSING_QUESTION = "That's all the questions I have. Before we wrap up, do you have any questions for me?";
const WRAP_UP = "Thanks for your time today. That's the end of the interview.";
const ENDED_EARLY = "Let's stop here. Thanks for your time.";

const emptyReport = (questions: number): InterviewReport => ({ results: Array(questions).fill(null), summary: null, model: null, at: null });

function toView(row: Row): InterviewView {
  return {
    id: row.id,
    applicationId: row.applicationId,
    title: row.title,
    targetRole: row.targetRole,
    company: row.company,
    focus: row.focus as InterviewFocus,
    length: row.length as InterviewLength,
    style: row.style as InterviewStyle,
    drill: row.drill !== null,
    panel: row.panel,
    status: row.status as InterviewStatus,
    plan: row.plan,
    turns: row.turns,
    report: row.report ?? emptyReport(row.plan.length),
    briefing: row.briefing,
    hasJob: row.context.job !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function readRow(db: AnyDb, userId: string, id: string): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(schema.interviewSession)
    .where(and(eq(schema.interviewSession.id, id), eq(schema.interviewSession.userId, userId)));
  return row ?? null;
}

async function mustRead(db: AnyDb, userId: string, id: string): Promise<Row> {
  const row = await readRow(db, userId, id);
  if (!row) throw new Error("That interview isn't saved anymore.");
  return row;
}

async function save(db: AnyDb, row: Row, changes: Partial<Pick<Row, "turns" | "status" | "report" | "briefing">>): Promise<InterviewView> {
  const [updated] = await db.update(schema.interviewSession).set(changes).where(eq(schema.interviewSession.id, row.id)).returning();
  return toView(updated);
}

/* Reads --------------------------------------------------------------------- */

export async function readInterview(db: AnyDb, userId: string, id: string): Promise<InterviewView | null> {
  const row = await readRow(db, userId, id);
  return row && toView(row);
}

export async function readInterviewList(db: AnyDb, userId: string): Promise<InterviewListItem[]> {
  const rows = await db
    .select()
    .from(schema.interviewSession)
    .where(eq(schema.interviewSession.userId, userId))
    .orderBy(desc(schema.interviewSession.createdAt));
  return rows.map((row) => {
    const view = toView(row);
    return {
      id: view.id,
      applicationId: view.applicationId,
      title: view.title,
      focus: view.focus,
      length: view.length,
      style: view.style,
      status: view.status,
      questions: view.plan.length,
      answered: new Set(view.turns.filter((t) => t.kind === "answer" && t.q < view.plan.length).map((t) => t.q)).size,
      score: view.status === "done" ? averageScore(view.report.results) : null,
      createdAt: view.createdAt,
    };
  });
}

/** The documents prepared for an application, by label, for the setup page and the snapshot. */
async function applicationDocuments(db: AnyDb, userId: string, applicationId: string): Promise<{ label: string; text: string }[]> {
  const [cv, letter, answers] = await Promise.all([
    readCv(db, userId, applicationId),
    readAppDocument<{ content: LetterContent }>(db, userId, applicationId, "cover_letter"),
    readAppDocument<{ items: unknown }>(db, userId, applicationId, "application_answers"),
  ]);
  const docs: { label: string; text: string }[] = [];
  if (cv) docs.push({ label: "Tailored CV", text: cvText(cv.content) });
  if (letter?.data.content.body.trim()) docs.push({ label: "Cover letter", text: letterText(letter.data.content) });
  const items = questionsSchema.safeParse(answers?.data.items ?? []);
  const answered = items.success ? items.data.filter((i) => i.answer.trim()) : [];
  if (answered.length) docs.push({ label: "Application answers", text: answered.map((i) => `Q: ${i.question}\nA: ${i.answer}`).join("\n\n") });
  return docs;
}

function cvText(cv: CvContent): string {
  return [
    cv.headline,
    cv.summary,
    cv.skills.length ? `Skills: ${cv.skills.join(", ")}` : "",
    ...cv.experience.map((e) => [`${e.role} at ${e.company} (${cvDates(e.start, e.end)})`, ...e.bullets.map((b) => `- ${b}`)].join("\n")),
    ...cv.education.map((e) => `${e.degree}${e.field ? `, ${e.field}` : ""}, ${e.school}${e.year ? ` (${e.year})` : ""}`),
    ...(cv.sections ?? []).map((s) => sectionBlock(s)),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function readInterviewSetup(db: AnyDb, user: User, selectedApplicationId: string | null, aiEnabled: boolean): Promise<InterviewSetupData> {
  const [{ profile }, cvText, applications] = await Promise.all([readProfile(db, user), readCvText(db, user.id), readApplications(db, user.id)]);
  const withDocs = await Promise.all(
    applications.map(async (a) => ({
      id: a.id,
      role: a.role,
      company: a.company,
      hasPosting: Boolean(a.job),
      documents: (await applicationDocuments(db, user.id, a.id)).map((d) => d.label),
    })),
  );
  return {
    aiEnabled,
    profileEmpty: profile.experience.length === 0 && profile.skills.length === 0 && !cvText,
    suggestedRole: profile.desiredRoles[0] ?? profile.headline ?? "",
    applications: withDocs,
    selectedApplicationId: applications.some((a) => a.id === selectedApplicationId) ? selectedApplicationId : null,
  };
}

/* Start --------------------------------------------------------------------- */

/** Freeze what the candidate sent, plan the questions, and save the session with its first question. */
export async function startInterview(db: AnyDb, user: User, setup: InterviewSetup, config: AiConfig): Promise<string> {
  const [{ profile }, profileCv] = await Promise.all([readProfile(db, user), readCvText(db, user.id)]);

  let role = setup.targetRole;
  let company: string | null = setup.company || null;
  let job: string | null = null;
  const documents: { label: string; text: string }[] = [];

  if (setup.applicationId) {
    const application = await readApplication(db, user.id, setup.applicationId);
    if (!application) throw new Error("Application not found.");
    role = application.role;
    company = application.company;
    job = application.job ? jobBlock(evaluationJobOf(application.job)) : null;
    documents.push(...(await applicationDocuments(db, user.id, application.id)));
  } else if (setup.jobDescription) {
    job = [`Title: ${role}`, company && `Company: ${company}`, `Description:\n${clip(setup.jobDescription, 6000)}`].filter(Boolean).join("\n");
  }
  // The CV the employer saw: the tailored one if there is one, else the profile's.
  if (!documents.some((d) => d.label === "Tailored CV") && profileCv) documents.unshift({ label: "CV", text: profileCv });

  const context: InterviewContext = { candidateName: profile.name || user.name, candidate: candidateBlock(profile, null), job, documents };
  const focus = setup.focus === "posting" && !job ? "behavioral" : setup.focus;
  const panel = setup.panel ? panelFor(focus) : null;
  const plan = await planInterview(
    { context, role, company, cvText: profileCv, focus, count: INTERVIEW_LENGTHS[setup.length].questions, style: setup.style, drill: setup.drill, panel },
    config,
  );

  const [row] = await db
    .insert(schema.interviewSession)
    .values({
      userId: user.id,
      applicationId: setup.applicationId,
      title: `${setup.drill ? "Weak-spot drill" : FOCUS_INFO[focus].label} · ${role}${company ? ` at ${company}` : ""}`,
      targetRole: role,
      company,
      focus,
      length: setup.length,
      style: setup.style,
      drill: setup.drill,
      panel,
      context,
      plan,
      turns: [turn({ from: "interviewer", kind: "question", q: 0, text: plan[0].question, speaker: plan[0].panelist })],
      report: emptyReport(plan.length),
    })
    .returning({ id: schema.interviewSession.id });
  return row.id;
}

/** Write (or rewrite) the pre-interview briefing from the current profile and the session's posting. */
export async function prepareInterviewBriefing(db: AnyDb, user: User, id: string, config: AiConfig): Promise<InterviewView> {
  const row = await mustRead(db, user.id, id);
  const { profile } = await readProfile(db, user);
  const briefing = await prepareBriefing(
    {
      candidate: candidateBlock(profile, null),
      // The numbers candidateBlock gives each role, so a story always points at a real one.
      roles: profile.experience.map((e) => `${e.role} at ${e.company}`),
      job: row.context.job,
      role: row.targetRole,
      company: row.company,
    },
    config,
  );
  return save(db, row, { briefing: { ...briefing, model: describeAiConfig(config), at: now() } });
}

/* During the interview ------------------------------------------------------ */

/** The interviewer's next turn after question `q` is done: the next question, the closing question, or the end. */
/** In a panel interview, who asks question `q` and who else is on the panel. */
function speakerOf(view: InterviewView, q: number): { as: Panelist; other: Panelist } | null {
  if (!view.panel) return null;
  const i = view.plan[q]?.panelist ?? 0;
  return { as: view.panel[i], other: view.panel[1 - i] };
}

function moveOn(view: InterviewView, q: number, lead: string): { turns: InterviewTurn[]; status: InterviewStatus } {
  const next = q + 1;
  if (next < view.plan.length) return { turns: [turn({ from: "interviewer", kind: "question", q: next, text: view.plan[next].question, lead, speaker: view.plan[next].panelist })], status: "active" };
  if (next === view.plan.length) return { turns: [turn({ from: "interviewer", kind: "closing", q: next, text: CLOSING_QUESTION, lead, speaker: view.panel ? 0 : undefined })], status: "active" };
  return { turns: [turn({ from: "interviewer", kind: "wrap", q: view.plan.length, text: WRAP_UP, lead })], status: "ended" };
}

function awaiting(row: Row): { view: InterviewView; q: number; followUps: number; inClosing: boolean } {
  const view = toView(row);
  const state = interviewState(view);
  if (!state.awaitingAnswer) throw new Error("This interview isn't waiting for an answer.");
  return { view, ...state };
}

/** Save the candidate's answer and get the interviewer's next turn: a follow-up, the next question, or the end. */
export async function answerInterview(
  db: AnyDb,
  userId: string,
  id: string,
  answer: string,
  config: AiConfig,
  spoken: { seconds: number } | null = null,
): Promise<InterviewView> {
  const row = await mustRead(db, userId, id);
  const { view, q, followUps, inClosing } = awaiting(row);
  const reply = turn({ from: "candidate", kind: "answer", q, text: answer, ...(spoken ? { spoken } : {}) });

  if (inClosing) {
    return save(db, row, { turns: [...view.turns, reply, turn({ from: "interviewer", kind: "wrap", q, text: WRAP_UP })], status: "ended" });
  }

  // Code holds the cap (it depends on the style): past it the interviewer moves on whatever the model would say.
  const left = STYLE_INFO[view.style].followUps - followUps;
  const decision =
    left > 0
      ? await decideTurn(
          {
            role: view.targetRole,
            company: view.company,
            question: view.plan[q],
            exchange: [...view.turns.filter((t) => t.q === q), reply],
            followUpsLeft: left,
            speaker: speakerOf(view, q),
            style: view.style,
            customPrompt: await readInterviewPrompt(db, userId),
          },
          config,
        )
      : { followUp: null, acknowledgement: "Okay, thanks." };

  const next = decision.followUp
    ? { turns: [turn({ from: "interviewer", kind: "follow_up", q, text: decision.followUp, speaker: view.plan[q].panelist })], status: "active" as const }
    : moveOn(view, q, decision.acknowledgement);
  return save(db, row, { turns: [...view.turns, reply, ...next.turns], status: next.status });
}

/** Skip the question in play (or the closing question) and move on. No model call. */
export async function skipInterviewQuestion(db: AnyDb, userId: string, id: string): Promise<InterviewView> {
  const row = await mustRead(db, userId, id);
  const { view, q, inClosing } = awaiting(row);
  const skipped = turn({ from: "candidate", kind: "skip", q, text: "" });
  const next = inClosing ? { turns: [turn({ from: "interviewer", kind: "wrap", q, text: WRAP_UP })], status: "ended" as const } : moveOn(view, q, "Okay, let's move on.");
  return save(db, row, { turns: [...view.turns, skipped, ...next.turns], status: next.status });
}

/** Stop the interview now; what was answered still gets graded. */
export async function endInterview(db: AnyDb, userId: string, id: string): Promise<InterviewView> {
  const row = await mustRead(db, userId, id);
  const view = toView(row);
  if (view.status !== "active") return view;
  const q = interviewState(view).q;
  return save(db, row, { turns: [...view.turns, turn({ from: "interviewer", kind: "wrap", q, text: ENDED_EARLY })], status: "ended" });
}

/* After the interview ------------------------------------------------------- */

const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;

/**
 * One step of the report, one model call each: grade the next ungraded question, then write
 * the summary (so the verdict shows as soon as the grades are in), then for each graded answer
 * check it against the documents and write a stronger version, then mark the session done.
 * The page calls this until it's done, so a local model only ever has one request at a time
 * and progress survives a reload.
 */
export async function gradeInterviewStep(db: AnyDb, userId: string, id: string, config: AiConfig): Promise<InterviewView> {
  const row = await mustRead(db, userId, id);
  const view = toView(row);
  if (view.status === "active") throw new Error("Finish or end the interview first.");
  if (view.status === "done") return view;

  const results = [...view.report.results];
  for (let i = 0; i < view.plan.length; i++) {
    if (results[i]) continue;
    const exchange = view.turns.filter((t) => t.q === i);
    const answers = exchange.filter((t) => t.kind === "answer");
    if (!exchange.some((t) => t.from === "interviewer")) {
      results[i] = { status: "not_reached" };
      continue;
    }
    if (answers.length === 0) {
      // Asked but never answered because the interview ended there: not a skip.
      results[i] = exchange.some((t) => t.kind === "skip") ? { status: "skipped" } : { status: "not_reached" };
      continue;
    }
    const grade = await gradeAnswer({ role: view.targetRole, company: view.company, question: view.plan[i], exchange }, config);
    results[i] = {
      status: "graded",
      words: answers.reduce((n, a) => n + wordCount(a.text), 0),
      followUps: exchange.filter((t) => t.kind === "follow_up").length,
      ...grade,
    } satisfies QuestionResult;
    return save(db, row, { report: { ...view.report, results, model: describeAiConfig(config), at: now() } });
  }

  const graded = results.some((r) => r?.status === "graded");
  if (!view.report.summary) {
    if (!graded) {
      const summary = {
        headline: "You ended the interview before answering a question, so there's nothing to grade yet.",
        strengths: [],
        focusAreas: ["Run the interview again and answer at least one question."],
        questionsFeedback: "",
      };
      return save(db, row, { report: { results, summary, model: null, at: now() }, status: "done" });
    }
    const candidateQuestions = view.turns
      .filter((t) => t.q === view.plan.length && t.kind === "answer")
      .map((t) => t.text)
      .join("\n");
    const summary = await summarizeInterview({ role: view.targetRole, plan: view.plan, results, candidateQuestions }, config);
    return save(db, row, { report: { ...view.report, results, summary, model: describeAiConfig(config), at: now() } });
  }

  for (let i = 0; i < view.plan.length; i++) {
    const r = results[i];
    if (r?.status !== "graded" || r.coached) continue;
    const input = { question: view.plan[i], exchange: view.turns.filter((t) => t.q === i), context: row.context };
    if (!r.checked) {
      results[i] = { ...r, checked: true, flags: await checkClaims(input, config) };
    } else {
      results[i] = { ...r, coached: true, refined: await refineAnswer({ ...input, flags: r.flags ?? [] }, config) };
    }
    return save(db, row, { report: { ...view.report, results, at: now() } });
  }

  return save(db, row, { status: "done" });
}

export async function readInterviewPrompt(db: AnyDb, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ prompt: schema.userSettings.interviewPrompt })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return row?.prompt ?? null;
}

/** Answer one question again after the interview and grade it on the same rubric, for comparison. */
export async function redoInterviewQuestion(db: AnyDb, userId: string, id: string, q: number, answer: string, config: AiConfig): Promise<InterviewView> {
  const row = await mustRead(db, userId, id);
  const view = toView(row);
  if (view.status !== "done") throw new Error("Wait for the report to finish first.");
  const question = view.plan[q];
  if (!question) throw new Error("That question isn't in this interview.");
  const exchange = [
    turn({ from: "interviewer", kind: "question", q, text: question.question }),
    turn({ from: "candidate", kind: "answer", q, text: answer }),
  ];
  const grade = await gradeAnswer({ role: view.targetRole, company: view.company, question, exchange }, config);
  const redos = { ...view.report.redos };
  redos[q] = [...(redos[q] ?? []), { answer, at: now(), words: wordCount(answer), ...grade }].slice(-MAX_REDOS);
  return save(db, row, { report: { ...view.report, redos } });
}

/** Scores over time, rubric trends, weak spots for a drill, and upcoming interview dates. */
export async function readInterviewProgress(db: AnyDb, userId: string): Promise<InterviewProgress> {
  const [rows, applications] = await Promise.all([
    db
      .select()
      .from(schema.interviewSession)
      .where(and(eq(schema.interviewSession.userId, userId), eq(schema.interviewSession.status, "done")))
      .orderBy(asc(schema.interviewSession.createdAt)),
    readApplications(db, userId),
  ]);
  const graded = rows
    .map(toView)
    .map((view) => ({ view, score: averageScore(view.report.results) }))
    .filter((s): s is { view: InterviewView; score: number } => s.score !== null);

  const avgOf = (sessions: typeof graded, key: RubricKey) => {
    const scores = sessions.flatMap((s) => s.view.report.results.flatMap((r) => (r?.status === "graded" ? [r.scores[key]] : [])));
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  };
  const recent = graded.slice(-3);
  const earlier = graded.slice(0, -3);
  const dimensions = (Object.keys(RUBRIC) as RubricKey[]).flatMap((key) => {
    const r = avgOf(recent, key);
    return r === null ? [] : [{ key, recent: r, earlier: avgOf(earlier, key) }];
  });

  // The lowest question scores in the last 5 interviews, one per competency.
  const byCompetency = new Map<string, { competency: string; score: number }>();
  for (const { view } of graded.slice(-5)) {
    view.plan.forEach((question, i) => {
      const r = view.report.results[i];
      if (r?.status !== "graded") return;
      const key = question.competency.toLowerCase();
      const score = gradeScore(r);
      const seen = byCompetency.get(key);
      if (!seen || score < seen.score) byCompetency.set(key, { competency: question.competency, score });
    });
  }
  const weakest = [...byCompetency.values()].filter((c) => c.score < 3).sort((a, b) => a.score - b.score).slice(0, 3);
  const weakDimensions = dimensions
    .filter((d) => d.recent < 3)
    .sort((a, b) => a.recent - b.recent)
    .slice(0, 2)
    .map((d) => `${RUBRIC[d.key].label}: ${RUBRIC[d.key].hint}`);

  const latest = graded.at(-1)?.view;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);

  return {
    sessions: graded.slice(-12).map(({ view, score }) => ({ id: view.id, title: view.title, date: view.createdAt, score })),
    dimensions,
    weakest,
    drill:
      latest && weakest.length
        ? {
            applicationId: latest.applicationId,
            role: latest.targetRole,
            company: latest.company,
            // A drill needs questions to drill: a screen has none worth repeating, and a pasted posting isn't kept for a new session.
            focus: latest.focus === "screen" || (latest.focus === "posting" && !latest.applicationId) ? "behavioral" : latest.focus,
            competencies: weakest.map((w) => w.competency),
            dimensions: weakDimensions,
          }
        : null,
    upcoming: applications
      .flatMap((a) => (a.interviewAt && a.interviewAt >= yesterday ? [{ applicationId: a.id, role: a.role, company: a.company, interviewAt: a.interviewAt }] : []))
      .sort((a, b) => a.interviewAt.getTime() - b.interviewAt.getTime()),
  };
}

export async function deleteInterview(db: AnyDb, userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.interviewSession)
    .where(and(eq(schema.interviewSession.id, id), eq(schema.interviewSession.userId, userId)))
    .returning({ id: schema.interviewSession.id });
  return deleted.length > 0;
}
