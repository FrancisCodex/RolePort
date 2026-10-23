"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { evaluateJob } from "@/lib/client/mutations";
import { Button } from "@/components/ui/button";

/** Live "12s" counter while something slow (a local model) is running. */
export function useElapsed(running: boolean): { elapsed: number; markStart: () => void } {
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return {
    elapsed: running && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0,
    markStart: () => {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
    },
  };
}

export function EvaluateButton({ jobId, again = false }: { jobId: string; again?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ message: string; needsSetup?: boolean } | null>(null);
  const { elapsed, markStart } = useElapsed(pending);

  function run() {
    setError(null);
    markStart();
    startTransition(async () => {
      const result = await evaluateJob(jobId);
      if (!result.ok) setError({ message: result.error, needsSetup: result.needsSetup });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={again ? "secondary" : "primary"}
        size={again ? "sm" : "md"}
        onClick={run}
        disabled={pending}
        aria-live="polite"
        className={again ? "" : "w-full"}
      >
        {pending ? <Loader2 className="animate-spin" /> : again ? <RefreshCw /> : <Sparkles />}
        {pending ? `Evaluating… ${elapsed > 0 ? `${elapsed}s` : ""}` : again ? "Re-evaluate" : "Evaluate fit"}
      </Button>
      {pending && !again && (
        <p className="text-xs text-subtle">Reading the posting against your profile. Local models can take up to a minute.</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          {error.message}{" "}
          {error.needsSetup && (
            <Link href="/settings" className="font-semibold underline">
              Open Settings
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
