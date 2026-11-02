import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { companyRefs, readFollowedCompanies } from "@/lib/companies/queries";
import * as schema from "@/lib/db/schema";
import { toggleSaved } from "@/lib/jobs/applications";
import { evaluateStoredJob } from "@/lib/jobs/fit-evaluation";
import { readPaste } from "@/lib/jobs/paste/review";
import { storePastedJob, writeJobCheck } from "@/lib/jobs/paste/store";
import { canCheckJob, pastedJobSchema } from "@/lib/jobs/paste/types";
import { readEvaluatedJobs, readFitMatches, readJob, readJobRow, readTrackedJobs, sortJobs, storeJobs, toListItem } from "@/lib/jobs/queries";
import { FIT_FILTERS, parseJobSearch, POSTED_WITHIN_DAYS } from "@/lib/jobs/search-params";
import { readProfile } from "@/lib/profile/queries";
import { AI_NOT_SET_UP, notFound } from "../errors";
import { answerInput, POSTING_NOTE, tool, ToolError, writerFor, type McpContext } from "../tool";
import { jobDetail, jobSummary } from "../views";

async function jobOrThrow(ctx: McpContext, jobId: string) {
  const { profile } = await readProfile(ctx.db, ctx.user);
  const job = await readJob(ctx.db, ctx.user.id, jobId, profile);
  if (!job) throw notFound("job", jobId);
  return job;
}

const jobId = z.string().min(1).max(100).describe("A job id from search_jobs, get_job or list_applications.");

export const searchJobs = tool({
  name: "search_jobs",
  title: "Search for jobs",
  description:
    "The same search as RolePort's Jobs page, across every job source the user has on, plus the companies they follow. Leave out query or country to use the profile's first desired role and home country. Returns jobs with a quick skill match (free) and the AI fit score when one was run. Jobs found are stored, so their ids work with the other tools.",
  input: {
    query: z.string().max(200).optional().describe('Job title or keywords, e.g. "data analyst".'),
    country: z.string().max(60).optional().describe('Country name or ISO code, e.g. "PH", "Singapore".'),
    location: z
      .string()
      .max(60)
      .optional()
      .describe('"remote" for remote jobs open to people in the country. In the Philippines, an area id such as "metro-manila" or "cebu".'),
    city: z.string().max(80).optional().describe("A city, for countries outside the Philippines."),
    work_setup: z.enum(["onsite", "hybrid", "remote"]).optional(),
    posted_within_days: z
      .number()
      .int()
      .optional()
      .describe(`One of ${POSTED_WITHIN_DAYS.join(", ")}. Default 30.`),
    sort: z.enum(["match", "date"]).optional().describe("Best match first (default) or newest first."),
    limit: z.number().int().min(1).max(50).optional().describe("Default 20."),
    offset: z.number().int().min(0).optional(),
  },
  writes: false,
  external: true,
  async run(args, ctx) {
    const { profile } = await readProfile(ctx.db, ctx.user);
    const { params, sort } = parseJobSearch(
      {
        q: args.query,
        country: args.country,
        loc: args.location,
        city: args.city,
        setup: args.work_setup,
        days: args.posted_within_days?.toString(),
        sort: args.sort,
      },
      profile,
    );
    if (!params.query) throw new ToolError("Say what to search for: the profile has no desired roles to fall back on.");

    const followed = await readFollowedCompanies(ctx.db, ctx.user.id);
    const { jobs, statuses } = await ctx.search(params, companyRefs(followed));
    const rows = await storeJobs(ctx.db, jobs);
    const [tracked, fits] = await Promise.all([readTrackedJobs(ctx.db, ctx.user.id), readFitMatches(ctx.db, ctx.user.id, rows.map((r) => r.id))]);
    const items = sortJobs(
      rows.map((row) => toListItem(row, profile, tracked, fits)),
      sort,
    );
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;
    return {
      search: params,
      total: items.length,
      jobs: items.slice(offset, offset + limit).map(jobSummary),
      ...(offset + limit < items.length && { next: { offset: offset + limit } }),
      sources: statuses.map((s) => ({ source: s.label, found: s.count, ...(s.failed && { failed: true }), ...(s.note && { note: s.note }) })),
      ...(profile.skills.length === 0 && { note: "The profile has no skills, so quickMatch is empty. Import a CV on the Profile page." }),
    };
  },
});

export const getJob = tool({
  name: "get_job",
  title: "Read a job",
  description: "One job: the posting, its quick match, the AI fit evaluation if there is one, whether it's still open, and whether the user saved or applied.",
  input: { job_id: jobId, full: z.boolean().optional().describe("The whole description instead of the first 4,000 characters.") },
  writes: false,
  async run({ job_id, full }, ctx) {
    return { ...jobDetail(await jobOrThrow(ctx, job_id), Boolean(full)), note: POSTING_NOTE };
  },
});

export const saveJob = tool({
  name: "save_job",
  title: "Save a job",
  description: "Puts a job on the user's list as saved, like the Save button. Does nothing if it's already on the list.",
  input: { job_id: jobId },
  writes: true,
  async run({ job_id }, ctx) {
    const job = await jobOrThrow(ctx, job_id);
    if (job.application) return { saved: true, application: job.application, note: "Already on the user's list." };
    await toggleSaved(ctx.db, ctx.user.id, job_id);
    return { saved: true, application: (await jobOrThrow(ctx, job_id)).application };
  },
});

export const unsaveJob = tool({
  name: "unsave_job",
  title: "Unsave a job",
  description: "Takes a saved job off the user's list. Only for jobs still in \"saved\": applications further along are kept.",
  input: { job_id: jobId },
  writes: true,
  async run({ job_id }, ctx) {
    const [app] = await ctx.db
      .select()
      .from(schema.application)
      .where(and(eq(schema.application.userId, ctx.user.id), eq(schema.application.jobId, job_id)));
    if (!app) return { saved: false, note: "It wasn't on the user's list." };
    if (app.status !== "saved") throw new ToolError(`This job is tracked as "${app.status}", so it stays. Use set_status to change it.`);
    await toggleSaved(ctx.db, ctx.user.id, job_id);
    return { saved: false };
  },
});

export const addJob = tool({
  name: "add_job",
  title: "Add a job from a link or text",
  description:
    "RolePort's Paste a job: give a job link or the posting's text and it's read, checked and saved on the user's list. Hiring-system links (Greenhouse, Lever, Ashby…) and pages with job data need no AI. Plain text is read by the AI set up in RolePort, or by you: then this returns a brief to answer. LinkedIn, Facebook, Indeed and Glassdoor pages can't be read: paste their text instead. If a field couldn't be read, the result says which; call again with `fields` to fill them in.",
  input: {
    input: z.string().min(1).max(60_000).describe("A job link, or the posting's full text."),
    fields: z
      .object({
        title: z.string().max(200),
        company: z.string().max(200),
        location: z.string().max(200),
        url: z.string().max(2000),
        work_setup: z.enum(["onsite", "hybrid", "remote"]),
      })
      .partial()
      .optional()
      .describe("Values to use instead of what was read, e.g. a missing company name."),
    answer: answerInput,
  },
  writes: true,
  external: true,
  async run({ input, fields, answer }, ctx) {
    // Without any AI, text can still be added: the fields are then filled in by hand.
    const config = answer === undefined && ctx.writer === "roleport" ? await ctx.ai() : await writerFor(ctx, answer, AI_NOT_SET_UP);
    const read = await readPaste(input, { readLink: ctx.readLink, config });
    if (!read.ok) throw new ToolError(read.error);
    const review = read.data;
    const job = {
      ...review.job,
      ...(fields?.title && { title: fields.title }),
      ...(fields?.company && { company: fields.company }),
      ...(fields?.location && { location: fields.location }),
      ...(fields?.url && { url: fields.url }),
      ...(fields?.work_setup && { workSetup: fields.work_setup }),
    };
    const parsed = pastedJobSchema.safeParse(job);
    if (!parsed.success) {
      return {
        saved: false,
        problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        read: { title: job.title, company: job.company, location: job.location, url: job.url, workSetup: job.workSetup },
        notes: review.notes,
        next: "Ask the user for the missing values and call add_job again with `fields`.",
      };
    }
    const id = await storePastedJob(ctx.db, ctx.user.id, parsed.data, review.check);
    return {
      saved: true,
      job: jobSummary(await jobOrThrow(ctx, id)),
      readWith: review.how,
      notes: review.notes,
      ...(review.board && { company: { hiringSystem: review.board.label, careersUrl: review.board.careersUrl, note: "The user can follow this company from RolePort's Jobs page." } }),
    };
  },
});

export const checkJobOpen = tool({
  name: "check_job_open",
  title: "Check a job is still open",
  description: "RolePort's Check again: reads the posting again to see whether it's still open. Works for company-feed jobs and pasted links. Saves the answer on the job.",
  input: { job_id: jobId },
  writes: true,
  external: true,
  async run({ job_id }, ctx) {
    const job = await readJobRow(ctx.db, job_id);
    if (!job) throw notFound("job", job_id);
    if (!canCheckJob(job)) throw new ToolError("RolePort can't check jobs from this source.");
    const check = await ctx.checkPosting(job);
    await writeJobCheck(ctx.db, job.id, check);
    return check;
  },
});

export const evaluateJob = tool({
  name: "evaluate_job",
  title: "Evaluate fit",
  description:
    "Runs RolePort's AI fit evaluation of one job against the profile (eligibility, language and location gates, then skills, experience, culture and career) and saves it. Written by the AI set up in RolePort, or by you: then this returns a brief to answer.",
  input: { job_id: jobId, answer: answerInput },
  writes: true,
  external: true,
  async run({ job_id, answer }, ctx) {
    if (!(await readJobRow(ctx.db, job_id))) throw notFound("job", job_id);
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    await evaluateStoredJob(ctx.db, ctx.user, job_id, config);
    return jobDetail(await jobOrThrow(ctx, job_id), false).fit;
  },
});

export const listEvaluatedJobs = tool({
  name: "list_evaluated_jobs",
  title: "List evaluated jobs",
  description:
    "Every job the user has had evaluated (in the app or through an agent), with its fit score and recommendation, best fit first or most recent first. Use it to look back at earlier evaluations instead of searching again. The same list is in RolePort under Jobs → Jobs you've evaluated.",
  input: {
    query: z.string().max(120).optional().describe("Words that must appear in the job title or company."),
    fit: z
      .enum(FIT_FILTERS)
      .optional()
      .describe('"worth": good fit or better (60+, not ruled out); "strong": 75+ and not ruled out; "ruled_out": failed a gate, closed or past its deadline. Default all.'),
    sort: z.enum(["score", "recent"]).optional().describe("Best fit first (default) or most recently evaluated first."),
    limit: z.number().int().min(1).max(50).optional().describe("Default 20."),
    offset: z.number().int().min(0).optional(),
  },
  writes: false,
  async run({ query = "", fit = "all", sort = "score", limit = 20, offset = 0 }, ctx) {
    const { profile } = await readProfile(ctx.db, ctx.user);
    const { jobs, total } = await readEvaluatedJobs(ctx.db, ctx.user.id, profile, { query, fit, sort });
    return {
      evaluated: total,
      matching: jobs.length,
      jobs: jobs.slice(offset, offset + limit).map((j) => ({ ...jobSummary(j), evaluatedAt: j.fit!.scoredAt.toISOString() })),
      ...(offset + limit < jobs.length && { next: { offset: offset + limit } }),
    };
  },
});
