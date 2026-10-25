import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { getMyApplications } from "@/lib/jobs/data";
import { isLite } from "@/lib/mode";
import { AppliedList } from "./applied-list";
import { LiteApplied } from "./lite-applied";
import { toAppliedItems } from "./view-data";

export const metadata: Metadata = { title: "Applied jobs" };

export default function AppliedPage() {
  return (
    <>
      <PageHeader
        title="Applied jobs"
        description="Jobs you applied to or saved. Open one to see the posting, track its progress and prepare your application."
      />
      {isLite ? (
        <LiteApplied />
      ) : (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
          <List />
        </Suspense>
      )}
    </>
  );
}

async function List() {
  return <AppliedList items={toAppliedItems(await getMyApplications())} />;
}
