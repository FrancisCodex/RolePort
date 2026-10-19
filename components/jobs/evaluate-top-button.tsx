"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { evaluateJob } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";

type Progress = { done: number; failed: number; total: number; current: string };

/**
 * Port of ai-job-search's /rank batch idea: evaluate the top results one at a time
 * (sequential so a local model isn't overwhelmed), then refresh the list once.
 */
export function EvaluateTopButton({ jobs }: { jobs: { id: string; title: string }[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<{ text: string; needsSetup?: boolean } | null>(null);
  const stop = useRef(false);

  async function run() {
    stop.current = false;
    setMessage(null);
    let done = 0;
    let failed = 0;
    let lastError = "";
    for (const job of jobs) {
      if (stop.current) break;
      setProgress({ done, failed, total: jobs.length, current: job.title });
      const result = await evaluateJob(job.id, false);
      if (result.ok) {
        done++;
        continue;
      }
      if (result.needsSetup) {
        setMessage({ text: result.error, needsSetup: true });
        break;
      }
      failed++;
      lastError = result.error;
      // Two failures in a row usually means the provider is down: stop instead of burning through the list.
      if (failed >= 2 && done === 0) break;
    }
    setProgress(null);
    if (failed > 0) setMessage({ text: `${failed} evaluation${failed === 1 ? "" : "s"} failed: ${lastError}` });
    if (done > 0) router.refresh();
  }

  if (progress) {
    const pct = Math.round(((progress.done + progress.failed) / progress.total) * 100);
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3" aria-live="polite">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">
              Evaluating {progress.done + progress.failed + 1} of {progress.total}
            </span>
            <span className="text-muted"> · {progress.current}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => (stop.current = true)}>
            <Square className="fill-current" /> Stop
          </Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-brand-ink">
        <Sparkles className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-medium">
          Get an AI fit score on the top {jobs.length} result{jobs.length === 1 ? "" : "s"}. They run one at a time.
        </p>
        <Button size="sm" onClick={run}>
          Evaluate top {jobs.length}
        </Button>
      </div>
      {message && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          {message.text}{" "}
          {message.needsSetup && (
            <Link href="/settings" className="font-semibold underline">
              Open Settings
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
