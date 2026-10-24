"use client";

import { LiteData } from "@/components/app/lite-data";
import { AppliedList } from "./applied-list";

/** Applied jobs in the lite edition: loaded from the browser database. */
export function LiteApplied() {
  return (
    <LiteData load={(q) => q.loadApplied()} tables={["application", "job"]} fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
      {(items) => <AppliedList items={items} />}
    </LiteData>
  );
}
