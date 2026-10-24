import { Sparkles } from "lucide-react";
import { MatchRing } from "@/components/ui/match-ring";
import { cn } from "@/lib/utils";

/** A job card's AI fit score: the match ring with a small "AI" marker, greyed out when a gate vetoed the job. */
export function AiScore({ score, veto, className }: { score: number; veto: string | null; className?: string }) {
  return (
    <span className={cn("relative", className)} title={veto ?? "AI fit evaluation"}>
      <MatchRing score={score} size={40} muted={Boolean(veto)} />
      <span className="absolute -right-2 -bottom-1 flex items-center gap-0.5 rounded-sm bg-brand px-1 text-[9px] leading-[14px] font-semibold text-brand-fg ring-2 ring-surface">
        <Sparkles className="size-2.5" /> AI
      </span>
    </span>
  );
}
