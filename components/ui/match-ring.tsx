import { cn } from "@/lib/utils";

/** Circular match score (0–100), the signature element on job cards. */
export function MatchRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const stroke = Math.max(4, Math.round(size / 11));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "var(--success)" : score >= 50 ? "var(--brand)" : "var(--warning)";

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute font-display text-sm font-bold tabular-nums" style={{ fontSize: size / 4 }}>
        {score}
        <span className="sr-only">% match</span>
      </span>
    </div>
  );
}
