import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  return (
    <>
      <PageHeader title="Interview Coach" description="Prep packs and mock interviews for the jobs you applied to." />
      <EmptyState
        icon={MessagesSquare}
        title="Practise before the real thing"
        body="When an application reaches the interview stage, your coach builds a prep pack from the posting and your CV, then runs a mock interview with you."
        phase="Coming in Phase 4"
      />
    </>
  );
}
