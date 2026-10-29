"use client";

import { BellOff, BellRing, Check, FileText, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { setFollowUpsPaused } from "@/lib/client/mutations";
import { followUpLabel, type NextFollowUp } from "@/lib/outreach/rules";
import { EMAIL_INFO, MAX_CONTACTS, type Contact, type EmailKind, type OutreachEdit, type SentEntry } from "@/lib/outreach/types";
import { onDay, type OutreachPageData } from "@/lib/outreach/view";
import { cn } from "@/lib/utils";

/* The side panels of the emails page: follow-ups, contacts, attachments and what was sent. */

const STAGE_NOTE: Record<string, string> = {
  saved: "Follow-ups start once you've applied.",
  applied: "Reminders come a week and two weeks after you apply, unless they reply.",
  screening: "Set the interview date on the application, and the thank-you and check-in follow from it.",
  interview: "Set the interview date on the application, and the thank-you and check-in follow from it.",
  offer: "Set their deadline below so the reply comes up in time.",
};

export function FollowUpCard({
  data,
  next,
  replyBy,
  offerDeadline,
  onDates,
  onOpen,
  onChanged,
  beforeChange,
}: {
  data: OutreachPageData;
  next: NextFollowUp | null;
  replyBy: string | null;
  offerDeadline: string | null;
  onDates: (patch: Pick<Partial<OutreachEdit>, "replyBy" | "offerDeadline">) => void;
  onOpen: (kind: EmailKind) => void;
  onChanged: (page: OutreachPageData) => void;
  beforeChange: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = data.doc.pause !== null && data.doc.pause.status === data.status;
  const label = next && followUpLabel(next);
  const interviewing = ["applied", "screening", "interview"].includes(data.status) && data.interviewAt !== null;

  async function pause(value: boolean) {
    if (!(await beforeChange())) return;
    setPending(true);
    setError(null);
    const result = await setFollowUpsPaused(data.applicationId, value);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onChanged(result.data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <BellRing className="size-4 text-muted" /> Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-[13px]">
        {paused ? (
          <p className="text-muted">
            Paused: they replied on {onDay(data.doc.pause!.at)}. Follow-ups start again when the application moves on (an interview, an offer), or
            resume them now.
          </p>
        ) : next && label ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{EMAIL_INFO[next.kind].label}</p>
              <Badge tone={label.due ? "warning" : "neutral"}>{label.text}</Badge>
            </div>
            <p className="text-xs text-muted">
              {next.reason}
              {next.by ? `. Send it by ${onDay(next.by)}.` : "."}
            </p>
            <Button size="sm" variant={label.due ? "primary" : "secondary"} className="self-start" onClick={() => onOpen(next.kind)}>
              Open the draft
            </Button>
          </div>
        ) : (
          <p className="text-muted">{STAGE_NOTE[data.status] ?? "Nothing planned for this application."}</p>
        )}

        {interviewing && (
          <DateField
            label="They said they'd get back to you by"
            value={replyBy}
            onChange={(v) => onDates({ replyBy: v })}
            hint="The check-in comes a few working days after this date."
          />
        )}
        {data.status === "offer" && <DateField label="Their deadline for your answer" value={offerDeadline} onChange={(v) => onDates({ offerDeadline: v })} />}

        <div className="flex flex-wrap items-center gap-1.5">
          {paused ? (
            <Button size="sm" variant="secondary" onClick={() => void pause(false)} disabled={pending}>
              <BellRing /> Resume follow-ups
            </Button>
          ) : (
            ["applied", "screening", "interview", "offer"].includes(data.status) && (
              <Button size="sm" variant="secondary" onClick={() => void pause(true)} disabled={pending}>
                <BellOff /> Got a reply
              </Button>
            )
          )}
          <Link href="/settings#follow-ups" className="ml-auto text-xs font-medium text-muted hover:text-fg">
            Change when
          </Link>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

function DateField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted">{label}</Label>
      <div className="flex gap-1.5">
        <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="min-w-0 flex-1 text-[13px]" />
        {value && (
          <Button variant="ghost" onClick={() => onChange(null)} aria-label="Clear the date">
            <X />
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

const blank = (): Contact => ({ id: crypto.randomUUID(), name: "", role: "", email: "", linkedin: "", notes: "" });

/** The people for this application: recruiter, hiring manager, someone who can refer you. Added by hand; nothing is looked up. */
export function ContactsCard({ contacts, postingEmails, onChange }: { contacts: Contact[]; postingEmails: string[]; onChange: (contacts: Contact[]) => void }) {
  const [editing, setEditing] = useState<Contact | null>(null);
  const known = new Set(contacts.map((c) => c.email.toLowerCase()));
  const suggestions = postingEmails.filter((e) => !known.has(e.toLowerCase()));

  function commit(contact: Contact) {
    const exists = contacts.some((c) => c.id === contact.id);
    onChange(exists ? contacts.map((c) => (c.id === contact.id ? contact : c)) : [...contacts, contact]);
    setEditing(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>Who you&apos;re writing to. Pick one in “To” to fill in the name and address.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-[13px]">
        {contacts.map((c) =>
          editing?.id === c.id ? (
            <ContactForm key={c.id} contact={editing} onChange={setEditing} onSave={commit} onCancel={() => setEditing(null)} />
          ) : (
            <div key={c.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name || c.email || "No name"}</p>
                <p className="truncate text-xs text-muted">{[c.role, c.email].filter(Boolean).join(" · ") || "No details yet"}</p>
                {c.notes && <p className="mt-1 text-xs whitespace-pre-line text-subtle">{c.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label={`Edit ${c.name || "contact"}`}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onChange(contacts.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name || "contact"}`} className="hover:text-danger">
                <Trash2 />
              </Button>
            </div>
          ),
        )}
        {editing && !contacts.some((c) => c.id === editing.id) && (
          <ContactForm contact={editing} onChange={setEditing} onSave={commit} onCancel={() => setEditing(null)} />
        )}
        {suggestions.map((email) => (
          <button
            key={email}
            type="button"
            onClick={() => setEditing({ ...blank(), email })}
            className="flex items-center gap-1.5 text-left text-xs font-medium text-brand-ink hover:underline"
          >
            <Mail className="size-3.5" /> Add {email} (from the posting)
          </button>
        ))}
        {!editing && contacts.length < MAX_CONTACTS && (
          <Button size="sm" variant="secondary" className="self-start" onClick={() => setEditing(blank())}>
            <Plus /> Add a contact
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ContactForm({ contact, onChange, onSave, onCancel }: { contact: Contact; onChange: (c: Contact) => void; onSave: (c: Contact) => void; onCancel: () => void }) {
  const set = (patch: Partial<Contact>) => onChange({ ...contact, ...patch });
  const badEmail = contact.email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
  const empty = !contact.name.trim() && !contact.email.trim();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-brand/40 p-3">
      <Input value={contact.name} maxLength={120} placeholder="Name" aria-label="Name" onChange={(e) => set({ name: e.target.value })} />
      <Input value={contact.role} maxLength={120} placeholder="Role, e.g. Recruiter" aria-label="Role" onChange={(e) => set({ role: e.target.value })} />
      <Input type="email" value={contact.email} maxLength={160} placeholder="Email" aria-label="Email" onChange={(e) => set({ email: e.target.value })} />
      {badEmail && <p className="text-xs text-danger">That email address doesn&apos;t look right.</p>}
      <Input value={contact.linkedin} maxLength={300} placeholder="LinkedIn link (optional)" aria-label="LinkedIn link" onChange={(e) => set({ linkedin: e.target.value })} />
      <Textarea value={contact.notes} maxLength={1000} placeholder="Notes (optional)" aria-label="Notes" className="min-h-14" onChange={(e) => set({ notes: e.target.value })} />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={() => onSave({ ...contact, email: contact.email.trim() })} disabled={badEmail || empty}>
          <Check /> Save contact
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** What to attach: the CV and letter RolePort made, and anything the posting asks for. Ticked by the user. */
export function AttachmentsCard({
  applicationId,
  attachments,
  checklist,
  onChange,
}: {
  applicationId: string;
  attachments: OutreachPageData["attachments"];
  checklist: Record<string, boolean>;
  onChange: (checklist: Record<string, boolean>) => void;
}) {
  const rows: { key: string; label: string; status?: ReactNode }[] = [
    {
      key: "cv",
      label: "Your CV (PDF)",
      status: (
        <Link href={`/applied/${applicationId}/cv`} className="text-xs font-medium text-brand-ink hover:underline">
          {attachments.cv === "tailored" ? "Tailored · download" : attachments.cv === "edited" ? "Edited · download" : "Not tailored yet"}
        </Link>
      ),
    },
    {
      key: "letter",
      label: "Cover letter (PDF)",
      status: (
        <Link href={`/applied/${applicationId}/cover-letter`} className="text-xs font-medium text-brand-ink hover:underline">
          {attachments.letter ? "Written · download" : "Not written yet"}
        </Link>
      ),
    },
    ...attachments.asks.map((a) => ({ key: a, label: a, status: <span className="text-xs text-subtle">The posting asks for it</span> })),
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <FileText className="size-4 text-muted" /> Attachments
        </CardTitle>
        <CardDescription>Tick each one once it&apos;s attached in your mail app.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.map((r) => (
          <label key={r.key} className="flex items-center gap-2.5 text-[13px]">
            <Checkbox checked={Boolean(checklist[r.key])} onCheckedChange={(v) => onChange({ ...checklist, [r.key]: v })} />
            <span className={cn("min-w-0 flex-1", checklist[r.key] && "text-muted line-through")}>{r.label}</span>
            {r.status}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

export function SentLog({ sent }: { sent: SentEntry[] }) {
  if (!sent.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-1.5 text-[13px]">
          {[...sent].reverse().map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                {EMAIL_INFO[s.kind].label}
                {s.to && <span className="text-xs text-muted"> · {s.to}</span>}
              </span>
              <span className="shrink-0 text-xs text-subtle tabular-nums">{new Date(s.at).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
