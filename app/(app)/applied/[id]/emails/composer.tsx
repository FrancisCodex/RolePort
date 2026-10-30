"use client";

import { Check, CheckCheck, Copy, ExternalLink, Loader2, Mail, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PromptDetails } from "@/components/app/prompt-details";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { wordCount } from "@/lib/letter/types";
import {
  CLOSING_STATUS,
  EMAIL_INFO,
  EMAIL_REASONS,
  gmailHref,
  KIND_REASONS,
  LINKEDIN_LIMIT,
  MAILTO_LIMIT,
  mailtoHref,
  MAX_EMAIL_BODY,
  MAX_REASON_DETAIL,
  MAX_TALKING_POINTS,
  outlookHref,
  type EmailDraft,
  type EmailKind,
  type EmailReason,
  type OutreachEdit,
} from "@/lib/outreach/types";
import { emailPromptFor, reasonOf, type OutreachPageData } from "@/lib/outreach/view";
import { cn } from "@/lib/utils";

const ABOUT_THE_INTERVIEW = new Set<EmailKind>(["thank_you", "check_in"]);
const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const flat = "h-7 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";

/** A line of the message's header, like To and Subject in a mail app. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-1.5 focus-within:bg-surface-2/50 sm:px-5">
      <span className="w-14 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/** One message being written: who it's for, why, the text, AI, and the ways to send it yourself. */
export function Composer({
  data,
  kind,
  draft,
  edit,
  saveNote,
  saveFailed,
  onChange,
  onEdit,
  onReason,
  onChangeKind,
  onDiscard,
  onSave,
  onMarkSent,
  marking,
  ai,
}: {
  data: OutreachPageData;
  kind: EmailKind;
  draft: EmailDraft;
  edit: OutreachEdit;
  saveNote: string | null;
  saveFailed: boolean;
  onChange: (patch: Partial<EmailDraft>) => void;
  onEdit: (patch: Partial<OutreachEdit>) => void;
  onReason: (reason: EmailReason) => void;
  onChangeKind: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onMarkSent: () => void;
  marking: boolean;
  ai: { drafting: boolean; error: { text: string; needsSetup?: boolean } | null; onWrite: () => void };
}) {
  const [copied, setCopied] = useState<"body" | "subject" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const info = EMAIL_INFO[kind];
  const isLinkedin = kind === "linkedin";
  const reasons = KIND_REASONS[kind];
  const reason = reasonOf(kind, draft);
  const hasBody = draft.body.trim().length > 0;
  const chars = draft.body.trim().length;
  const href = mailtoHref(draft);
  const closing = CLOSING_STATUS[kind];
  const recipient = edit.contacts.find((c) => (draft.to && c.email === draft.to) || (draft.toName && c.name === draft.toName));

  async function copy(what: "body" | "subject") {
    try {
      await navigator.clipboard.writeText(what === "body" ? draft.body : draft.subject);
      setCopied(what);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-5">
        <h2 className="text-[13px] font-semibold">{info.label}</h2>
        <button type="button" onClick={onChangeKind} className="text-xs font-medium text-brand-ink hover:underline">
          Change
        </button>
        <span aria-live="polite" className={cn("ml-auto text-xs", saveFailed ? "text-danger" : "text-subtle")}>
          {saveNote}
        </span>
        {hasBody && (
          <Button variant="ghost" size="icon" onClick={onDiscard} aria-label="Discard this draft" className="hover:text-danger">
            <Trash2 />
          </Button>
        )}
      </header>

      {edit.contacts.length > 0 && (
        <Line label="Contact">
          <Select
            size="sm"
            aria-label="Pick a contact"
            className="w-full"
            value={recipient?.id ?? ""}
            options={[
              ...edit.contacts.map((c) => ({ value: c.id, label: [c.name || "No name", c.email || c.role].filter(Boolean).join(" · ") })),
              { value: "", label: "Someone else" },
            ]}
            onValueChange={(id) => {
              const c = edit.contacts.find((x) => x.id === id);
              onChange(c ? { to: c.email, toName: c.name } : { to: "", toName: "" });
            }}
          />
        </Line>
      )}
      <Line label="Name">
        <Input className={flat} aria-label="Their name" value={draft.toName} maxLength={120} placeholder="Leave empty for “Hiring Manager”" onChange={(e) => onChange({ toName: e.target.value })} />
      </Line>
      {!isLinkedin && (
        <>
          <Line label="To">
            <Input className={flat} aria-label="Email address" type="email" value={draft.to} maxLength={160} placeholder="name@company.com" onChange={(e) => onChange({ to: e.target.value })} />
          </Line>
          <Line label="Subject">
            <Input className={cn(flat, "font-medium")} aria-label="Subject" value={draft.subject} maxLength={300} onChange={(e) => onChange({ subject: e.target.value })} />
            <button type="button" onClick={() => void copy("subject")} disabled={!draft.subject.trim()} aria-label="Copy the subject" className="text-muted hover:text-fg [&_svg]:size-3.5">
              {copied === "subject" ? <Check /> : <Copy />}
            </button>
          </Line>
        </>
      )}

      {reasons && reason && (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-2/50 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-medium text-muted">{info.group === "close" && kind !== "reply_rejection" ? "Your reason" : "Why are you writing?"}</span>
            <div className="min-w-56 flex-1">
              <Select aria-label="Why you're writing" size="sm" value={reason} options={reasons.map((r) => ({ value: r, label: EMAIL_REASONS[r].label }))} onValueChange={(v) => onReason(v as EmailReason)} />
            </div>
          </div>
          {reason !== "private" && (
            <Textarea
              aria-label="Details for the reason"
              value={draft.reasonDetail}
              maxLength={MAX_REASON_DETAIL}
              className="min-h-9 text-xs"
              placeholder={reason === "other" || reason === "new_info" ? "What do you want to say?" : "Anything to add? Only what you write here is used, so nothing gets made up."}
              onChange={(e) => onChange({ reasonDetail: e.target.value })}
            />
          )}
        </div>
      )}

      {ABOUT_THE_INTERVIEW.has(kind) && (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-2/50 px-4 py-3 sm:px-5">
          <span className="text-xs font-medium text-muted">What came up in the interview (optional)</span>
          <Textarea
            aria-label="What came up in the interview"
            value={edit.talkingPoints}
            maxLength={MAX_TALKING_POINTS}
            className="min-h-16 text-xs"
            placeholder="Who you met, what you talked about, what they said about next steps. Only this is used, so the email doesn't invent a conversation."
            onChange={(e) => onEdit({ talkingPoints: e.target.value })}
          />
          {data.coachNotes && (
            <details className="rounded-md border border-border bg-surface text-xs">
              <summary className="cursor-pointer px-3 py-1.5 font-medium text-muted select-none hover:text-fg">From your Interview Coach prep</summary>
              <div className="flex flex-col gap-2 border-t border-border p-3">
                <p className="whitespace-pre-line text-muted">{data.coachNotes}</p>
                <p className="text-subtle">This is from practice, not the real interview. Add only what actually came up.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() => onEdit({ talkingPoints: [edit.talkingPoints.trim(), data.coachNotes].filter(Boolean).join("\n").slice(0, MAX_TALKING_POINTS) })}
                >
                  Add to what came up
                </Button>
              </div>
            </details>
          )}
        </div>
      )}

      <Textarea
        aria-label="Message"
        value={draft.body}
        maxLength={isLinkedin ? 1000 : MAX_EMAIL_BODY}
        placeholder={data.aiEnabled ? "Write your message, or let AI draft it from your profile and this application." : "Write your message."}
        className={cn("rounded-none border-0 bg-transparent px-4 py-3 text-[13px] leading-relaxed shadow-none focus-visible:ring-0 sm:px-5", isLinkedin ? "min-h-36" : "min-h-80")}
        onChange={(e) => onChange({ body: e.target.value })}
      />
      <p className={cn("px-4 pb-2 text-right text-xs tabular-nums sm:px-5", isLinkedin && chars > LINKEDIN_LIMIT ? "text-warning" : "text-subtle")}>
        {isLinkedin ? `${chars} / ${LINKEDIN_LIMIT} characters` : `${wordCount(draft.body)} words`}
      </p>

      {draft.review && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs sm:px-5">
          <p className="text-subtle">
            Drafted {when(draft.review.at)} with {draft.review.model}
            {draft.review.customPrompt ? " using your own prompt" : ""}.
            {draft.review.keyPoint && ` Leans on: ${draft.review.keyPoint}.`}
          </p>
          {draft.review.notes && <p className="text-muted">{draft.review.notes}</p>}
          {draft.review.warnings.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/20 bg-warning-soft p-3">
              <p className="flex items-center gap-1.5 font-medium text-warning">
                <TriangleAlert className="size-3.5" /> Check before you send
              </p>
              <ul className="flex flex-col gap-1">
                {draft.review.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {ai.error && (
        <p className="mx-4 mb-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger sm:mx-5">
          {ai.error.text}{" "}
          {ai.error.needsSetup && (
            <Link href="/settings" className="font-medium underline">
              Open Settings
            </Link>
          )}
        </p>
      )}

      <footer className="sticky bottom-0 flex flex-wrap items-center gap-1.5 rounded-b-xl border-t border-border bg-surface p-3">
        {data.aiEnabled ? (
          <Button variant={hasBody ? "secondary" : "primary"} onClick={ai.onWrite} disabled={ai.drafting}>
            {ai.drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {ai.drafting ? "Writing…" : hasBody ? "New draft" : "Write with AI"}
          </Button>
        ) : (
          <Link href="/settings" className={buttonVariants({ variant: "secondary" })}>
            <Sparkles /> Set up AI
          </Link>
        )}
        <Button variant="secondary" onClick={() => void copy("body")} disabled={!hasBody}>
          {copied === "body" ? <Check /> : <Copy />} {copied === "body" ? "Copied" : "Copy"}
        </Button>
        {isLinkedin ? (
          recipient?.linkedin && (
            <a href={recipient.linkedin} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
              LinkedIn <ExternalLink />
            </a>
          )
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Open in</span>
            {[
              { label: "Gmail", url: gmailHref(draft) },
              { label: "Outlook", url: outlookHref(draft) },
            ].map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener"
                onClick={onSave}
                aria-disabled={!hasBody}
                className={cn(buttonVariants({ variant: "secondary" }), !hasBody && "pointer-events-none opacity-50")}
              >
                {label} <ExternalLink />
              </a>
            ))}
            <a
              href={href}
              onClick={onSave}
              aria-disabled={!hasBody}
              title="Opens the mail app set up on this computer"
              className={cn(buttonVariants({ variant: "secondary" }), !hasBody && "pointer-events-none opacity-50")}
            >
              <Mail /> Mail app
            </a>
          </span>
        )}
        <Button className="ml-auto" onClick={onMarkSent} disabled={marking || !hasBody}>
          {marking ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark as sent
        </Button>
      </footer>

      <div className="flex flex-col gap-2 rounded-b-xl px-4 py-3 sm:px-5">
        {ai.drafting && <p className="text-xs text-muted">Local models can take a minute or two. Keep this page open.</p>}
        {copyFailed && <p className="text-xs text-danger">Couldn&apos;t copy. Select the text and copy it yourself.</p>}
        {!isLinkedin && href.length > MAILTO_LIMIT && <p className="text-xs text-muted">This one is long, so it may get cut off when it opens. If that happens, copy it instead.</p>}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
          <Badge>RolePort never sends for you</Badge>
          {closing
            ? `Send it yourself, then mark it as sent: that moves this application to ${closing === "withdrawn" ? "Withdrawn" : "Offer declined"} and stops its follow-ups.`
            : kind === "application" && data.status === "saved"
              ? "Send it yourself, then mark it as sent: it moves to Sent, and this job moves to Applied."
              : "Send it yourself, then mark it as sent: it moves to Sent and the next follow-up is planned."}
        </p>
        {data.aiEnabled && (
          <PromptDetails prompt={{ system: data.prompt.system, user: emailPromptFor({ ...data, doc: { ...data.doc, ...edit } }, kind, draft), custom: data.prompt.custom }} settingsAnchor="email-prompt" />
        )}
      </div>
    </article>
  );
}
