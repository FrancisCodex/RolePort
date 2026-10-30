"use client";

import { BellRing, Check, Copy, CornerUpRight, Mail, PenLine, Repeat2, Send, Undo2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EMAIL_INFO, EMAIL_KINDS, EMAIL_REASONS, type EmailDraft, type EmailKind, type EmailReason, type SentEntry } from "@/lib/outreach/types";
import { onDay } from "@/lib/outreach/view";
import { cn } from "@/lib/utils";

/* The mailbox: the list of what's due, drafts and sent messages, one sent message open, and the "what do you want to send?" menu. */

export type Selection = { type: "compose"; kind: EmailKind } | { type: "sent"; id: string };

const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
const preview = (body: string) => body.replace(/\s+/g, " ").trim();

function Avatar({ name, tone = "neutral" }: { name: string; tone?: "neutral" | "warning" | "brand" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase",
        tone === "warning" ? "bg-warning-soft text-warning" : tone === "brand" ? "bg-brand-soft text-brand-ink" : "bg-surface-3 text-muted",
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

function Row({ selected, onClick, avatar, title, right, subject, snippet }: { selected: boolean; onClick: () => void; avatar: ReactNode; title: string; right: ReactNode; subject: string; snippet: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={selected || undefined}
        className={cn(
          "relative flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2",
          selected && "bg-surface-2 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand",
        )}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium">{title}</span>
            <span className="shrink-0 text-[11px] text-subtle tabular-nums">{right}</span>
          </span>
          <span className="block truncate text-xs">{subject}</span>
          {snippet && <span className="block truncate text-xs text-subtle">{snippet}</span>}
        </span>
      </button>
    </li>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 border-t border-border px-3 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
        {title}
        {count ? <span className="text-subtle tabular-nums">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

export function MailboxList({
  company,
  due,
  drafts,
  sent,
  selection,
  onSelect,
  onCompose,
}: {
  company: string;
  /** The next follow-up, when it's due now. */
  due: { kind: EmailKind; when: string; reason: string } | null;
  drafts: [EmailKind, EmailDraft][];
  /** Newest first. */
  sent: SentEntry[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onCompose: () => void;
}) {
  const isDraft = (k: EmailKind) => selection.type === "compose" && selection.kind === k;
  const dueHasDraft = due && drafts.some(([k]) => k === due.kind);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="p-3">
        <Button className="w-full" onClick={onCompose}>
          <PenLine /> Compose
        </Button>
      </div>

      {due && !dueHasDraft && (
        <Section title="Due">
          <ul>
            <Row
              selected={isDraft(due.kind)}
              onClick={() => onSelect({ type: "compose", kind: due.kind })}
              avatar={<Avatar name="!" tone="warning" />}
              title={EMAIL_INFO[due.kind].label}
              right={<BellRing className="size-3 text-warning" aria-label="Due" />}
              subject={due.when}
              snippet={due.reason}
            />
          </ul>
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title="Drafts" count={drafts.length}>
          <ul>
            {drafts.map(([k, d]) => (
              <Row
                key={k}
                selected={isDraft(k)}
                onClick={() => onSelect({ type: "compose", kind: k })}
                avatar={<Avatar name={d.toName || company} tone="brand" />}
                title={d.toName || d.to || company}
                right={due?.kind === k ? <BellRing className="size-3 text-warning" aria-label="Due" /> : "Draft"}
                subject={EMAIL_INFO[k].label}
                snippet={preview(d.body)}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sent" count={sent.length}>
        {sent.length ? (
          <ul>
            {sent.map((s) => (
              <Row
                key={s.id}
                selected={selection.type === "sent" && selection.id === s.id}
                onClick={() => onSelect({ type: "sent", id: s.id })}
                avatar={<Avatar name={s.toName || s.to || company} />}
                title={s.toName || s.to || company}
                right={shortDay(s.at)}
                subject={s.subject || EMAIL_INFO[s.kind].label}
                snippet={preview(s.body)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-3 pb-3 text-xs text-muted">Nothing yet. Messages you mark as sent are kept here, so you can always see what you told them.</p>
        )}
      </Section>
    </div>
  );
}

/** One sent message, as you'd see it in a mail app. */
export function SentMessage({
  entry,
  from,
  company,
  busy,
  onReuse,
  onCompose,
  onUnsend,
}: {
  entry: SentEntry;
  from: { name: string; email: string };
  company: string;
  busy: boolean;
  onReuse: () => void;
  onCompose: () => void;
  onUnsend: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const info = EMAIL_INFO[entry.kind];
  const reason = EMAIL_REASONS[entry.reason as EmailReason]?.label;

  async function copy() {
    try {
      await navigator.clipboard.writeText(entry.body);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <article className="flex min-h-96 flex-col rounded-xl border border-border bg-surface">
      <header className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{info.label}</Badge>
          {reason && <Badge>{reason}</Badge>}
        </div>
        <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-balance">{entry.subject || info.label}</h2>
        <div className="flex items-center gap-2.5">
          <Avatar name={from.name} tone="brand" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate">
              <span className="text-[13px] font-medium">{from.name || "You"}</span>
              {from.email && <span className="text-subtle"> &lt;{from.email}&gt;</span>}
            </p>
            <p className="truncate text-muted">
              To {entry.toName || entry.to || company}
              {entry.toName && entry.to && <span className="text-subtle"> &lt;{entry.to}&gt;</span>}
            </p>
          </div>
          <time dateTime={entry.at} className="shrink-0 text-xs text-subtle">
            {onDay(entry.at)}
          </time>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-5">
        {entry.body ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-line">{entry.body}</p>
        ) : (
          <p className="text-[13px] text-muted">This was marked as sent before RolePort kept a copy of each message.</p>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-border p-3">
        <Button onClick={onCompose}>
          <CornerUpRight /> Write another
        </Button>
        {entry.body && (
          <>
            <Button variant="secondary" onClick={onReuse}>
              <Repeat2 /> Send again
            </Button>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onUnsend} disabled={busy} title="It goes back to your drafts">
          <Undo2 /> I didn&apos;t send this
        </Button>
        {failed && <p className="w-full text-xs text-danger">Couldn&apos;t copy. Select the text and copy it yourself.</p>}
      </footer>
    </article>
  );
}

const MENU = [
  { group: "apply", title: "Apply", icon: Send },
  { group: "follow_up", title: "Follow up", icon: Mail },
  { group: "close", title: "Step away", icon: X },
] as const;

/** "What do you want to send?": every kind of message, with what it's for. */
export function ComposeMenu({
  open,
  onClose,
  onPick,
  sent,
  due,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: EmailKind) => void;
  sent: SentEntry[];
  due: EmailKind | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="compose-title" className="w-[min(44rem,calc(100vw-2rem))]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="compose-title" className="text-[15px] font-semibold tracking-tight">
            What do you want to send?
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        {MENU.map(({ group, title, icon: Icon }) => (
          <section key={group} className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Icon className="size-3.5" /> {title}
            </h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {EMAIL_KINDS.filter((k) => EMAIL_INFO[k].group === group).map((k) => {
                const times = sent.filter((s) => s.kind === k).length;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onPick(k)}
                    className="flex flex-col gap-0.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-brand/50 hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      {EMAIL_INFO[k].label}
                      {due === k && <Badge tone="warning">Due</Badge>}
                      {times > 0 && <span className="ml-auto text-[11px] font-normal text-subtle">Sent {times === 1 ? "once" : `${times} times`}</span>}
                    </span>
                    <span className="text-xs text-muted">{EMAIL_INFO[k].description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
