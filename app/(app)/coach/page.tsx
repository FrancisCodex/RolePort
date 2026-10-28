import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMyInterviews } from "@/lib/interview/data";
import { isLite } from "@/lib/mode";
import { InterviewList } from "./interview-list";
import { LiteCoach } from "./lite-coach";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  return (
    <>
      <PageHeader
        title="Interview Coach"
        description="Mock interviews for the jobs you applied to, or any role. One question at a time, then a graded report."
        action={
          <Link href="/coach/new" className={buttonVariants()}>
            <Plus /> New mock interview
          </Link>
        }
      />
      {isLite ? (
        <LiteCoach />
      ) : (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
          <List />
        </Suspense>
      )}
    </>
  );
}

async function List() {
  return <InterviewList items={await getMyInterviews()} />;
}
