"use client";

import { ChevronRight, ExternalLink, FileText, Mail, MessageSquareText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { CompanyLogo } from "@/components/jobs/job-card";
import { JobDetailView } from "@/components/jobs/job-detail";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/fields";
import { deleteApplication, saveApplicationNotes, setApplicationStatus } from "@/lib/client/mutations";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, StatusBadge, StatusSelect, type Status } from "../../pipeline/status-select";
import { MAX_NOTES, type ApplicationData } from "../view-data";

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
      <PrepareCard id={data.id} />
      <NotesCard id={data.id} initial={data.notes} />
      <RemoveButton id={data.id} />
    </>
  );

  if (data.job) return <JobDetailView job={data.job} aiEnabled={data.aiEnabled} source={data.source} actions={actions} aside={aside} />;

  // The stored posting is gone (an old backup, say): the application itself still has its role and company.
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
      <Card className="self-start">
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
      <aside className="flex flex-col gap-3">{aside}</aside>
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

/** Steps that open their own page carry `href`; the rest are still to come. */
const prepareSteps = (id: string) => [
  {
    icon: FileText,
    title: "Tailor your CV",
    body: "An ATS-friendly CV rewritten for this posting from your profile, as a PDF.",
    href: `/applied/${id}/cv`,
  },
  {
    icon: Mail,
    title: "Prepare a cover letter",
    body: "A letter written from your profile for this posting, to paste into the form or send as a PDF.",
    href: `/applied/${id}/cover-letter`,
  },
  {
    icon: MessageSquareText,
    title: "Answer application questions",
    body: "Paste the questions from the application form and get drafts grounded in your experience.",
    href: null,
  },
];

function PrepareCard({ id }: { id: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prepare your application</CardTitle>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-border">
        {prepareSteps(id).map(({ icon: Icon, title, body, href }) => {
          const inner = (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                  {title} {!href && <Badge>Coming soon</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">{body}</p>
              </div>
              {href && <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-subtle" />}
            </>
          );
          return (
            <li key={title}>
              {href ? (
                <Link href={href} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                  {inner}
                </Link>
              ) : (
                <div className="flex gap-3 px-5 py-3.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Saves when the field loses focus, so there's no button to forget. */
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
