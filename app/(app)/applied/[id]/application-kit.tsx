"use client";

import { Check, ChevronRight, Copy, Download, FileText, Loader2, Mail, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { draftLetter, tailorCv } from "@/lib/client/mutations";
import { cvFileName, renderCvPdf } from "@/lib/cv/pdf";
import type { CvContent, CvTailoring } from "@/lib/cv/types";
import { letterFileName, renderLetterPdf } from "@/lib/letter/pdf";
import { letterText, wordCount, type LetterContent, type LetterReview } from "@/lib/letter/types";
import { cn } from "@/lib/utils";
import type { ApplicationKit as Kit } from "../view-data";
import { QuestionsPanel } from "./questions-panel";

const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type Busy = "cv-ai" | "cv-pdf" | "letter-ai" | "letter-pdf" | null;

/**
 * Everything to send with this application, ready in place: generate the tailored CV and the
 * cover letter with one click each (or both at once), download the CV, copy the letter. Each
 * row links to its own page for the full editor, the checks and the prompt.
 */
export function ApplicationKit({ applicationId, company, kit }: { applicationId: string; company: string; kit: Kit }) {
  const [cv, setCv] = useState<{ content: CvContent; tailoring: CvTailoring | null } | null>(kit.cv && { content: kit.cv.content, tailoring: kit.cv.tailoring });
  const [letter, setLetter] = useState<{ content: LetterContent; review: LetterReview | null } | null>(
    kit.letter && { content: kit.letter.content, review: kit.letter.review },
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [all, setAll] = useState(false);
  const [errors, setErrors] = useState<{ cv?: string; letter?: string; setup?: boolean }>({});
  const [copied, setCopied] = useState(false);

  const info = kit.cv ?? kit.letter;
  const canAi = Boolean(info?.aiEnabled && info.hasPosting);
  const profileEmpty = Boolean(info?.profileEmpty);
  const hasLetter = Boolean(letter?.content.body.trim());

  async function runCv(): Promise<boolean> {
    setBusy("cv-ai");
    setErrors((e) => ({ ...e, cv: undefined }));
    const result = await tailorCv(applicationId);
    setBusy(null);
    if (!result.ok) {
      setErrors((e) => ({ ...e, cv: result.error, setup: result.needsSetup }));
      return false;
    }
    setCv(result.data);
    return true;
  }

  /** `replace`: part of "Prepare all", which already said it writes everything fresh. */
  async function runLetter(replace = false): Promise<boolean> {
    if (hasLetter && !replace && !window.confirm("Write a new draft? It replaces the current letter.")) return false;
    setBusy("letter-ai");
    setErrors((e) => ({ ...e, letter: undefined }));
    const result = await draftLetter(applicationId);
    setBusy(null);
    if (!result.ok) {
      setErrors((e) => ({ ...e, letter: result.error, setup: result.needsSetup }));
      return false;
    }
    setLetter(result.data);
    setCopied(false);
    return true;
  }

  // One after the other: a local model handles one request at a time anyway.
  async function runAll() {
    if ((cv?.tailoring || hasLetter) && !window.confirm("This tailors your CV and writes the cover letter again, replacing what's there. Continue?")) return;
    setAll(true);
    if (await runCv()) await runLetter(true);
    setAll(false);
  }

  async function downloadCv() {
    if (!cv) return;
    setBusy("cv-pdf");
    try {
      save(await renderCvPdf(cv.content), cvFileName(cv.content, company));
    } catch {
      setErrors((e) => ({ ...e, cv: "Couldn't make the PDF. Please try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function downloadLetter() {
    if (!letter) return;
    setBusy("letter-pdf");
    try {
      save(await renderLetterPdf(letter.content), letterFileName(letter.content, company));
    } catch {
      setErrors((e) => ({ ...e, letter: "Couldn't make the PDF. Please try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function copyLetter() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letterText(letter.content));
      setCopied(true);
    } catch {
      setErrors((e) => ({ ...e, letter: "Couldn't copy. Open the letter and copy it from there." }));
    }
  }

  const working = busy !== null;
  const cvWarnings = cv?.tailoring?.warnings.length ?? 0;
  const letterWarnings = letter?.review?.warnings.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Your application kit</CardTitle>
            <CardDescription>Get what you&apos;ll send ready here, then continue to the posting.</CardDescription>
          </div>
          {canAi && !profileEmpty && (
            <Button size="sm" onClick={() => void runAll()} disabled={working}>
              {all ? <Loader2 className="animate-spin" /> : <Wand2 />} {all ? "Preparing…" : "Prepare all with AI"}
            </Button>
          )}
        </div>
      </CardHeader>

      {profileEmpty ? (
        <p className="px-5 py-4 text-[13px] text-muted">
          Your CV and cover letter are written from your profile.{" "}
          <Link href="/profile" className="font-medium text-brand-ink hover:underline">
            Fill in your profile or import your CV
          </Link>{" "}
          first.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          <KitRow
            icon={FileText}
            title="Tailored CV"
            href={`/applied/${applicationId}/cv`}
            status={
              cv?.tailoring
                ? `Tailored ${when(cv.tailoring.at)}`
                : kit.cv?.saved
                  ? "Edited from your profile"
                  : "From your profile, not tailored to this job yet"
            }
            done={Boolean(cv?.tailoring)}
            warnings={cvWarnings}
            error={errors.cv}
            busyText={busy === "cv-ai" ? "Tailoring your CV… local models can take a minute or two." : null}
          >
            {canAi && (
              <Button size="sm" variant={cv?.tailoring ? "secondary" : "primary"} onClick={() => void runCv()} disabled={working}>
                {busy === "cv-ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} {cv?.tailoring ? "Tailor again" : "Tailor with AI"}
              </Button>
            )}
            <Button size="sm" variant={cv?.tailoring ? "primary" : "secondary"} onClick={() => void downloadCv()} disabled={working || !cv}>
              {busy === "cv-pdf" ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
            </Button>
          </KitRow>

          <KitRow
            icon={Mail}
            title="Cover letter"
            href={`/applied/${applicationId}/cover-letter`}
            status={
              letter?.review
                ? `Drafted ${when(letter.review.at)}, ${wordCount(letter.content.body)} words`
                : hasLetter
                  ? `Written by you, ${wordCount(letter!.content.body)} words`
                  : "Not written yet"
            }
            done={hasLetter}
            warnings={letterWarnings}
            error={errors.letter}
            busyText={busy === "letter-ai" ? "Writing your cover letter… local models can take a minute or two." : null}
            preview={hasLetter ? letterText(letter!.content) : undefined}
          >
            {canAi && (
              <Button size="sm" variant={hasLetter ? "secondary" : "primary"} onClick={() => void runLetter()} disabled={working}>
                {busy === "letter-ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} {hasLetter ? "Write again" : "Write with AI"}
              </Button>
            )}
            {hasLetter && (
              <>
                <Button size="sm" onClick={() => void copyLetter()} disabled={working}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy text"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void downloadLetter()} disabled={working}>
                  {busy === "letter-pdf" ? <Loader2 className="animate-spin" /> : <Download />} PDF
                </Button>
              </>
            )}
          </KitRow>

          {kit.questions && <QuestionsPanel applicationId={applicationId} data={kit.questions} />}
        </ul>
      )}

      {!profileEmpty && info && !canAi && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          {!info.hasPosting ? (
            "The posting isn't stored anymore, so AI can't tailor to it. You can still edit and download what's here."
          ) : (
            <>
              <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                Choose an AI provider
              </Link>{" "}
              to tailor your CV and write the letter in one click. Without it, you can still edit and download them.
            </>
          )}
        </p>
      )}
      {errors.setup && (
        <p className="border-t border-border px-5 py-3 text-xs text-danger">
          AI isn&apos;t set up.{" "}
          <Link href="/settings" className="font-medium underline">
            Open Settings
          </Link>
        </p>
      )}
    </Card>
  );
}

export function RowIcon({ icon: Icon, done = false }: { icon: typeof FileText; done?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md border",
        done ? "border-success/30 bg-success-soft text-success" : "border-border bg-surface-2 text-muted",
      )}
    >
      {done ? <Check className="size-4" /> : <Icon className="size-4" strokeWidth={1.75} />}
    </span>
  );
}

function KitRow({
  icon,
  title,
  href,
  status,
  done,
  warnings,
  error,
  busyText,
  preview,
  children,
}: {
  icon: typeof FileText;
  title: string;
  href: string;
  status: string;
  done: boolean;
  warnings: number;
  error?: string;
  busyText: string | null;
  preview?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <RowIcon icon={icon} done={done} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-[13px] font-medium">{title}</p>
          <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-muted hover:text-fg">
            Review &amp; edit <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <p className="-mt-1.5 text-xs text-muted">{status}</p>
        {preview && <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-muted">{preview}</p>}
        {warnings > 0 && (
          <Link href={href} className="flex items-center gap-1.5 text-xs font-medium text-warning hover:underline">
            <TriangleAlert className="size-3.5" /> {warnings} thing{warnings === 1 ? "" : "s"} to check before you send
          </Link>
        )}
        {busyText && <p className="text-xs text-muted">{busyText}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    </li>
  );
}

