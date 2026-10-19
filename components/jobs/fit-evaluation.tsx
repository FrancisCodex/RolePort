import { Ban, Check, CircleHelp, Flame, Info, Sparkles, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MatchRing } from "@/components/ui/match-ring";
import type { FitMatch } from "@/lib/jobs/evaluation";
import { daysSince, daysUntil, FIT_BANDS, FIT_WEIGHTS, fitBand, vetoReason, type GateVerdict } from "@/lib/jobs/fit";
import { timeAgo } from "@/lib/jobs/format";
import { cn } from "@/lib/utils";
import { EvaluateButton } from "./evaluate-button";

const GATE_STYLE: Record<GateVerdict, { label: string; icon: LucideIcon; tone: "success" | "warning" | "danger" | "neutral"; tile: string }> = {
  pass: { label: "Pass", icon: Check, tone: "success", tile: "bg-success-soft text-success" },
  flag: { label: "Check", icon: TriangleAlert, tone: "warning", tile: "bg-warning-soft text-warning" },
  unverified: { label: "Unverified", icon: CircleHelp, tone: "warning", tile: "bg-warning-soft text-warning" },
  fail: { label: "Fail", icon: X, tone: "danger", tile: "bg-danger-soft text-danger" },
};

const DIMENSIONS = [
  { key: "skillsScore", label: "Technical skills", weight: FIT_WEIGHTS.skills },
  { key: "experienceScore", label: "Experience", weight: FIT_WEIGHTS.experience },
  { key: "cultureScore", label: "Culture fit", weight: FIT_WEIGHTS.culture },
  { key: "careerScore", label: "Career alignment", weight: FIT_WEIGHTS.career },
] as const;

/** The AI fit evaluation card on the job page: a call to action until the first run, then the full result. */
export function FitEvaluation({
  jobId,
  fit,
  aiEnabled,
  postedAt,
}: {
  jobId: string;
  fit: FitMatch | null;
  aiEnabled: boolean;
  postedAt: Date | null;
}) {
  if (!fit) {
    return (
      <Card className="@container overflow-hidden">
        <CardContent className="flex flex-col gap-4 bg-gradient-to-br from-brand-soft/70 to-transparent @xl:flex-row @xl:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-fg shadow-[var(--shadow-press)]">
            <Sparkles className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">AI fit evaluation</p>
            <p className="text-sm text-muted">
              Checks eligibility, language and location first, then scores skills, experience, culture and career fit, with an
              honest list of gaps.
            </p>
          </div>
          {aiEnabled ? (
            <div className="shrink-0 @xl:max-w-56">
              <EvaluateButton jobId={jobId} />
            </div>
          ) : (
            <Link
              href="/settings"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-[15px] font-semibold text-brand-fg shadow-[var(--shadow-press)] hover:bg-brand-hover"
            >
              Choose an AI provider
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  const overall = fit.overallScore ?? 0;
  const band = FIT_BANDS[fitBand(overall)];
  const veto = vetoReason(fit);
  const days = daysUntil(fit.deadline);
  const postedDays = daysSince(postedAt);
  const scored = timeAgo(fit.scoredAt);

  return (
    <Card className="@container">
      <CardContent className="flex flex-col gap-6">
        {/* Verdict */}
        <div className="flex flex-wrap items-center gap-4">
          <MatchRing score={overall} size={76} muted={Boolean(veto)} />
          <div className="min-w-44 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-bold tracking-tight">{veto ? "Not a match" : band.label}</p>
              <Badge tone="brand">
                <Sparkles /> AI
              </Badge>
            </div>
            <p className="text-sm text-muted">{veto ? "A gate or deal-breaker rules this one out." : band.advice}</p>
            <p className="mt-1 text-xs text-subtle">
              {fit.model}
              {scored ? ` · ${scored.toLowerCase()}` : ""}
            </p>
          </div>
          {aiEnabled && <EvaluateButton jobId={jobId} again />}
        </div>

        {/* Vetoes and time flags */}
        {(veto || (days !== null && days >= 0 && days <= 7) || (postedDays !== null && postedDays > 30)) && (
          <div className="flex flex-col gap-2">
            {veto && (
              <Notice tone="danger" icon={Ban}>
                <strong>Excluded:</strong> {veto}. Deal-breakers outrank a high score.
              </Notice>
            )}
            {days !== null && days >= 0 && days <= 7 && (
              <Notice tone="warning" icon={Flame}>
                {days === 0 ? "Applications close today" : `Applications close in ${days} day${days === 1 ? "" : "s"}`} ({fit.deadline}).
              </Notice>
            )}
            {postedDays !== null && postedDays > 30 && (
              <Notice tone="warning" icon={TriangleAlert}>
                Posted {Math.floor(postedDays / 30) >= 2 ? `${Math.floor(postedDays / 30)} months` : `${postedDays} days`} ago. It may
                still be open, but check before you apply.
              </Notice>
            )}
          </div>
        )}

        {/* Gates */}
        <section>
          <SectionLabel>Gates</SectionLabel>
          <div className="grid gap-2 @2xl:grid-cols-3">
            <Gate label="Eligibility" verdict={fit.eligibilityGate} note={fit.eligibilityNote} />
            <Gate label="Language" verdict={fit.languageGate} note={fit.languageNote} />
            <Gate label="Location" verdict={fit.locationGate} note={fit.locationNote} />
          </div>
          {fit.gateNote && (
            <div className="mt-2">
              <Notice tone="danger" icon={Ban}>
                <strong>Deal-breaker:</strong> {fit.gateNote}
              </Notice>
            </div>
          )}
        </section>

        {/* Dimensions */}
        <section>
          <SectionLabel>Scores</SectionLabel>
          <div className="grid gap-x-8 gap-y-3 @lg:grid-cols-2">
            {DIMENSIONS.map((d) => (
              <ScoreBar key={d.key} label={d.label} weight={d.weight} score={fit[d.key] ?? 0} />
            ))}
          </div>
        </section>

        {/* Strengths and gaps */}
        {(fit.strengths.length > 0 || fit.gaps.length > 0) && (
          <div className="grid gap-5 @xl:grid-cols-2">
            <BulletList title="Your strengths" items={fit.strengths} icon={Check} tone="success" />
            <BulletList title="Gaps to address" items={fit.gaps} icon={X} tone="danger" />
          </div>
        )}

        {(fit.summary || fit.recommendation) && (
          <div className="rounded-2xl bg-brand-soft px-4 py-3.5 text-brand-ink">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="size-3.5" /> Recommendation
            </p>
            {fit.summary && <p className="mt-1.5 text-[15px] font-medium">{fit.summary}</p>}
            {fit.recommendation && <p className="mt-1 text-sm opacity-90">{fit.recommendation}</p>}
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs text-subtle">
          <Info className="mt-px size-3.5 shrink-0" />
          A triage from the posting text and your profile only. Check the company and the full posting before you apply.
        </p>
      </CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-xs font-semibold tracking-wider text-subtle uppercase">{children}</p>;
}

function Gate({ label, verdict, note }: { label: string; verdict: GateVerdict; note: string | null }) {
  const style = GATE_STYLE[verdict];
  const Icon = style.icon;
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg", style.tile)}>
          <Icon className="size-3.5" strokeWidth={3} />
        </span>
        <span className="text-sm font-semibold">{label}</span>
        <Badge tone={style.tone} className="ml-auto">
          {style.label}
        </Badge>
      </div>
      {note && <p className="text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

function ScoreBar({ label, weight, score }: { label: string; weight: number; score: number }) {
  const color = score >= 75 ? "bg-success" : score >= 50 ? "bg-brand" : "bg-warning";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {label} <span className="text-xs text-subtle">· {Math.round(weight * 100)}%</span>
        </span>
        <span className="font-display font-bold tabular-nums">{score}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={label}>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function BulletList({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: LucideIcon; tone: "success" | "danger" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-snug">
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
              )}
            >
              <Icon className="size-3" strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ tone, icon: Icon, children }: { tone: "warning" | "danger"; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
