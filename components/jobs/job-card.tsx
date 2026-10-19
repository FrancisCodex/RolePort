import { Briefcase, Flame, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MatchRing } from "@/components/ui/match-ring";
import type { JobListItem } from "@/lib/jobs/data";
import { daysUntil, vetoReason } from "@/lib/jobs/fit";
import { formatSalary, timeAgo, WORK_SETUP_LABEL } from "@/lib/jobs/format";
import { AiScore } from "./ai-score";
import { ScoreSlot, SelectableJob } from "./analyze-jobs";
import { SaveButton } from "./save-button";

export function CompanyLogo({ src, company, size = "size-12" }: { src: string | null; company: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- logos come from many third-party hosts
    <img src={src} alt="" className={`${size} shrink-0 rounded-2xl border border-border bg-white object-contain p-1`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-2xl bg-surface-2 font-display text-lg font-bold text-muted`}>
      {company.trim()[0]?.toUpperCase() ?? <Briefcase className="size-5" />}
    </span>
  );
}

export function JobCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const posted = timeAgo(job.postedAt);
  const fit = job.fit;
  const veto = fit ? vetoReason(fit) : null;
  const flagged = fit && !veto && [fit.eligibilityGate, fit.languageGate, fit.locationGate].some((g) => g === "flag" || g === "unverified");
  const closesIn = fit ? daysUntil(fit.deadline) : null;

  return (
    <SelectableJob id={job.id}>
      <Link
        href={`/jobs/${job.id}`}
        className="group flex gap-4 rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-5"
      >
        <CompanyLogo src={job.companyLogo} company={job.company} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug group-hover:text-brand">{job.title}</h3>
          <p className="truncate text-sm text-muted">{job.company}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
            {job.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{job.location}</span>
              </span>
            )}
            {job.workSetup && <Badge tone="brand">{WORK_SETUP_LABEL[job.workSetup]}</Badge>}
            {salary && <Badge tone="success">{salary}</Badge>}
            {posted && <span>{posted}</span>}
            {job.extras.possiblyStale && <Badge tone="warning">May be old</Badge>}
            {veto && (
              <Badge tone="danger" title={veto}>
                Excluded
              </Badge>
            )}
            {flagged && <Badge tone="warning">Needs a check</Badge>}
            {closesIn !== null && closesIn >= 0 && closesIn <= 7 && (
              <Badge tone="warning">
                <Flame /> Closes in {closesIn}d
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-between gap-2">
          <ScoreSlot id={job.id}>
            {fit ? (
              <AiScore score={fit.overallScore ?? 0} veto={veto} />
            ) : job.match ? (
              <MatchRing score={job.match.score} size={48} />
            ) : (
              <span className="size-12" />
            )}
          </ScoreSlot>
          <SaveButton jobId={job.id} saved={job.saved} />
        </div>
      </Link>
    </SelectableJob>
  );
}
