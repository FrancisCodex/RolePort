import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JobDetailView } from "@/components/jobs/job-detail";
import { JobPanel } from "@/components/jobs/job-panel";
import { isAiConfigured } from "@/lib/ai/config";
import { getJob } from "@/lib/jobs/data";

/**
 * A job opened from the results: the same details as /jobs/[id], beside the list on wide
 * screens or in a drawer on smaller ones. A refresh or shared link opens the full page.
 */
export default function OpenedJob(props: PageProps<"/jobs/[id]">) {
  return (
    <Suspense>
      <Panel params={props.params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  return (
    <JobPanel jobId={id}>
      <Suspense fallback={<PanelSkeleton />}>
        <PanelContent id={id} />
      </Suspense>
    </JobPanel>
  );
}

async function PanelContent({ id }: { id: string }) {
  const [job, aiEnabled] = await Promise.all([getJob(id), isAiConfigured()]);
  if (!job) notFound();
  return <JobDetailView job={job} aiEnabled={aiEnabled} variant="panel" />;
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-52 animate-pulse rounded-3xl bg-surface-3" />
      <div className="h-32 animate-pulse rounded-3xl bg-surface-3" />
      <div className="h-64 animate-pulse rounded-3xl bg-surface-3" />
    </div>
  );
}
