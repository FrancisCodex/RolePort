"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleSavedJob } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveButton({ jobId, saved, withLabel = false }: { jobId: string; saved: boolean; withLabel?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimistic(!optimistic);
      await toggleSavedJob(jobId);
    });
  }

  const Icon = optimistic ? BookmarkCheck : Bookmark;
  return withLabel ? (
    <Button variant={optimistic ? "soft" : "secondary"} onClick={onClick} aria-pressed={optimistic}>
      <Icon />
      {optimistic ? "Saved" : "Save job"}
    </Button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from saved" : "Save job"}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
        optimistic ? "bg-brand-soft text-brand" : "text-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Bookmark className="size-5" fill={optimistic ? "currentColor" : "none"} />
    </button>
  );
}
