/*
 * Copy-paste requests for an AI agent connected to RolePort over MCP, shown in the app where a
 * feature needs AI and RolePort has none (components/app/agent-prompt.tsx). Each names the exact
 * job, application or interview by id, so the agent calls the right tool straight away. Plain
 * text with no imports, so pages in both editions can use it.
 */

const opening = "Using RolePort (connected over MCP):";

type JobRef = { id: string; title: string; company: string };
type AppRef = { id: string; role: string; company: string };

const jobName = (j: Pick<JobRef, "title" | "company">) => `${j.title} at ${j.company}`;
const appName = (a: Pick<AppRef, "role" | "company">) => `${a.role} at ${a.company}`;

export function evaluateJobsPrompt(jobs: JobRef[]): string {
  if (jobs.length === 1) return evaluateJobPrompt(jobs[0]);
  return [
    `${opening} evaluate how well these ${jobs.length} jobs fit me, one at a time, with evaluate_job:`,
    ...jobs.map((j) => `- ${jobName(j)} (job_id ${j.id})`),
    "Then rank them by fit score and give me one line each: the score, the recommendation and the biggest gap. Don't save or apply to anything.",
  ].join("\n");
}

export function evaluateJobPrompt(job: JobRef): string {
  return [
    `${opening} evaluate how well ${jobName(job)} fits me, with evaluate_job (job_id ${job.id}).`,
    "Tell me the fit score, the recommendation, my strengths and the gaps, and whether anything rules it out.",
  ].join("\n");
}

export function prepareApplicationPrompt(app: AppRef): string {
  return [
    `${opening} prepare my application for ${appName(app)} (application_id ${app.id}).`,
    "1. Tailor my CV with tailor_cv and show the checks: keywords missing and claims to verify.",
    "2. Write the cover letter with draft_cover_letter and show its warnings.",
    "3. Draft the application email with draft_email (kind application) and give me its mailto link.",
    "Don't mark anything as sent or applied.",
  ].join("\n");
}

export function tailorCvPrompt(app: AppRef): string {
  return [
    `${opening} tailor my CV for ${appName(app)} with tailor_cv (application_id ${app.id}).`,
    "Show me the keywords it covers and misses, and every claim I should check before sending.",
  ].join("\n");
}

export function coverLetterPrompt(app: AppRef): string {
  return [
    `${opening} write my cover letter for ${appName(app)} with draft_cover_letter (application_id ${app.id}).`,
    "Show me the letter and its warnings.",
  ].join("\n");
}

export function draftEmailPrompt(app: AppRef, kind: { id: string; label: string }): string {
  return [
    `${opening} draft the "${kind.label}" email for ${appName(app)} with draft_email (application_id ${app.id}, kind ${kind.id}).`,
    "Show me the draft and its mailto link. When I tell you I've sent it, record it with mark_email_sent.",
  ].join("\n");
}

export type InterviewSetupRef = {
  applicationId: string | null;
  role: string;
  company: string;
  focus: string;
  length: string;
  style: string;
  panel: boolean;
  /** A posting the user pasted, to paste into the agent too (too long for the request itself). */
  pastedPosting?: boolean;
};

export function mockInterviewPrompt(s: InterviewSetupRef): string {
  const what = s.applicationId
    ? `for my application ${appName({ role: s.role, company: s.company })} (application_id ${s.applicationId})`
    : `for the role "${s.role}"${s.company ? ` at ${s.company}` : ""}`;
  return [
    `${opening} run a mock interview ${what} with start_mock_interview: focus ${s.focus}, length ${s.length}, style ${s.style}${s.panel ? ", panel true" : ""}.`,
    ...(s.pastedPosting ? ["I'll paste the job posting below this message: pass it as job_description."] : []),
    "Ask me each question exactly as RolePort words it, and send my reply word for word with answer_interview. Don't hint or coach during the interview.",
    'If I say "skip", use skip_interview_question; if I say "stop", use end_interview.',
    "When it's over, call get_interview_report until it's done, then give me the verdict, my best and weakest answers, and the two things to work on.",
  ].join("\n");
}

export function resumeInterviewPrompt(interview: { id: string; title: string }): string {
  return [
    `${opening} continue my mock interview "${interview.title}" (interview_id ${interview.id}).`,
    "Read where it stopped with get_mock_interview, ask me the question it's waiting on exactly as written, and keep going with answer_interview, word for word.",
    "When it's over, call get_interview_report until it's done and tell me how it went.",
  ].join("\n");
}

export function interviewReportPrompt(interview: { id: string; title: string }): string {
  return [
    `${opening} grade my mock interview "${interview.title}" with get_interview_report (interview_id ${interview.id}), calling it again until it's done.`,
    "Then give me the verdict, my best and weakest answers, and the two things to work on.",
  ].join("\n");
}

export function importCvPrompt(): string {
  return [
    `${opening} import my CV into my profile.`,
    "I'll attach or paste it. Read it as plain text and call import_cv with it (without save). Show me the draft and ask what to fix.",
    "Only after I agree, call import_cv again with save: true.",
  ].join("\n");
}

export function findJobsPrompt(): string {
  return [
    `${opening} find jobs for the roles in my profile with search_jobs, and evaluate the 3 with the best quick match with evaluate_job.`,
    "Show me each fit score and recommendation, and ask before saving any with save_job.",
  ].join("\n");
}
