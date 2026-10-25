import { Check, Clock, ExternalLink, Layers, MapPin, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ApplyButton } from "@/components/jobs/apply-button";
import { ExpandableDescription } from "@/components/jobs/expandable-description";
import { FitEvaluation } from "@/components/jobs/fit-evaluation";
import { CompanyLogo } from "@/components/jobs/job-card";
import { SaveButton } from "@/components/jobs/save-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchRing } from "@/components/ui/match-ring";
import type { JobListItem } from "@/lib/jobs/data";
import { EMPLOYMENT_LABEL, formatSalary, timeAgo, WORK_SETUP_LABEL } from "@/lib/jobs/format";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import { cn } from "@/lib/utils";

/**
 * Everything about one job: the full page lays it out in two columns, the panel
 * beside the results stacks it in one, with the fit evaluation near the top.
 */
export type SourceCredit = { name: string; url: string };

export function JobDetailView({
  job,
  aiEnabled,
  variant = "page",
  source,
  actions,
  aside,
  lead,
  asideEnd,
  descriptionPreview = false,
}: {
  job: JobListItem;
  aiEnabled: boolean;
  variant?: "page" | "panel";
  /** Credit line for the job source. Passed in (not looked up) so this also renders in the browser. */
  source: SourceCredit | null;
  /** Replaces the Apply and Save buttons under the title. */
  actions?: ReactNode;
  /** Page variant: shown above the quick match in the side column. */
  aside?: ReactNode;
  /** Shown right under the title card, above the evaluation and the posting's details. */
  lead?: ReactNode;
  /** Page variant: shown at the bottom of the side column, under the quick match. */
  asideEnd?: ReactNode;
  /** Show the description in the title card as a short preview with "Show more" (the posting is a reference there, not the task). */
  descriptionPreview?: boolean;
}) {
  const panel = variant === "panel";
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const posted = timeAgo(job.postedAt);
  const required = job.extras.requirements.filter((r) => r.priority === "required");
  const preferred = job.extras.requirements.filter((r) => r.priority === "preferred");

  const quickMatch = <QuickMatchCard job={job} aiEnabled={aiEnabled} />;

  return (
    <div className={cn("grid gap-3", !panel && "lg:grid-cols-[1fr_20rem]")}>
      {/* With a side column of its own, small screens show it right under the title card, above the long description. */}
      <div className={cn("flex min-w-0 flex-col gap-3", aside && "max-lg:contents")}>
        <Card className={cn(aside && "max-lg:-order-1")}>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <CompanyLogo src={job.companyLogo} company={job.company} size="size-11" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight text-balance">{job.title}</h1>
                <p className="text-[13px] text-muted">{job.company}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {job.location && (
                <span className="flex items-center gap-1 text-muted">
                  <MapPin className="size-3.5" /> {job.location}
                </span>
              )}
              {job.workSetup && <Badge tone="brand">{WORK_SETUP_LABEL[job.workSetup]}</Badge>}
              {job.employmentType && <Badge>{EMPLOYMENT_LABEL[job.employmentType]}</Badge>}
              {salary && <Badge tone="success">{salary}</Badge>}
              {posted && (
                <span className="flex items-center gap-1 text-subtle">
                  <Clock className="size-3.5" /> {posted}
                </span>
              )}
            </div>
            {job.extras.possiblyStale && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] font-medium text-warning">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                This posting may be old or reposted. Check that it&apos;s still open before applying.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {actions ?? (
                <>
                  <ApplyButton job={job} />
                  {(!job.application || job.application.status === "saved") && <SaveButton jobId={job.id} saved={job.saved} withLabel />}
                  <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants({ variant: "ghost" })}>
                    View posting <ExternalLink />
                  </a>
                </>
              )}
            </div>
            {job.extras.alsoOn.length > 0 && (
              <p className="-mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
                <Layers className="size-3.5" /> Also posted on
                {job.extras.alsoOn.map((link, i) => (
                  <span key={link.source}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-muted underline-offset-2 hover:text-fg hover:underline">
                      {sourceCredit(link.source)?.name ?? link.source}
                    </a>
                    {i < job.extras.alsoOn.length - 1 && ","}
                  </span>
                ))}
              </p>
            )}
            {descriptionPreview && job.description && <ExpandableDescription html={job.description} />}
          </CardContent>
        </Card>

        {lead && <div className={cn("flex flex-col gap-3", aside && "max-lg:-order-1")}>{lead}</div>}

        <FitEvaluation jobId={job.id} fit={job.fit} aiEnabled={aiEnabled} postedAt={job.postedAt} />

        {panel && quickMatch}

        {job.extras.summary && (
          <Card>
            <CardContent>
              <p className="text-xs font-medium text-muted">In short</p>
              <p className="mt-1.5 leading-relaxed">{job.extras.summary}</p>
            </CardContent>
          </Card>
        )}

        {(required.length > 0 || preferred.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RequirementList items={required.map((r) => r.text)} />
              {preferred.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted">Nice to have</p>
                  <RequirementList items={preferred.map((r) => r.text)} muted />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {job.description && !descriptionPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Full description</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Sanitized at ingest (lib/jobs/html.ts). */}
              <div className="job-description" dangerouslySetInnerHTML={{ __html: job.description }} />
            </CardContent>
          </Card>
        )}

        {source && (
          <p className="text-center text-xs text-subtle">
            Listing via{" "}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {source.name}
            </a>
          </p>
        )}
      </div>

      {!panel && (
        <aside className={cn("flex flex-col gap-3 lg:sticky lg:top-10 lg:self-start", aside && "max-lg:-order-1")}>
          {aside}
          {quickMatch}
          {asideEnd}
        </aside>
      )}
    </div>
  );
}

function QuickMatchCard({ job, aiEnabled }: { job: JobListItem; aiEnabled: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {job.match ? <MatchRing score={job.match.score} size={52} /> : null}
          <div>
            <p className="text-sm font-semibold">Quick match</p>
            <p className="text-[13px] text-muted">
              {job.match ? "Based on skill overlap with your profile." : "Add skills to your profile to see your match."}
            </p>
          </div>
        </div>
        {job.match && job.match.matched.length > 0 && <SkillList title="You have" skills={job.match.matched} tone="success" />}
        {job.match && job.match.missing.length > 0 && <SkillList title="They also want" skills={job.match.missing} />}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
          {aiEnabled ? (
            "A free estimate from skill overlap. The AI fit evaluation also weighs gates, experience and career fit. A tailored CV is coming next."
          ) : (
            <span>
              <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                Choose an AI provider
              </Link>{" "}
              (Claude, OpenAI or a free local model) to get a full fit evaluation.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RequirementList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((text) => (
        <li key={text} className={`flex gap-2.5 text-[13px] ${muted ? "text-muted" : ""}`}>
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle" />
          {text}
        </li>
      ))}
    </ul>
  );
}

function SkillList({ title, skills, tone }: { title: string; skills: string[]; tone?: "success" }) {
  const Icon = tone === "success" ? Check : X;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <Badge key={s} tone={tone ?? "neutral"} className="capitalize">
            <Icon /> {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}
