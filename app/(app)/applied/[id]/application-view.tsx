"use client";

import { CalendarClock, ExternalLink, MessagesSquare, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { CompanyLogo } from "@/components/jobs/job-card";
import { JobDetailView } from "@/components/jobs/job-detail";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { deleteApplication, saveApplicationNotes, setApplicationStatus, setInterviewDate } from "@/lib/client/mutations";
import { daysUntil } from "@/lib/interview/types";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, StatusBadge, StatusSelect, type Status } from "../../pipeline/status-select";
import { MAX_NOTES, type ApplicationData } from "../view-data";
import { ApplicationKit } from "./application-kit";

/**
 * One application: the saved posting on the left, and beside it where the application
 * stands, what to prepare for it and the user's notes. Shared by the server page and lite.
 */
export function ApplicationView({ data }: { data: ApplicationData }) {
  const [status, setOptimisticStatus] = useOptimistic(data.status);
  const [, startTransition] = useTransition();

  function changeStatus(next: Status) {
    startTransition(async () => {
      setOptimisticStatus(next);
      await setApplicationStatus(data.id, next);
    });
  }

  const actions = (
    <>
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants()}>
          {status === "saved" ? "Open job posting" : "Continue to job posting"} <ExternalLink />
        </a>
      )}
      <div className="w-40">
        <StatusSelect status={status} onChange={changeStatus} />
      </div>
    </>
  );

  const aside = (
    <>
      <ProgressCard data={data} status={status} />
      <InterviewCard id={data.id} status={status} interviewAt={data.interviewAt} />
      <NotesCard id={data.id} initial={data.notes} />
    </>
  );

  const kit = <ApplicationKit applicationId={data.id} company={data.company} kit={data.kit} />;

  if (data.job) {
    // The posting is reference material here: a short preview in the title card, "Show more" for the rest.
    return (
      <JobDetailView
        job={data.job}
        aiEnabled={data.aiEnabled}
        source={data.source}
        actions={actions}
        aside={aside}
        lead={kit}
        asideEnd={<RemoveButton id={data.id} />}
        descriptionPreview
      />
    );
  }

  // The stored posting is gone (an old backup, say): the application itself still has its role and company.
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <CompanyLogo src={null} company={data.company} size="size-11" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight text-balance">{data.role}</h1>
                <p className="text-[13px] text-muted">{data.company}</p>
              </div>
            </div>
            <p className="text-[13px] text-muted">The posting for this application isn&apos;t stored on this device anymore.</p>
            <div className="flex flex-wrap gap-1.5">{actions}</div>
          </CardContent>
        </Card>
        {kit}
      </div>
      <aside className="flex flex-col gap-3">
        {aside}
        <RemoveButton id={data.id} />
      </aside>
    </div>
  );
}

function ProgressCard({ data, status }: { data: ApplicationData; status: Status }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <dt className="text-xs text-muted">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Applied</dt>
            <dd className="mt-1 tabular-nums">{data.appliedOn ?? "Not yet"}</dd>
          </div>
        </dl>
        {data.events.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">History</p>
            <ol className="flex flex-col">
              {data.events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < data.events.length - 1 && <span aria-hidden className="absolute top-3 bottom-0 left-[3px] w-px bg-border" />}
                  <span aria-hidden className={cn("mt-1.5 size-[7px] shrink-0 rounded-full", i === 0 ? "bg-brand" : "bg-border-strong")} />
                  <span className="flex flex-1 items-baseline justify-between gap-2 text-[13px]">
                    {STATUS_LABEL[e.status]}
                    <span className="text-xs text-subtle tabular-nums">{e.on}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/** Saves when the field loses focus, so there's no button to forget. */
/** `YYYY-MM-DDTHH:mm` in local time, for a datetime-local input. */
function localInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The interview: when it is (with a countdown) and a way into the Interview Coach, made
 * prominent once the application reaches a screen or interview.
 */
function InterviewCard({ id, status, interviewAt }: { id: string; status: Status; interviewAt: string | null }) {
  const soon = status === "screening" || status === "interview" || interviewAt !== null;
  const [value, setValue] = useState(localInput(interviewAt));
  const [saved, setSaved] = useState(interviewAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setInterviewDate(id, next);
      if (!result.ok) return setError(result.error);
      setSaved(next);
      if (next === null) setValue("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <MessagesSquare className="size-4 text-muted" /> Interview
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {saved && (
          // Relative to the viewer's clock, which can differ from the server's.
          <p className="flex items-center gap-1.5 text-[13px] font-medium" suppressHydrationWarning>
            <CalendarClock className="size-4 text-brand-ink" />
            {new Date(saved) < new Date() && daysUntil(new Date(saved)) !== "today" ? "Was" : "Coming up"} {daysUntil(new Date(saved))}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`interview-at-${id}`} className="text-xs text-muted">
            When is it?
          </label>
          <div className="flex gap-1.5">
            <Input
              id={`interview-at-${id}`}
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-w-0 flex-1 text-[13px]"
            />
            {value && localInput(saved) !== value ? (
              <Button variant="secondary" onClick={() => save(new Date(value).toISOString())} disabled={pending}>
                Save
              </Button>
            ) : (
              saved && (
                <Button variant="ghost" onClick={() => save(null)} disabled={pending} aria-label="Clear the interview date">
                  <X />
                </Button>
              )
            )}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <p className="text-[13px] text-muted">
          {soon
            ? "Run a mock interview built from this posting and what you sent, then see how your answers landed."
            : "A mock interview built from this posting and what you sent, for when they call."}
        </p>
        <Link href={`/coach/new?application=${id}`} className={buttonVariants({ variant: soon ? "primary" : "secondary" })}>
          Practise the interview
        </Link>
      </CardContent>
    </Card>
  );
}

function NotesCard({ id, initial }: { id: string; initial: string }) {
  const saved = useRef(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");

  async function save(value: string) {
    if (value === saved.current) return;
    setState("saving");
    const result = await saveApplicationNotes(id, value);
    if (result.ok) {
      saved.current = value;
      setState("saved");
    } else setState({ error: result.error });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          <label htmlFor={`notes-${id}`}>Notes</label>
        </CardTitle>
        <span aria-live="polite" className={cn("text-xs", typeof state === "object" ? "text-danger" : "text-subtle")}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : typeof state === "object" ? state.error : null}
        </span>
      </CardHeader>
      <CardContent>
        <Textarea
          id={`notes-${id}`}
          defaultValue={initial}
          maxLength={MAX_NOTES}
          placeholder="Recruiter's name, salary you asked for, interview dates…"
          onBlur={(e) => void save(e.currentTarget.value)}
          onChange={() => state !== "idle" && setState("idle")}
        />
      </CardContent>
    </Card>
  );
}

function RemoveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm("Remove this job from Applied jobs? Its status history and notes are deleted too.")) return;
    startTransition(async () => {
      const result = await deleteApplication(id);
      if (result.ok) router.push("/applied");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="hover:text-danger">
        <Trash2 /> {pending ? "Removing…" : "Remove from Applied jobs"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
