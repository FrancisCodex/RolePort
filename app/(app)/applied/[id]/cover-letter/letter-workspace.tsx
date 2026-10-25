"use client";

import { Check, Copy, Download, Loader2, RotateCcw, Save, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { PromptDetails } from "@/components/app/prompt-details";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { discardLetter, draftLetter, saveLetter } from "@/lib/client/mutations";
import type { LetterPageData } from "@/lib/letter/letter";
import { letterFileName, renderLetterPdf } from "@/lib/letter/pdf";
import { letterText, wordCount, type LetterContent, type LetterReview } from "@/lib/letter/types";
import { cn } from "@/lib/utils";

const trimmed = (l: LetterContent): LetterContent => ({ ...l, body: l.body.trim(), recipient: l.recipient.trim() });
const formatWhen = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One application's cover letter: draft it with AI from the profile and the posting (or write
 * it yourself), edit it, copy it into an application form or download it as a PDF. Shared by
 * the server page and the lite edition.
 */
export function LetterWorkspace({ data }: { data: LetterPageData }) {
  const [letter, setLetter] = useState(data.content);
  const [review, setReview] = useState<LetterReview | null>(data.review);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(trimmed(data.content)));
  const [stored, setStored] = useState(data.saved);
  const edited = JSON.stringify(trimmed(letter)) !== savedJson;

  const [drafting, startDrafting] = useTransition();
  const [aiError, setAiError] = useState<{ text: string; needsSetup?: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const [busy, setBusy] = useState<"pdf" | null>(null);
  const [copied, setCopied] = useState(false);

  const words = wordCount(letter.body);
  const hasBody = letter.body.trim().length > 0;

  const update = (patch: Partial<LetterContent>) => {
    setLetter((l) => ({ ...l, ...patch }));
    setSaveState("idle");
    setCopied(false);
  };

  async function save(): Promise<boolean> {
    setSaveState("saving");
    const next = trimmed(letter);
    const result = await saveLetter(data.applicationId, next);
    if (!result.ok) {
      setSaveState({ error: result.error });
      return false;
    }
    setSavedJson(JSON.stringify(next));
    setStored(true);
    setSaveState("saved");
    return true;
  }

  function draft() {
    if (edited && hasBody && !window.confirm("Writing a new draft replaces the letter, including your unsaved edits. Continue?")) return;
    setAiError(null);
    startDrafting(async () => {
      const result = await draftLetter(data.applicationId);
      if (!result.ok) return setAiError({ text: result.error, needsSetup: result.needsSetup });
      setLetter(result.data.content);
      setReview(result.data.review);
      setSavedJson(JSON.stringify(trimmed(result.data.content)));
      setStored(true);
      setSaveState("saved");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letterText(trimmed(letter)));
      setCopied(true);
    } catch {
      setSaveState({ error: "Couldn't copy. Select the letter and copy it yourself." });
    }
  }

  async function download() {
    setBusy("pdf");
    try {
      if ((edited || !stored) && !(await save())) return;
      const final = trimmed(letter);
      const url = URL.createObjectURL(await renderLetterPdf(final));
      const a = Object.assign(document.createElement("a"), { href: url, download: letterFileName(final, data.company) });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("[letter] PDF failed", error);
      setSaveState({ error: "Couldn't make the PDF. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function startOver() {
    if (!window.confirm("Throw this letter away and start again? Your edits and the last draft are lost.")) return;
    const result = await discardLetter(data.applicationId);
    if (!result.ok) return setSaveState({ error: result.error });
    setLetter(result.data);
    setSavedJson(JSON.stringify(trimmed(result.data)));
    setReview(null);
    setStored(false);
    setSaveState("idle");
  }

  if (data.profileEmpty) {
    return (
      <EmptyState
        icon={UserRound}
        title="Your profile is empty"
        body="A cover letter is written from your profile: your experience and skills. Import your CV or fill in your profile first."
        action={
          <Link href="/profile" className={buttonVariants()}>
            Go to your profile
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="sticky top-2 z-10 shadow-[var(--shadow-soft)] lg:top-4">
          <CardContent className="flex flex-wrap items-center gap-1.5 p-3">
            <Button onClick={() => void copy()} disabled={!hasBody || drafting}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy text"}
            </Button>
            <Button variant="secondary" onClick={() => void download()} disabled={!hasBody || busy !== null || drafting}>
              {busy === "pdf" ? <Loader2 className="animate-spin" /> : <Download />} PDF
            </Button>
            <Button variant="secondary" onClick={() => void save()} disabled={(!edited && stored) || saveState === "saving" || drafting}>
              <Save /> {saveState === "saving" ? "Saving…" : "Save"}
            </Button>
            <span aria-live="polite" className={cn("px-1 text-xs", typeof saveState === "object" ? "text-danger" : "text-subtle")}>
              {typeof saveState === "object" ? saveState.error : edited ? "Unsaved changes" : !stored ? "Not saved yet" : saveState === "saved" ? "Saved" : null}
            </span>
            {stored && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void startOver()} disabled={drafting}>
                <RotateCcw /> Start over
              </Button>
            )}
          </CardContent>
        </Card>

        <Section title="Letter" description="Paragraphs are separated by a blank line. Copy text pastes it into an application form as is.">
          <div className="flex flex-col gap-3">
            <Field label="Greeting">
              <Input value={letter.greeting} maxLength={120} onChange={(e) => update({ greeting: e.target.value })} />
            </Field>
            <Field label="Body">
              <Textarea
                aria-label="Letter body"
                value={letter.body}
                maxLength={6000}
                placeholder={data.aiEnabled && data.hasPosting ? "Write it here, or let AI draft it from your profile and the posting." : "Write your letter here."}
                className="min-h-96 text-[13px] leading-relaxed"
                onChange={(e) => update({ body: e.target.value })}
              />
              <p className={cn("text-xs tabular-nums", words > 450 || (hasBody && words < 150) ? "text-warning" : "text-subtle")}>
                {words} words · 250 to 350 usually reads best
              </p>
            </Field>
            <Field label="Closing">
              <Input value={letter.closing} maxLength={60} onChange={(e) => update({ closing: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Header" description="Printed on the PDF. Your email and phone are remembered on your profile.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name">
              <Input value={letter.name} maxLength={120} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input value={letter.date} maxLength={60} onChange={(e) => update({ date: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={letter.contact.email} maxLength={160} onChange={(e) => update({ contact: { ...letter.contact, email: e.target.value } })} />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={letter.contact.phone} maxLength={60} onChange={(e) => update({ contact: { ...letter.contact, phone: e.target.value } })} />
            </Field>
            <Field label="Your location">
              <Input value={letter.contact.location} maxLength={160} onChange={(e) => update({ contact: { ...letter.contact, location: e.target.value } })} />
            </Field>
            <Field label="Paper size">
              <Select
                value={letter.pageSize}
                options={[
                  { value: "LETTER", label: "Letter (short bond)" },
                  { value: "A4", label: "A4" },
                ]}
                onValueChange={(v) => update({ pageSize: v as LetterContent["pageSize"] })}
                aria-label="Paper size"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="To (one line each)">
                <Textarea value={letter.recipient} maxLength={400} className="min-h-20" onChange={(e) => update({ recipient: e.target.value })} />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <aside className="flex flex-col gap-3 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Write with AI</CardTitle>
            <CardDescription>Drafts the letter from your profile and this posting, using only facts you&apos;ve given.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!data.hasPosting ? (
              <p className="text-[13px] text-muted">The posting for this application isn&apos;t stored anymore, so there&apos;s nothing to write to.</p>
            ) : !data.aiEnabled ? (
              <p className="text-[13px] text-muted">
                <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                  Choose an AI provider
                </Link>{" "}
                to draft it. You can still write it here, copy it and download the PDF.
              </p>
            ) : (
              <Button onClick={draft} disabled={drafting}>
                {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {drafting ? "Writing…" : hasBody ? "Write a new draft" : "Write my cover letter"}
              </Button>
            )}
            {drafting && <p className="text-xs text-muted">Local models can take a few minutes. Keep this page open.</p>}
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
            {review && (
              <p className="text-xs text-subtle">
                Drafted {formatWhen(review.at)} with {review.model}
                {review.customPrompt ? " using your own prompt" : ""}.
              </p>
            )}
            {data.prompt && <PromptDetails prompt={data.prompt} settingsAnchor="letter-prompt" />}
          </CardContent>
        </Card>

        {review && <ReviewCard review={review} />}
      </aside>
    </div>
  );
}

function ReviewCard({ review }: { review: LetterReview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About this draft</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-[13px]">
        {review.notes && <p className="text-muted">{review.notes}</p>}
        {review.warnings.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/20 bg-warning-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <TriangleAlert className="size-3.5" /> Check before you send
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {review.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {review.keyPoints.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">What it leans on</p>
            <ul className="flex flex-col gap-1">
              {review.keyPoints.map((k) => (
                <li key={k} className="flex gap-2 text-xs">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {k}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Badge className="self-start">Read it through and make it sound like you</Badge>
      </CardContent>
    </Card>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
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
