"use client";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

export const STATUS_LABEL = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  offer_declined: "Offer declined",
  ghosted: "No response",
} as const;

export type Status = keyof typeof STATUS_LABEL;

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

export function StatusSelect({ status, onChange }: { status: Status; onChange: (status: Status) => void }) {
  return (
    <Select
      size="sm"
      aria-label="Application status"
      value={status}
      options={STATUS_OPTIONS}
      onValueChange={(next) => onChange(next as Status)}
    />
  );
}

export const STATUS_TONE: Record<Status, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  saved: "neutral",
  applied: "brand",
  screening: "brand",
  interview: "warning",
  offer: "success",
  hired: "success",
  rejected: "danger",
  withdrawn: "neutral",
  offer_declined: "neutral",
  ghosted: "neutral",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
