"use client";

import { Building2, ClipboardPaste, Loader2, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ExpandableDescription } from "@/components/jobs/expandable-description";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { applyToJob, evaluateJob, followCompany, readPastedJob, savePastedJob } from "@/lib/client/mutations";
import { EMPLOYMENT_LABEL, WORK_SETUP_LABEL } from "@/lib/jobs/format";
import { MAX_PASTE_CHARS, type PasteReview, type PastedJob } from "@/lib/jobs/paste/types";
import { cn } from "@/lib/utils";

/*
 * "Paste a job": a card on Jobs and Home opens a dialog that takes a job link or a posting's text.
 * RolePort reads it, the user checks the fields in the same dialog, then saves, evaluates or applies.
 */

const NOT_STATED = { value: "", label: "Not stated" };
const SETUP_OPTIONS = [NOT_STATED, ...Object.entries(WORK_SETUP_LABEL).map(([value, label]) => ({ value, label }))];
const EMPLOYMENT_OPTIONS = [NOT_STATED, ...Object.entries(EMPLOYMENT_LABEL).map(([value, label]) => ({ value, label }))];
const PERIOD_OPTIONS = [
  { value: "", label: "Per…" },
  { value: "hour", label: "Per hour" },
  { value: "day", label: "Per day" },
  { value: "month", label: "Per month" },
  { value: "year", label: "Per year" },
];

const HOW: Record<PasteReview["how"], string> = {
  board: "Read straight from the company's hiring system.",
  page: "Read from the job details on the page.",
  ai: "Read by your AI from the text. Anything it couldn't find word for word in the text is left empty, so check each field.",
  manual: "Fill in the details from the posting.",
};

const STEPS = [
  <>Paste a link to one job posting, or copy the whole posting and paste its text: from LinkedIn, a Facebook group, a recruiter&apos;s email, anywhere.</>,
  <>RolePort reads it: from the company&apos;s hiring system (Greenhouse, Lever and others) or the job details on the page. Text is read by your AI.</>,
  <>You check the details, then save it, evaluate your fit or apply. Nothing is saved until you do.</>,
];

const CAUTIONS = [
  "LinkedIn, Facebook, Indeed, Glassdoor and OnlineJobs.ph links aren't read, since their terms don't allow it. Copy the description from the page and paste the text instead.",
  "Only public http:// and https:// links work. Links to your own computer or home network (localhost, 192.168…) are refused.",
  "Some sites only show the job in a browser, or block automatic reading. If a link doesn't work, paste the text.",
  "One link at a time. Without an AI provider in Settings, you fill in the details from pasted text yourself.",
];

/**
 * A card that opens the "Add a job" dialog: paste a link or a posting, read it, then check the
 * fields and save, evaluate or apply. Used on Jobs (beside Follow companies) and on Home.
 */
export function PasteJob({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<PasteReview | null>(null);
  const [reading, startReading] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);

  // The native dialog focuses its first button when it opens (its effect runs before this one); start in the box instead.
  useEffect(() => {
    if (open && !review) field.current?.focus();
  }, [open, review]);

  function close() {
    // A read in progress finishes into a dialog nobody sees; keep it open until it's done.
    if (reading) return;
    setOpen(false);
    setReview(null);
    setError(null);
  }

  function read(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return setError("Paste a job link or the job description.");
    setError(null);
    startReading(async () => {
      const result = await readPastedJob(input);
      if (result.ok) setReview(result.data);
      else setError(result.error);
    });
  }

  return (
    <>
      <div className={cn("flex flex-col gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 sm:flex-row sm:items-center", className)}>
        <ClipboardPaste className="hidden size-4 shrink-0 text-brand-ink sm:block" />
        <p className="flex-1 text-[13px] text-muted">
          <strong className="font-medium text-fg">Found a job elsewhere?</strong> Paste its link or description, and RolePort adds it to your list.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start sm:self-auto">
          Add a job
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        labelledBy={review ? "paste-review-title" : "paste-job-title"}
        className="max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto"
      >
        {review ? (
          <ReviewForm
            key={review.job.sourceId ?? review.job.url}
            review={review}
            onClose={close}
            onBack={() => setReview(null)}
            onDone={() => {
              setOpen(false);
              setReview(null);
              setInput("");
            }}
          />
        ) : (
          <form onSubmit={read} className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <h2 id="paste-job-title" className="text-[15px] font-semibold tracking-tight">
                  Add a job you found elsewhere
                </h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  Saw a job on another site, in a group or in your inbox? Bring it into RolePort and work on it like any other.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
                <X />
              </Button>
            </div>

            <ol className="flex flex-col gap-2.5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-muted">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paste-input">Job link or description</Label>
              <Textarea
                id="paste-input"
                rows={7}
                value={input}
                maxLength={MAX_PASTE_CHARS}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl/⌘+Enter reads it; plain Enter keeps new lines in pasted text.
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) read(e);
                }}
                placeholder={"https://careers.example.com/jobs/123\n\nor paste the whole job description here"}
                className="text-[13px]"
                ref={field}
              />
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-3.5 shrink-0" /> Good to know
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5.5 text-xs leading-relaxed">
                {CAUTIONS.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
              <Button type="submit" disabled={reading}>
                {reading ? <Loader2 className="animate-spin" /> : <ClipboardPaste />} {reading ? "Reading…" : "Read job"}
              </Button>
              <Button type="button" variant="ghost" onClick={close} disabled={reading} className="ml-auto">
                Cancel
              </Button>
              {reading && <p className="basis-full text-xs text-subtle">Reading the posting. With a local AI model this can take a minute.</p>}
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

type Busy = "save" | "evaluate" | "apply" | null;

function ReviewForm({
  review,
  onClose,
  onBack,
  onDone,
}: {
  review: PasteReview;
  onClose: () => void;
  /** Back to the pasted link or text, to change it. */
  onBack: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<PastedJob>(review.job);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ text: string; jobId?: string } | null>(null);
  const [follow, setFollow] = useState<{ ok: boolean; text: string } | null>(null);
  const [following, startFollowing] = useTransition();

  const set = <K extends keyof PastedJob>(key: K, value: PastedJob[K]) => setJob((j) => ({ ...j, [key]: value }));
  const amount = (text: string) => {
    const n = Number(text.replace(/[^\d.]/g, ""));
    return text.trim() && Number.isFinite(n) ? Math.round(n) : null;
  };
  const closed = review.check?.status === "closed";

  async function finish(action: Exclude<Busy, null>) {
    setBusy(action);
    setError(null);
    const saved = await savePastedJob(job, review.check);
    if (!saved.ok) {
      setBusy(null);
      return setError({ text: saved.error });
    }
    const { jobId } = saved.data;
    if (action === "apply") {
      const applied = await applyToJob(jobId);
      if (!applied.ok) {
        setBusy(null);
        return setError({ text: applied.error, jobId });
      }
      onDone();
      return router.push(`/applied/${applied.data.applicationId}`);
    }
    if (action === "evaluate") {
      const evaluated = await evaluateJob(jobId);
      if (!evaluated.ok) {
        setBusy(null);
        return setError({ text: `Saved, but the evaluation didn't run: ${evaluated.error}`, jobId });
      }
    }
    onDone();
    router.push(`/jobs/${jobId}`);
  }

  function followIt() {
    if (!review.board) return;
    const { careersUrl, name } = review.board;
    startFollowing(async () => {
      const result = await followCompany({ url: careersUrl, name });
      setFollow(
        result.ok
          ? { ok: true, text: `You're following ${result.data.name}. Their openings now show up in your searches.` }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void finish("save");
      }}
      className="flex flex-col gap-4 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h2 id="paste-review-title" className="text-[15px] font-semibold tracking-tight">
            Check the job&apos;s details
          </h2>
          <p className="text-[13px] leading-relaxed text-muted">{HOW[review.how]}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      {closed && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>This job looks closed. {review.check?.reason}</span>
        </p>
      )}
      {review.notes.map((note) => (
        <p key={note} className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {note}
        </p>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job title" id="paste-title" required>
          <Input id="paste-title" value={job.title} maxLength={200} onChange={(e) => set("title", e.target.value)} required />
        </Field>
        <Field label="Company" id="paste-company" required>
          <Input id="paste-company" value={job.company} maxLength={200} onChange={(e) => set("company", e.target.value)} required />
        </Field>
        <Field label="Location" id="paste-location">
          <Input
            id="paste-location"
            value={job.location ?? ""}
            maxLength={200}
            onChange={(e) => set("location", e.target.value || null)}
            placeholder="e.g. Makati City, Philippines"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Work setup" id="paste-setup">
            <Select
              id="paste-setup"
              options={SETUP_OPTIONS}
              value={job.workSetup ?? ""}
              onValueChange={(v) => set("workSetup", (v || null) as PastedJob["workSetup"])}
            />
          </Field>
          <Field label="Type" id="paste-type">
            <Select
              id="paste-type"
              options={EMPLOYMENT_OPTIONS}
              value={job.employmentType ?? ""}
              onValueChange={(v) => set("employmentType", (v || null) as PastedJob["employmentType"])}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="paste-salary-min">Salary</Label>
          <div className="grid grid-cols-[1fr_1fr_5rem_8rem] gap-1.5 max-sm:grid-cols-2">
            <Input
              id="paste-salary-min"
              inputMode="numeric"
              aria-label="Lowest salary"
              placeholder="From"
              value={job.salaryMin ?? ""}
              onChange={(e) => set("salaryMin", amount(e.target.value))}
            />
            <Input
              inputMode="numeric"
              aria-label="Highest salary"
              placeholder="To"
              value={job.salaryMax ?? ""}
              onChange={(e) => set("salaryMax", amount(e.target.value))}
            />
            <Input
              aria-label="Currency"
              placeholder="PHP"
              maxLength={3}
              value={job.salaryCurrency}
              onChange={(e) => set("salaryCurrency", e.target.value.toUpperCase())}
            />
            <Select
              aria-label="Salary period"
              options={PERIOD_OPTIONS}
              value={job.salaryPeriod ?? ""}
              onValueChange={(v) => set("salaryPeriod", (v || null) as PastedJob["salaryPeriod"])}
            />
          </div>
        </div>
        <Field label="Link to the posting" id="paste-url" className="sm:col-span-2">
          <Input
            id="paste-url"
            type="url"
            inputMode="url"
            value={job.url}
            maxLength={2000}
            onChange={(e) => set("url", e.target.value.trim())}
            placeholder="Optional: where to apply, so you can open it later"
          />
        </Field>
      </div>

      {(job.requirements.length > 0 || job.skills.length > 0) && (
        <p className="text-xs text-muted">
          Also found: {[count(job.requirements.length, "requirement"), count(job.skills.length, "skill")].filter(Boolean).join(" and ")}. They show on the
          job&apos;s page.
        </p>
      )}
      {job.description && (
        <div className="text-[13px]">
          <ExpandableDescription html={job.description} />
        </div>
      )}

      {review.board && (
        <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center">
          <Building2 className="hidden size-4 shrink-0 text-brand-ink sm:block" />
          <p className="flex-1 text-[13px] text-muted">
            {review.board.name} hires through {review.board.label}. Follow them and their new openings show up in your searches.
          </p>
          {follow?.ok ? null : (
            <Button type="button" variant="secondary" size="sm" onClick={followIt} disabled={following} className="self-start sm:self-auto">
              {following ? "Following…" : `Follow ${review.board.name}`}
            </Button>
          )}
        </div>
      )}
      {follow && (
        <p role="status" className={cn("-mt-2 text-xs", follow.ok ? "text-success" : "text-danger")}>
          {follow.text}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {error.text}
          {error.jobId && (
            <>
              {" "}
              <Link href={`/jobs/${error.jobId}`} onClick={onDone} className="underline underline-offset-2 hover:no-underline">
                Open the job
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
        <Button type="button" onClick={() => void finish("apply")} disabled={busy !== null}>
          {busy === "apply" ? <Loader2 className="animate-spin" /> : <Send />} Apply
        </Button>
        <Button type="button" variant="secondary" onClick={() => void finish("evaluate")} disabled={busy !== null}>
          {busy === "evaluate" ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy === "evaluate" ? "Evaluating…" : "Evaluate fit"}
        </Button>
        <Button type="submit" variant="secondary" disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy !== null} className="ml-auto">
          Back
        </Button>
        {busy === "evaluate" && <p className="basis-full text-xs text-subtle">With a local AI model, the evaluation can take a minute.</p>}
      </div>
    </form>
  );
}

const count = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : null);

function Field({
  label,
  id,
  required,
  className,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {children}
    </div>
  );
}
