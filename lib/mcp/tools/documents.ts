import { z } from "zod";
import { readApplication } from "@/lib/jobs/applications";
import { tailorApplicationCv } from "@/lib/cv/tailor";
import { draftApplicationLetter } from "@/lib/letter/letter";
import { draftOutreachEmail, markOutreachSent, readOutreachDocs } from "@/lib/outreach/outreach";
import { EMAIL_INFO, EMAIL_KINDS, gmailHref, mailtoHref } from "@/lib/outreach/types";
import { AI_NOT_SET_UP, notFound } from "../errors";
import { answerInput, tool, ToolError, writerFor, type McpContext } from "../tool";
import { applicationId } from "./applications";

/*
 * Tailored CVs, cover letters and emails: written by the AI set up in RolePort, or by the agent
 * (a brief first, then its answer), checked the same way, and saved where the app shows them.
 */

async function ensureApplication(ctx: McpContext, id: string) {
  if (!(await readApplication(ctx.db, ctx.user.id, id))) throw notFound("application", id);
}

const PDF_NOTE = "Saved on the application in RolePort, where the user can edit it and download the PDF.";

export const tailorCv = tool({
  name: "tailor_cv",
  title: "Tailor the CV",
  description:
    "Tailors the user's CV to an application's job posting, from the profile's facts only, and saves it on the application. Returns the CV and its checks (keywords covered and missing, claims to verify). Written by the AI set up in RolePort, or by you: then this returns a brief to answer.",
  input: { application_id: applicationId, answer: answerInput },
  writes: true,
  external: true,
  async run({ application_id, answer }, ctx) {
    await ensureApplication(ctx, application_id);
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const { content, tailoring } = await tailorApplicationCv(ctx.db, ctx.user, application_id, config);
    return { cv: content, checks: tailoring, note: PDF_NOTE };
  },
});

export const draftCoverLetter = tool({
  name: "draft_cover_letter",
  title: "Write the cover letter",
  description:
    "Writes a cover letter for an application and saves it on the application. Returns the letter and its review (key points, warnings to check). Written by the AI set up in RolePort, or by you: then this returns a brief to answer.",
  input: { application_id: applicationId, answer: answerInput },
  writes: true,
  external: true,
  async run({ application_id, answer }, ctx) {
    await ensureApplication(ctx, application_id);
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const { content, review } = await draftApplicationLetter(ctx.db, ctx.user, application_id, config);
    return { letter: content, review, note: PDF_NOTE };
  },
});

const kinds = EMAIL_KINDS.map((k) => `${k} (${EMAIL_INFO[k].label})`).join(", ");

export const draftEmail = tool({
  name: "draft_email",
  title: "Draft an email",
  description: `Drafts one message for an application and saves it in the application's Emails and follow-ups. Kinds: ${kinds}. Written by the AI set up in RolePort, or by you: then this returns a brief to answer. RolePort never sends email: give the user the draft and its mailto link, and call mark_email_sent once they've sent it.`,
  input: { application_id: applicationId, kind: z.enum(EMAIL_KINDS), answer: answerInput },
  writes: true,
  external: true,
  async run({ application_id, kind, answer }, ctx) {
    await ensureApplication(ctx, application_id);
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const draft = await draftOutreachEmail(ctx.db, ctx.user, application_id, kind, config);
    return {
      kind,
      to: draft.to,
      toName: draft.toName,
      subject: draft.subject,
      body: draft.body,
      review: draft.review,
      mailto: mailtoHref(draft),
      gmail: gmailHref(draft),
      ...(!draft.to && { note: "No recipient yet. The user can add a contact on the application, or fill in the address in their mail app." }),
    };
  },
});

export const markEmailSent = tool({
  name: "mark_email_sent",
  title: "Mark an email as sent",
  description:
    "RolePort's Mark as sent, once the user has sent a drafted message themselves: moves it to Sent, notes it in the status history and schedules the next follow-up. The application email moves a saved job to Applied; withdraw, cancel_interview and decline_offer close the application and stop its follow-ups.",
  input: { application_id: applicationId, kind: z.enum(EMAIL_KINDS) },
  writes: true,
  async run({ application_id, kind }, ctx) {
    await ensureApplication(ctx, application_id);
    const draft = (await readOutreachDocs(ctx.db, ctx.user.id)).get(application_id)?.drafts[kind];
    if (!draft?.body.trim()) throw new ToolError(`There's no ${EMAIL_INFO[kind].label} draft on this application. Draft it with draft_email first.`);
    await markOutreachSent(ctx.db, ctx.user, application_id, kind);
    const app = await readApplication(ctx.db, ctx.user.id, application_id);
    return { sent: EMAIL_INFO[kind].label, status: app?.status, nextFollowUpAt: app?.nextFollowUpAt?.toISOString() ?? null };
  },
});
