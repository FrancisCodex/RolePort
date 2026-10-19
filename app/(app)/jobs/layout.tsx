import { Suspense } from "react";
import { JobSlotProvider } from "@/components/jobs/job-detail-outlet";

/**
 * `drawer` is a job opened from the results (@drawer/(.)[id]). The results place it beside
 * the list on wide screens (a job board's split view) and as a drawer on smaller ones.
 */
export default function JobsLayout({ children, drawer }: LayoutProps<"/jobs">) {
  return <JobSlotProvider slot={<Suspense>{drawer}</Suspense>}>{children}</JobSlotProvider>;
}
