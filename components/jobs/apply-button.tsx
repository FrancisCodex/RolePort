"use client";

import { ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { applyToJob } from "@/lib/client/mutations";
import type { JobListItem } from "@/lib/jobs/queries";

/**
 * "Apply" tracks the job as applied and opens its page under Applied jobs, where the user
 * prepares (tailored CV, answers) and then continues to the posting. Once applied, it links there.
 */
export function ApplyButton({ job }: { job: Pick<JobListItem, "id" | "application"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (job.application && job.application.status !== "saved") {
    return (
      <Link href={`/applied/${job.application.id}`} className={buttonVariants()}>
        View application <ArrowRight />
      </Link>
    );
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyToJob(job.id);
      if (result.ok) router.push(`/applied/${result.data.applicationId}`);
      else setError(result.error);
    });
  }

  return (
    <>
      <Button onClick={apply} disabled={pending}>
        <Send /> {pending ? "Opening…" : "Apply"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}
