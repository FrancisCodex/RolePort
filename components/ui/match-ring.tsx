import { cn } from "@/lib/utils";

/** Circular match score (0–100), the signature element on job cards. */
/** `muted` greys the ring out, e.g. for a job a gate or deal-breaker ruled out. */
export function MatchRing({
  score,
  size = 56,
  muted = false,
  className,
}: {
  score: number;
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const stroke = Math.max(2.5, Math.round(size / 16));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = muted ? "var(--subtle)" : score >= 75 ? "var(--success)" : score >= 50 ? "var(--brand)" : "var(--warning)";

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
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
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-[var(--ease-snappy)]"
        />
      </svg>
      <span className={cn("absolute font-semibold tracking-tight tabular-nums", muted && "text-subtle")} style={{ fontSize: Math.max(11, size / 4.2) }}>
        {score}
        <span className="sr-only">% match</span>
      </span>
    </div>
  );
}
