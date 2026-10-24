"use client";

import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

/** On Settings opened from the welcome guide (?from=welcome): a way back to where the user left off. */
export function BackToGuide() {
  if (useSearchParams().get("from") !== "welcome") return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-center gap-2 text-[13px] font-medium text-brand-ink">
        <Compass className="size-3.5 shrink-0" /> Set up your AI provider below, then pick up the setup guide where you left off.
      </p>
      <Link href="/welcome" className={buttonVariants({ size: "sm" })}>
        Continue the setup guide <ArrowRight />
      </Link>
    </div>
  );
}
