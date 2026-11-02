import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { markApplied, readApplication, readApplications, setStatus, writeInterviewDate, writeNotes } from "@/lib/jobs/applications";
import { readDashboard } from "@/lib/jobs/dashboard";
import { readOutreachDocs, readOutreachSummary } from "@/lib/outreach/outreach";
import { notFound } from "../errors";
import { tool, ToolError } from "../tool";
import { applicationSummary } from "../views";

/** Added to the status history of every change an agent makes, so the user can tell. */
export const VIA_AGENT = "(via AI agent)";

const MAX_NOTES = 10_000;
const STATUSES = schema.applicationStatus.enumValues;

export const applicationId = z.string().min(1).max(100).describe("An application id from list_applications or apply_to_job.");

export const listApplications = tool({
  name: "list_applications",
  title: "List applications",
  description: `The user's tracker: every saved and applied job with its status (${STATUSES.join(", ")}), dates and next follow-up. Newest first.`,
  input: {
    status: z.enum(STATUSES).optional().describe("Only applications in this status."),
    limit: z.number().int().min(1).max(100).optional().describe("Default 30."),
    offset: z.number().int().min(0).optional(),
  },
  writes: false,
  async run({ status, limit = 30, offset = 0 }, ctx) {
    const all = (await readApplications(ctx.db, ctx.user.id)).filter((a) => !status || a.status === status);
    return {
      total: all.length,
      applications: all.slice(offset, offset + limit).map(applicationSummary),
      ...(offset + limit < all.length && { next: { offset: offset + limit } }),
    };
  },
});

export const getApplication = tool({
  name: "get_application",
  title: "Read an application",
  description:
    "One application: status history, notes, interview date, contacts, the emails sent and the next follow-up, and which documents (tailored CV, cover letter) exist. Use get_job with its jobId for the posting.",
  input: { application_id: applicationId },
  writes: false,
  async run({ application_id }, ctx) {
    const app = await readApplication(ctx.db, ctx.user.id, application_id);
    if (!app) throw notFound("application", application_id);
    const [outreach, docs, documents] = await Promise.all([
      readOutreachSummary(ctx.db, ctx.user.id, application_id),
      readOutreachDocs(ctx.db, ctx.user.id),
      ctx.db
        .select({ kind: schema.document.kind, title: schema.document.title, updatedAt: schema.document.updatedAt })
        .from(schema.document)
        .where(and(eq(schema.document.userId, ctx.user.id), eq(schema.document.applicationId, application_id))),
    ]);
    const doc = docs.get(application_id);
    return {
      ...applicationSummary(app),
      notes: app.notes,
      history: app.events.map((e) => ({ status: e.status, note: e.note, at: e.occurredAt.toISOString() })),
      contacts: doc?.contacts ?? [],
      emails: {
        drafts: Object.keys(doc?.drafts ?? {}),
        sent: (doc?.sent ?? []).map((s) => ({ kind: s.kind, to: s.to, subject: s.subject, at: s.at })),
        next: outreach?.next ?? null,
        paused: outreach?.paused ?? false,
      },
      documents: documents
        .filter((d) => d.kind === "cv" || d.kind === "cover_letter")
        .map((d) => ({ kind: d.kind, title: d.title, updatedAt: d.updatedAt.toISOString() })),
    };
  },
});

export const followUpsDue = tool({
  name: "follow_ups_due",
  title: "Follow-ups due",
  description:
    "What RolePort's Home shows under Follow up: follow-ups due now, then the ones coming in the next two weeks, from the user's reminder rules. Draft one with draft_email.",
  input: {},
  writes: false,
  async run(_, ctx) {
    const { followUps } = await readDashboard(ctx.db, ctx.user.id);
    return {
      followUps: followUps.map((f) => ({ applicationId: f.id, company: f.company, role: f.role, kind: f.kind, label: f.label, when: f.when, due: f.due, dueAt: f.dueAt })),
    };
  },
});

export const applyToJob = tool({
  name: "apply_to_job",
  title: "Mark a job as applied",
  description:
    "Moves a job to Applied in the user's tracker (or adds it there), like RolePort's Apply button. It does NOT send an application anywhere: only call it once the user has applied or says to. Returns the application id for tailor_cv, draft_cover_letter and draft_email.",
  input: { job_id: z.string().min(1).max(100) },
  writes: true,
  async run({ job_id }, ctx) {
    const applied = await markApplied(ctx.db, ctx.user.id, job_id, VIA_AGENT);
    if (!applied) throw notFound("job", job_id);
    const app = await readApplication(ctx.db, ctx.user.id, applied.applicationId);
    return { ...applicationSummary(app!), ...(!applied.changed && { note: "It was already further along, so it wasn't moved." }) };
  },
});

export const setApplicationStatus = tool({
  name: "set_status",
  title: "Change an application's status",
  description: `Moves an application to another status: ${STATUSES.join(", ")}. The change shows in its history marked "${VIA_AGENT}".`,
  input: { application_id: applicationId, status: z.enum(STATUSES) },
  writes: true,
  async run({ application_id, status }, ctx) {
    const app = await readApplication(ctx.db, ctx.user.id, application_id);
    if (!app) throw notFound("application", application_id);
    const changed = await setStatus(ctx.db, ctx.user.id, application_id, status, VIA_AGENT);
    return { id: application_id, status, changed };
  },
});

export const setNotes = tool({
  name: "set_notes",
  title: "Replace an application's notes",
  description: "Replaces the application's notes with this text (empty clears them). Read them with get_application first to add to them.",
  input: { application_id: applicationId, notes: z.string().max(MAX_NOTES) },
  writes: true,
  async run({ application_id, notes }, ctx) {
    if (!(await writeNotes(ctx.db, ctx.user.id, application_id, notes))) throw notFound("application", application_id);
    return { id: application_id, saved: true };
  },
});

export const setInterviewDate = tool({
  name: "set_interview_date",
  title: "Set the interview date",
  description: "When the interview is, as an ISO date-time with its time zone (e.g. 2026-11-20T14:00:00+08:00), or null to clear it. Follow-up reminders use it.",
  input: { application_id: applicationId, at: z.string().max(40).nullable() },
  writes: true,
  async run({ application_id, at }, ctx) {
    const date = at === null ? null : new Date(at);
    if (date && Number.isNaN(date.getTime())) throw new ToolError("That date isn't valid. Use an ISO date-time such as 2026-11-20T14:00:00+08:00.");
    if (!(await writeInterviewDate(ctx.db, ctx.user.id, application_id, date))) throw notFound("application", application_id);
    return { id: application_id, interviewAt: date?.toISOString() ?? null };
  },
});
