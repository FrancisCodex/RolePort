import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JobDetailView } from "@/components/jobs/job-detail";
import { isAiConfigured } from "@/lib/ai/config";
import { getJob } from "@/lib/jobs/data";
import { sourceCredit } from "@/lib/jobs/search";

export const metadata: Metadata = { title: "Job" };

// The full page for one job: "Open full page" from the jobs list, a refresh or a shared link.
export default function JobPage(props: PageProps<"/jobs/[id]">) {
  return (
    <>
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to jobs
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
        <JobDetail params={props.params} />
      </Suspense>
    </>
  );
}

async function JobDetail({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const [job, aiEnabled] = await Promise.all([getJob(id), isAiConfigured()]);
  if (!job) notFound();
  return <JobDetailView job={job} aiEnabled={aiEnabled} source={sourceCredit(job.source)} />;
}
