"use client";

import { useTransition } from "react";
import { setApplicationStatus } from "@/app/(app)/jobs/actions";
import { Select } from "@/components/ui/select";
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

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

export function StatusSelect({ applicationId, status }: { applicationId: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      size="sm"
      aria-label="Application status"
      value={status}
      disabled={pending}
      options={STATUS_OPTIONS}
      onValueChange={(next) => startTransition(() => setApplicationStatus(applicationId, next as Status))}
      className={cn(pending && "opacity-60")}
    />
  );
}
