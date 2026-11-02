import { z } from "zod";

/*
 * Ready-made requests the MCP server offers. Agents list them as slash commands (Claude Code:
 * /mcp__roleport__find_jobs) or in their attach menu (Claude Desktop), so a user picks one
 * instead of working out what to ask. Each is a short plan written for the agent, naming the
 * tools to call. Prompt arguments are always text and optional; the prompt says what to do
 * when one is left out.
 */

export type McpPrompt = {
  name: string;
  title: string;
  description: string;
  args: Record<string, string>;
  /** Uses tools that change data: left out in Read only. */
  writes: boolean;
  text: (args: Record<string, string | undefined>) => string;
};

const or = (value: string | undefined, fallback: string) => (value?.trim() ? `"${value.trim()}"` : fallback);

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "find_jobs",
    title: "Find and evaluate jobs",
    description: "Search RolePort for jobs, evaluate the most promising ones and save the good ones.",
    args: { role: "Job title or keywords (optional: the profile's roles otherwise)", where: "Country, city or \"remote\" (optional)" },
    writes: true,
    text: ({ role, where }) =>
      [
        `Find jobs for me in RolePort for ${or(role, "the roles in my profile (read them with get_profile)")}${where?.trim() ? ` in ${where.trim()}` : ""}.`,
        "1. Call search_jobs. Show me the 10 best matches as a short list: title, company, location, work setup, quick match score.",
        "2. Evaluate the 3 with the best quick match with evaluate_job, one at a time, unless I pick others.",
        "3. Show each fit score, its recommendation and the main gaps. Ask before saving any with save_job.",
        "Keep it brief. Don't apply to anything.",
      ].join("\n"),
  },
  {
    name: "mock_interview",
    title: "Mock interview",
    description: "Practise an interview in RolePort's Interview Coach, here in the chat, then get it graded.",
    args: {
      for: "An application (company or role) or a role to practise for (optional: you'll be asked)",
      length: "quick (3 questions) or full (6) (optional, default quick)",
      style: "friendly, standard, tough or hell (optional, default standard)",
    },
    writes: true,
    text: (a) =>
      [
        `Run a mock interview for me with RolePort's Interview Coach, for ${or(a.for, "something I choose: list my applications with list_applications and ask which one, or which role")}.`,
        `Use start_mock_interview with length ${or(a.length, '"quick"')} and style ${or(a.style, '"standard"')}. If it matches one of my applications, pass its application_id.`,
        "Then be the go-between: ask me each question exactly as RolePort words it, and send my reply word for word with answer_interview. Don't hint, coach or comment during the interview.",
        'If I say "skip", use skip_interview_question; if I say "stop", use end_interview.',
        "When it's over, call get_interview_report (again until it's graded) and give me the verdict, my best and weakest answers, and the two things to work on. Tell me I can open the full report on RolePort's Coach page.",
      ].join("\n"),
  },
  {
    name: "prepare_application",
    title: "Prepare an application",
    description: "Tailor the CV, write the cover letter and draft the application email for one job.",
    args: { job: "The job: its title and company, or a link (optional: you'll be asked)" },
    writes: true,
    text: ({ job }) =>
      [
        `Prepare my application in RolePort for ${or(job, "a job I pick: show my saved jobs with list_applications (status saved) and ask")}.`,
        "1. Find it: in list_applications, or in list_evaluated_jobs, or add it with add_job if it's a link. If it isn't on my list yet, save it with save_job; that gives the application id.",
        "2. Tailor my CV with tailor_cv and show the checks (keywords missing, claims to verify).",
        "3. Write the cover letter with draft_cover_letter and show its warnings.",
        "4. Draft the application email with draft_email (kind application) and give me its mailto link.",
        "Don't mark it applied: I'll tell you once I've sent it.",
      ].join("\n"),
  },
  {
    name: "follow_ups",
    title: "Follow-ups due",
    description: "See which follow-ups are due and draft them.",
    args: {},
    writes: true,
    text: () =>
      [
        "Check my follow-ups in RolePort with follow_ups_due.",
        "List what's due now and what's coming up this week. For each one due now, draft it with draft_email (the kind it gives) and show the draft with its mailto link.",
        "When I say I've sent one, record it with mark_email_sent. Don't record anything I haven't sent.",
      ].join("\n"),
  },
  {
    name: "import_cv",
    title: "Import my CV",
    description: "Read your CV into RolePort's profile.",
    args: {},
    writes: true,
    text: () =>
      [
        "Import my CV into RolePort's profile.",
        "Ask me to attach my CV or paste it, if I haven't. Read it as plain text and call import_cv with it (without save).",
        "Show me the draft: headline, skills, experience and education. Ask what to fix.",
        "Only after I agree, call import_cv again with save: true. Then remind me to set my desired roles and countries on RolePort's Profile page if they're empty.",
      ].join("\n"),
  },
  {
    name: "review_evaluated_jobs",
    title: "Look back at evaluated jobs",
    description: "Go through the jobs you've already evaluated and decide what's worth applying to.",
    args: { fit: "all, worth (good fit or better), strong or ruled_out (optional, default worth)" },
    writes: false,
    text: ({ fit }) =>
      [
        `Show me the jobs I've evaluated in RolePort with list_evaluated_jobs (fit ${or(fit, '"worth"')}).`,
        "Group them: not on my list yet, saved, applied. For each, one line: title, company, score, and the recommendation.",
        "Point out any that look closed or past their deadline. Suggest which 2 or 3 to apply to first, and why.",
      ].join("\n"),
  },
  {
    name: "my_week",
    title: "My job search this week",
    description: "Where your applications stand and what to do next.",
    args: {},
    writes: false,
    text: () =>
      [
        "Give me a short update on my job search from RolePort.",
        "Use list_applications, follow_ups_due and list_mock_interviews. Tell me: applications by status, follow-ups due now, interviews coming up, and the 3 most useful things to do this week.",
      ].join("\n"),
  },
];

/** A prompt's arguments as the SDK wants them: optional text fields with their descriptions. */
export function promptArgs(p: McpPrompt) {
  return Object.fromEntries(Object.entries(p.args).map(([name, about]) => [name, z.string().optional().describe(about)]));
}
