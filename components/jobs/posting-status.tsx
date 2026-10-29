"use client";

import { CircleCheck, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkJobStillOpen } from "@/lib/client/mutations";
import { canCheckJob, type JobCheck } from "@/lib/jobs/paste/types";
import { cn } from "@/lib/utils";

/** A saved job is checked again on its page when its last check is older than this. */
const RECHECK_AFTER_MS = 24 * 60 * 60_000;

function checkedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Whether a job from a company feed or a pasted link is still open: "Closed" when it's gone,
 * and "Check again". A job on the user's list is checked by itself once a day, when its page opens.
 */
export function PostingStatus({
  job,
}: {
  job: { id: string; source: string; url: string; saved: boolean; extras: { check: JobCheck | null } };
}) {
  const [checking, startChecking] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const check = job.extras.check;
  const checkable = canCheckJob(job);

  function run() {
    setError(null);
    startChecking(async () => {
      const result = await checkJobStillOpen(job.id);
      if (!result.ok) setError(result.error);
    });
  }

  // Once per page view, and only for jobs the user keeps, so browsing results never fetches pages.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !checkable || !job.saved) return;
    if (check && Date.now() - Date.parse(check.at) < RECHECK_AFTER_MS) return;
    autoChecked.current = true;
    startChecking(async () => {
      await checkJobStillOpen(job.id);
    });
  }, [checkable, job.saved, job.id, check]);

  if (!checkable) return null;

  const again = (
    <button type="button" onClick={run} disabled={checking} className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline disabled:opacity-60">
      {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
      {checking ? "Checking…" : check ? "Check again" : "Check if it's still open"}
    </button>
  );

  if (check?.status === "closed") {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
        <p className="flex items-start gap-2 font-medium">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Closed. {check.reason} <span className="font-normal opacity-80">Checked {checkedAgo(check.at)}.</span>
          </span>
        </p>
        <p className="pl-5.5 text-xs">{again}</p>
        {error && <p className="pl-5.5 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <p className={cn("-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle")}>
      {check?.status === "open" && (
        <span className="inline-flex items-center gap-1 text-success" title={check.reason ?? undefined}>
          <CircleCheck className="size-3.5" /> Still open
        </span>
      )}
      {check?.status === "unknown" && <span>{check.reason}</span>}
      {check && <span>Checked {checkedAgo(check.at)}</span>}
      {again}
      {error && <span className="basis-full text-danger">{error}</span>}
    </p>
  );
}
