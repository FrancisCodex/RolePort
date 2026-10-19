"use client";

import { useTransition } from "react";
import { setApplicationStatus } from "@/app/(app)/jobs/actions";
import { cn } from "@/lib/utils";

export const STATUS_LABEL = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired 🎉",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  offer_declined: "Offer declined",
  ghosted: "No response",
} as const;

export type Status = keyof typeof STATUS_LABEL;

export function StatusSelect({ applicationId, status }: { applicationId: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Application status"
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => setApplicationStatus(applicationId, e.target.value as Status))}
      className={cn(
        "w-full rounded-xl border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted outline-none focus:border-brand",
        pending && "opacity-60",
      )}
    >
      {Object.entries(STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
