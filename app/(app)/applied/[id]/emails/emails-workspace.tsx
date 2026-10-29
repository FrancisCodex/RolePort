"use client";

import { Check, CheckCheck, Copy, ExternalLink, Loader2, Mail, Sparkles, TriangleAlert, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { PromptDetails } from "@/components/app/prompt-details";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { draftEmail, markEmailSent, saveOutreach } from "@/lib/client/mutations";
import { wordCount } from "@/lib/letter/types";
import { dueLabel, nextFollowUp } from "@/lib/outreach/rules";
import {
  EMAIL_INFO,
  EMAIL_KINDS,
  LINKEDIN_LIMIT,
  MAILTO_LIMIT,
  mailtoHref,
  MAX_EMAIL_BODY,
  MAX_TALKING_POINTS,
  type EmailDraft,
  type EmailKind,
  type OutreachEdit,
} from "@/lib/outreach/types";
import { blankDraft, emailPromptFor, onDay, type OutreachPageData } from "@/lib/outreach/view";
import { cn } from "@/lib/utils";
import { AttachmentsCard, ContactsCard, FollowUpCard, SentLog } from "./outreach-panels";

const editOf = (data: OutreachPageData): OutreachEdit => {
  const { contacts, drafts, replyBy, offerDeadline, talkingPoints, checklist } = data.doc;
  return { contacts, drafts, replyBy, offerDeadline, talkingPoints, checklist };
};

const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Messages the user writes to the company directly: an attachments checklist goes with them. */
const WITH_ATTACHMENTS = new Set<EmailKind>(["application", "cold", "referral"]);
const ABOUT_THE_INTERVIEW = new Set<EmailKind>(["thank_you", "check_in"]);

/** When the next follow-up comes due, from the page's data. */
export function nextOf(data: OutreachPageData, doc: Pick<OutreachPageData["doc"], "sent" | "pause"> & Pick<OutreachEdit, "replyBy" | "offerDeadline">) {
  return nextFollowUp(
    {
      status: data.status,
      appliedAt: data.appliedAt ? new Date(data.appliedAt) : null,
      interviewAt: data.interviewAt ? new Date(data.interviewAt) : null,
      offerAt: data.offerAt ? new Date(data.offerAt) : null,
      doc,
    },
    data.rules,
  );
}

/**
 * One application's emails: the application email and its variants, the follow-ups and when
 * they're due, the people to write to and what was sent. RolePort never sends anything: copy
 * a draft, or open it in your own mail app, then mark it as sent.
 */
export function EmailsWorkspace({ data: initial }: { data: OutreachPageData }) {
  const params = useSearchParams();
  const [data, setData] = useState(initial);
  const [edit, setEdit] = useState<OutreachEdit>(() => editOf(initial));
  const [kind, setKind] = useState<EmailKind>(() => {
    const asked = params.get("draft");
    if (EMAIL_KINDS.includes(asked as EmailKind)) return asked as EmailKind;
    const next = nextOf(initial, initial.doc);
    return next && dueLabel(next.dueAt).due ? next.kind : "application";
  });

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(editOf(initial)));
  const dirty = JSON.stringify(edit) !== savedJson;
  const [drafting, setDrafting] = useState<EmailKind | null>(null);
  const [aiError, setAiError] = useState<{ text: string; needsSetup?: boolean } | null>(null);
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState<"body" | "subject" | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const draft: EmailDraft = edit.drafts[kind] ?? blankDraft(kind, { ...data, doc: { ...data.doc, ...edit } });
  const next = nextOf(data, { ...data.doc, replyBy: edit.replyBy, offerDeadline: edit.offerDeadline });
  const sentOfKind = data.doc.sent.filter((s) => s.kind === kind);
  const lastSent = sentOfKind.at(-1);

  async function save(value = edit): Promise<boolean> {
    const json = JSON.stringify(value);
    if (json === savedJson) return true;
    setSaveState("saving");
    const result = await saveOutreach(data.applicationId, value);
    if (!result.ok) {
      setSaveState({ error: result.error });
      return false;
    }
    setSavedJson(json);
    setSaveState("saved");
    return true;
  }

  // Save a moment after the user stops typing, so nothing is lost and there's no button to forget.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  const update = (patch: Partial<OutreachEdit>) => {
    setEdit((e) => ({ ...e, ...patch }));
    setSaveState("idle");
  };
  const updateDraft = (patch: Partial<EmailDraft>) => {
    setEdit((e) => ({ ...e, drafts: { ...e.drafts, [kind]: { ...(e.drafts[kind] ?? draft), ...patch } } }));
    setSaveState("idle");
    setCopied(null);
  };

  async function write() {
    if (draft.body.trim() && !(await confirm({ title: "Write a new draft?", body: "It replaces this message, including your edits.", confirmLabel: "Write a new draft" }))) return;
    // The model reads the saved recipient, dates and "what came up", so save those first.
    const value = { ...edit, drafts: { ...edit.drafts, [kind]: draft } };
    if (!(await save(value))) return;
    setAiError(null);
    setDrafting(kind);
    const result = await draftEmail(data.applicationId, kind);
    setDrafting(null);
    if (!result.ok) return setAiError({ text: result.error, needsSetup: result.needsSetup });
    const written = { ...value, drafts: { ...value.drafts, [kind]: result.data } };
    setSavedJson(JSON.stringify(written));
    setEdit(written);
    setSaveState("saved");
  }

  async function copy(what: "body" | "subject") {
    try {
      await navigator.clipboard.writeText(what === "body" ? draft.body : draft.subject);
      setCopied(what);
    } catch {
      setSaveState({ error: "Couldn't copy. Select the text and copy it yourself." });
    }
  }

  async function markSent(sent: boolean) {
    if (!(await save())) return;
    setMarking(true);
    const result = await markEmailSent(data.applicationId, kind, sent);
    setMarking(false);
    if (!result.ok) return setSaveState({ error: result.error });
    setData(result.data);
  }

  if (data.profileEmpty) {
    return (
      <EmptyState
        icon={UserRound}
        title="Your profile is empty"
        body="Emails are written from your profile: your experience and skills. Import your CV or fill in your profile first."
        action={
          <Link href="/profile" className={buttonVariants()}>
            Go to your profile
          </Link>
        }
      />
    );
  }

  const info = EMAIL_INFO[kind];
  const isLinkedin = kind === "linkedin";
  const chars = draft.body.trim().length;
  const words = wordCount(draft.body);
  const href = mailtoHref(draft);
  const recipient = edit.contacts.find((c) => (draft.to && c.email === draft.to) || (draft.toName && c.name === draft.toName));
  const contactOptions = [
    ...edit.contacts.map((c) => ({ value: c.id, label: [c.name || "No name", c.email || c.role].filter(Boolean).join(" · ") })),
    { value: "", label: "Someone else" },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {confirmDialog}
      <div className="flex min-w-0 flex-col gap-3">
        <KindPicker kind={kind} onPick={setKind} sent={new Set(data.doc.sent.map((s) => s.kind))} due={next && dueLabel(next.dueAt).due ? next.kind : null} />

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{info.label}</CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </div>
              <span aria-live="polite" className={cn("text-xs", typeof saveState === "object" ? "text-danger" : "text-subtle")}>
                {typeof saveState === "object" ? saveState.error : saveState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : saveState === "saved" ? "Saved" : null}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {edit.contacts.length > 0 && (
                <div className="sm:col-span-2">
                  <Field label="To">
                    <Select
                      aria-label="Who it's for"
                      value={recipient?.id ?? ""}
                      options={contactOptions}
                      onValueChange={(id) => {
                        const c = edit.contacts.find((x) => x.id === id);
                        updateDraft(c ? { to: c.email, toName: c.name } : { to: "", toName: "" });
                      }}
                    />
                  </Field>
                </div>
              )}
              <Field label="Their name (for the greeting)">
                <Input value={draft.toName} maxLength={120} placeholder="Leave empty for “Hiring Manager”" onChange={(e) => updateDraft({ toName: e.target.value })} />
              </Field>
              {!isLinkedin && (
                <Field label="Email address">
                  <Input type="email" value={draft.to} maxLength={160} placeholder="Optional" onChange={(e) => updateDraft({ to: e.target.value })} />
                </Field>
              )}
            </div>

            {ABOUT_THE_INTERVIEW.has(kind) && (
              <Field label="What came up in the interview (optional)">
                <Textarea
                  value={edit.talkingPoints}
                  maxLength={MAX_TALKING_POINTS}
                  className="min-h-20"
                  placeholder="Who you met, what you talked about, what they said about next steps. Only this is used, so the email doesn't invent a conversation."
                  onChange={(e) => update({ talkingPoints: e.target.value })}
                />
                {data.coachNotes && (
                  <details className="rounded-md border border-border bg-surface-2 text-xs">
                    <summary className="cursor-pointer px-3 py-1.5 font-medium text-muted select-none hover:text-fg">From your Interview Coach prep</summary>
                    <div className="flex flex-col gap-2 border-t border-border p-3">
                      <p className="whitespace-pre-line text-muted">{data.coachNotes}</p>
                      <p className="text-subtle">This is from practice, not the real interview. Add only what actually came up.</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="self-start"
                        onClick={() => update({ talkingPoints: [edit.talkingPoints.trim(), data.coachNotes].filter(Boolean).join("\n").slice(0, MAX_TALKING_POINTS) })}
                      >
                        Add to what came up
                      </Button>
                    </div>
                  </details>
                )}
              </Field>
            )}

            {!isLinkedin && (
              <Field label="Subject">
                <div className="flex gap-1.5">
                  <Input value={draft.subject} maxLength={300} className="min-w-0 flex-1" onChange={(e) => updateDraft({ subject: e.target.value })} />
                  <Button variant="secondary" onClick={() => void copy("subject")} disabled={!draft.subject.trim()} aria-label="Copy the subject">
                    {copied === "subject" ? <Check /> : <Copy />}
                  </Button>
                </div>
              </Field>
            )}

            <Field label="Message">
              <Textarea
                aria-label="Message"
                value={draft.body}
                maxLength={isLinkedin ? 1000 : MAX_EMAIL_BODY}
                placeholder={data.aiEnabled ? "Write it here, or let AI draft it from your profile and this application." : "Write your message here."}
                className={cn("text-[13px] leading-relaxed", isLinkedin ? "min-h-32" : "min-h-72")}
                onChange={(e) => updateDraft({ body: e.target.value })}
              />
              <p className={cn("text-xs tabular-nums", isLinkedin && chars > LINKEDIN_LIMIT ? "text-warning" : "text-subtle")}>
                {isLinkedin ? `${chars} / ${LINKEDIN_LIMIT} characters` : `${words} words · short emails get read`}
              </p>
            </Field>

            {draft.review && draft.review.warnings.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-warning/20 bg-warning-soft p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                  <TriangleAlert className="size-3.5" /> Check before you send
                </p>
                <ul className="flex flex-col gap-1 text-xs">
                  {draft.review.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <Button onClick={() => void copy("body")} disabled={!draft.body.trim()}>
                {copied === "body" ? <Check /> : <Copy />} {copied === "body" ? "Copied" : "Copy message"}
              </Button>
              {isLinkedin ? (
                recipient?.linkedin && (
                  <a href={recipient.linkedin} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
                    Open their LinkedIn <ExternalLink />
                  </a>
                )
              ) : (
                <a
                  href={href}
                  onClick={() => void save()}
                  aria-disabled={!draft.body.trim()}
                  className={cn(buttonVariants({ variant: "secondary" }), !draft.body.trim() && "pointer-events-none opacity-50")}
                >
                  <Mail /> Open in my mail app
                </a>
              )}
              {lastSent ? (
                <>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
                    <CheckCheck className="size-3.5" /> Sent {onDay(lastSent.at)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void markSent(false)} disabled={marking}>
                    <Undo2 /> Not sent
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void markSent(true)} disabled={marking}>
                    Sent again
                  </Button>
                </>
              ) : (
                <Button variant="secondary" className="ml-auto" onClick={() => void markSent(true)} disabled={marking}>
                  {marking ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark as sent
                </Button>
              )}
            </div>
            {!isLinkedin && href.length > MAILTO_LIMIT && (
              <p className="text-xs text-muted">This one is long, so some mail apps may cut it off. If that happens, copy the message instead.</p>
            )}
            <p className="text-xs text-subtle">
              RolePort never sends anything for you. {kind === "application" && data.status === "saved" ? "Marking it sent also moves this job to Applied. " : ""}
              Marking it sent adds it to the history and plans the next follow-up.
            </p>
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-3 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Write with AI</CardTitle>
            <CardDescription>Drafts this message from your profile{data.hasPosting ? ", the posting" : ""} and this application&apos;s history, using only facts you&apos;ve given.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!data.aiEnabled ? (
              <p className="text-[13px] text-muted">
                <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                  Choose an AI provider
                </Link>{" "}
                to draft it. You can still write it here, copy it and open it in your mail app.
              </p>
            ) : (
              <Button onClick={() => void write()} disabled={drafting !== null}>
                {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {drafting ? "Writing…" : draft.body.trim() ? "Write a new draft" : `Write the ${info.short.toLowerCase()} ${isLinkedin ? "note" : "email"}`}
              </Button>
            )}
            {drafting && <p className="text-xs text-muted">Local models can take a minute or two. Keep this page open.</p>}
            {aiError && (
              <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                {aiError.text}{" "}
                {aiError.needsSetup && (
                  <Link href="/settings" className="font-medium underline">
                    Open Settings
                  </Link>
                )}
              </p>
            )}
            {draft.review && (
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="text-subtle">
                  Drafted {when(draft.review.at)} with {draft.review.model}
                  {draft.review.customPrompt ? " using your own prompt" : ""}.
                </p>
                {draft.review.keyPoint && (
                  <p className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> Leans on: {draft.review.keyPoint}
                  </p>
                )}
                {draft.review.notes && <p className="text-muted">{draft.review.notes}</p>}
              </div>
            )}
            {data.aiEnabled && (
              <PromptDetails
                prompt={{ system: data.prompt.system, user: emailPromptFor({ ...data, doc: { ...data.doc, ...edit } }, kind, draft), custom: data.prompt.custom }}
                settingsAnchor="email-prompt"
              />
            )}
          </CardContent>
        </Card>

        <FollowUpCard
          data={data}
          next={next}
          replyBy={edit.replyBy}
          offerDeadline={edit.offerDeadline}
          onDates={(patch) => update(patch)}
          onOpen={setKind}
          onChanged={(page) => {
            setData(page);
          }}
          beforeChange={() => save()}
        />
        <ContactsCard contacts={edit.contacts} postingEmails={data.postingEmails} onChange={(contacts) => update({ contacts })} />
        {WITH_ATTACHMENTS.has(kind) && (
          <AttachmentsCard applicationId={data.applicationId} attachments={data.attachments} checklist={edit.checklist} onChange={(checklist) => update({ checklist })} />
        )}
        <SentLog sent={data.doc.sent} />
      </aside>
    </div>
  );
}

function KindPicker({ kind, onPick, sent, due }: { kind: EmailKind; onPick: (k: EmailKind) => void; sent: Set<EmailKind>; due: EmailKind | null }) {
  const group = (g: "apply" | "follow_up") => EMAIL_KINDS.filter((k) => EMAIL_INFO[k].group === g);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        {(["apply", "follow_up"] as const).map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-xs font-medium text-muted sm:w-20">{g === "apply" ? "Apply" : "Follow up"}</span>
            {group(g).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onPick(k)}
                aria-pressed={k === kind}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  k === kind ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {sent.has(k) && <Check className="size-3 text-success" aria-label="sent" />}
                {EMAIL_INFO[k].short}
                {due === k && <span className="size-1.5 rounded-full bg-warning" aria-label="due" />}
              </button>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
