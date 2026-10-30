"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { draftEmail, markEmailSent, saveOutreach, unmarkEmailSent } from "@/lib/client/mutations";
import { dueLabel, followUpLabel, nextFollowUp } from "@/lib/outreach/rules";
import { CLOSING_STATUS, defaultSubject, EMAIL_KINDS, type EmailDraft, type EmailKind, type EmailReason, type OutreachEdit, type SentEntry } from "@/lib/outreach/types";
import { blankDraft, reasonOf, type OutreachPageData } from "@/lib/outreach/view";
import { Composer } from "./composer";
import { ComposeMenu, MailboxList, SentMessage, type Selection } from "./mailbox";
import { AttachmentsCard, ContactsCard, FollowUpCard } from "./outreach-panels";

const editOf = (data: OutreachPageData): OutreachEdit => {
  const { contacts, drafts, replyBy, offerDeadline, talkingPoints, checklist } = data.doc;
  return { contacts, drafts, replyBy, offerDeadline, talkingPoints, checklist };
};

/** Messages the user writes to the company directly: an attachments checklist goes with them. */
const WITH_ATTACHMENTS = new Set<EmailKind>(["application", "cold", "referral"]);

/** When the next follow-up comes due, from the page's data. */
function nextOf(data: OutreachPageData, doc: Pick<OutreachPageData["doc"], "sent" | "pause"> & Pick<OutreachEdit, "replyBy" | "offerDeadline">) {
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

/** Where the page opens: the message asked for, else what's due, else the latest sent, else a new message. */
function firstSelection(data: OutreachPageData, asked: string | null): Selection {
  if (EMAIL_KINDS.includes(asked as EmailKind)) return { type: "compose", kind: asked as EmailKind };
  const next = nextOf(data, data.doc);
  if (next && dueLabel(next.dueAt).due) return { type: "compose", kind: next.kind };
  const latest = data.doc.sent.at(-1);
  if (latest) return { type: "sent", id: latest.id };
  return { type: "compose", kind: data.status === "rejected" ? "reply_rejection" : "application" };
}

/**
 * One application's messages as a mailbox: what's due, drafts and everything sent on one side,
 * the open message or a new one on the other. A kind can be sent as often as needed: marking a
 * draft as sent moves it to Sent and clears the way for the next. RolePort never sends anything:
 * copy a draft, or open it in your own mail app, then mark it as sent.
 */
export function EmailsWorkspace({ data: initial }: { data: OutreachPageData }) {
  const params = useSearchParams();
  const [data, setData] = useState(initial);
  const [edit, setEdit] = useState<OutreachEdit>(() => editOf(initial));
  const [selection, setSelection] = useState<Selection>(() => firstSelection(initial, params.get("draft")));
  const [menuOpen, setMenuOpen] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(editOf(initial)));
  const dirty = JSON.stringify(edit) !== savedJson;
  const [drafting, setDrafting] = useState<EmailKind | null>(null);
  const [aiError, setAiError] = useState<{ text: string; needsSetup?: boolean } | null>(null);
  const [marking, setMarking] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const pane = useRef<HTMLDivElement>(null);

  const doc = { ...data.doc, ...edit };
  const next = nextOf(data, { ...data.doc, replyBy: edit.replyBy, offerDeadline: edit.offerDeadline });
  const dueNow = next && dueLabel(next.dueAt).due ? next : null;
  const kind = selection.type === "compose" ? selection.kind : null;
  const draft: EmailDraft | null = kind && (edit.drafts[kind] ?? blankDraft(kind, { ...data, doc }));
  const opened = selection.type === "sent" ? data.doc.sent.find((s) => s.id === selection.id) : undefined;
  const drafts = EMAIL_KINDS.flatMap((k): [EmailKind, EmailDraft][] => {
    const d = edit.drafts[k];
    return d?.body.trim() ? [[k, d]] : [];
  });

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

  /** Open a message, and bring it into view when the list and the message are stacked. */
  function open(next: Selection) {
    setSelection(next);
    setAiError(null);
    setMenuOpen(false);
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => pane.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const update = (patch: Partial<OutreachEdit>) => {
    setEdit((e) => ({ ...e, ...patch }));
    setSaveState("idle");
  };

  function updateDraft(patch: Partial<EmailDraft>) {
    if (!kind || !draft) return;
    setEdit((e) => ({ ...e, drafts: { ...e.drafts, [kind]: { ...(e.drafts[kind] ?? draft), ...patch } } }));
    setSaveState("idle");
  }

  /** Pick a reason. A subject the user hasn't changed follows it. */
  function pickReason(reason: EmailReason) {
    if (!kind || !draft) return;
    const who = { role: data.role, company: data.company, name: data.candidate.name };
    const untouched = draft.subject === defaultSubject(kind, who, reasonOf(kind, draft) ?? undefined);
    updateDraft({ reason, ...(untouched && { subject: defaultSubject(kind, who, reason) }) });
  }

  /** The page's data after a send or undo: the server's copy of everything, unsaved edits already saved. */
  function adopt(page: OutreachPageData) {
    const value = editOf(page);
    setData(page);
    setEdit(value);
    setSavedJson(JSON.stringify(value));
  }

  async function write() {
    if (!kind || !draft) return;
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

  async function markSent() {
    if (!kind || !draft) return;
    const closing = CLOSING_STATUS[kind];
    if (closing && data.status !== closing) {
      const ok = await confirm({
        title: closing === "withdrawn" ? "Mark this application as withdrawn?" : "Mark this offer as declined?",
        body: `Send the message from your mail app first. This moves the application to ${closing === "withdrawn" ? "Withdrawn" : "Offer declined"} and stops its follow-ups${kind === "cancel_interview" ? ", and clears the interview date" : ""}. “I didn't send this” puts it back.`,
        confirmLabel: "Mark as sent",
      });
      if (!ok) return;
    }
    // A blank draft that was never typed in still has its recipient and subject to keep.
    if (!(await save({ ...edit, drafts: { ...edit.drafts, [kind]: draft } }))) return;
    setMarking(true);
    const result = await markEmailSent(data.applicationId, kind);
    setMarking(false);
    if (!result.ok) return setSaveState({ error: result.error });
    adopt(result.data);
    setSaveState("idle");
    const latest = result.data.doc.sent.at(-1);
    if (latest) open({ type: "sent", id: latest.id });
  }

  async function unsend(entry: SentEntry) {
    setMarking(true);
    const result = await unmarkEmailSent(data.applicationId, entry.id);
    setMarking(false);
    if (!result.ok) return setSaveState({ error: result.error });
    adopt(result.data);
    setSaveState("idle");
    open({ type: "compose", kind: entry.kind });
  }

  /** "Send again": a new draft with the same words, to change and send. */
  async function reuse(entry: SentEntry) {
    const existing = edit.drafts[entry.kind];
    if (existing?.body.trim() && !(await confirm({ title: "Replace your draft?", body: "You already have a draft of this kind. This replaces it with the sent message.", confirmLabel: "Replace it" }))) return;
    const copy: EmailDraft = { to: entry.to, toName: entry.toName, subject: entry.subject, body: entry.body, reason: entry.reason, reasonDetail: "", review: null };
    update({ drafts: { ...edit.drafts, [entry.kind]: copy } });
    open({ type: "compose", kind: entry.kind });
  }

  async function discard() {
    if (!kind) return;
    if (!(await confirm({ title: "Discard this draft?", body: "Its text is deleted. Anything already marked as sent stays.", confirmLabel: "Discard", tone: "danger" }))) return;
    update({ drafts: Object.fromEntries(Object.entries(edit.drafts).filter(([k]) => k !== kind)) });
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

  const saveNote = typeof saveState === "object" ? saveState.error : saveState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : saveState === "saved" ? "Saved" : null;

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_19rem]">
      {confirmDialog}
      <ComposeMenu open={menuOpen} onClose={() => setMenuOpen(false)} onPick={(k) => open({ type: "compose", kind: k })} sent={data.doc.sent} due={next?.kind ?? null} />

      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:row-span-2 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <MailboxList
          company={data.company}
          due={dueNow && { kind: dueNow.kind, when: followUpLabel(dueNow).text, reason: dueNow.reason }}
          drafts={drafts}
          sent={[...data.doc.sent].reverse()}
          selection={selection}
          onSelect={open}
          onCompose={() => setMenuOpen(true)}
        />
      </div>

      <div ref={pane} className="min-w-0 scroll-mt-4">
        {kind && draft ? (
          <Composer
            data={data}
            kind={kind}
            draft={draft}
            edit={edit}
            saveNote={saveNote}
            saveFailed={typeof saveState === "object"}
            onChange={updateDraft}
            onEdit={update}
            onReason={pickReason}
            onChangeKind={() => setMenuOpen(true)}
            onDiscard={() => void discard()}
            onSave={() => void save()}
            onMarkSent={() => void markSent()}
            marking={marking}
            ai={{ drafting: drafting === kind, error: aiError, onWrite: () => void write() }}
          />
        ) : opened ? (
          <SentMessage
            key={opened.id}
            entry={opened}
            from={data.candidate}
            company={data.company}
            busy={marking}
            onReuse={() => void reuse(opened)}
            onCompose={() => setMenuOpen(true)}
            onUnsend={() => void unsend(opened)}
          />
        ) : null}
      </div>

      <aside className="flex min-w-0 flex-col gap-3 lg:col-start-2 xl:col-start-3 xl:row-start-1">
        <FollowUpCard
          data={data}
          next={next}
          replyBy={edit.replyBy}
          offerDeadline={edit.offerDeadline}
          onDates={update}
          onOpen={(k) => open({ type: "compose", kind: k })}
          onChanged={setData}
          beforeChange={() => save()}
        />
        <ContactsCard contacts={edit.contacts} postingEmails={data.postingEmails} onChange={(contacts) => update({ contacts })} />
        {kind && WITH_ATTACHMENTS.has(kind) && (
          <AttachmentsCard applicationId={data.applicationId} attachments={data.attachments} checklist={edit.checklist} onChange={(checklist) => update({ checklist })} />
        )}
      </aside>
    </div>
  );
}
