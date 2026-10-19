import { Check, Clock, ExternalLink, MapPin, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { FitEvaluation } from "@/components/jobs/fit-evaluation";
import { CompanyLogo } from "@/components/jobs/job-card";
import { SaveButton } from "@/components/jobs/save-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchRing } from "@/components/ui/match-ring";
import type { JobListItem } from "@/lib/jobs/data";
import { EMPLOYMENT_LABEL, formatSalary, timeAgo, WORK_SETUP_LABEL } from "@/lib/jobs/format";
import { JOB_SOURCES } from "@/lib/jobs/search";
import { cn } from "@/lib/utils";

/**
 * Everything about one job: the full page lays it out in two columns, the panel
 * beside the results stacks it in one, with the fit evaluation near the top.
 */
export function JobDetailView({
  job,
  aiEnabled,
  variant = "page",
}: {
  job: JobListItem;
  aiEnabled: boolean;
  variant?: "page" | "panel";
}) {
  const panel = variant === "panel";
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const posted = timeAgo(job.postedAt);
  const source = JOB_SOURCES.find((s) => s.id === job.source);
  const required = job.extras.requirements.filter((r) => r.priority === "required");
  const preferred = job.extras.requirements.filter((r) => r.priority === "preferred");

  const quickMatch = <QuickMatchCard job={job} aiEnabled={aiEnabled} />;

  return (
    <div className={cn("grid gap-4", !panel && "lg:grid-cols-[1fr_20rem]")}>
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <CompanyLogo src={job.companyLogo} company={job.company} size="size-14" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-bold tracking-tight text-balance">{job.title}</h1>
                <p className="text-muted">{job.company}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {job.location && (
                <span className="flex items-center gap-1 text-muted">
                  <MapPin className="size-4" /> {job.location}
                </span>
              )}
              {job.workSetup && <Badge tone="brand">{WORK_SETUP_LABEL[job.workSetup]}</Badge>}
              {job.employmentType && <Badge>{EMPLOYMENT_LABEL[job.employmentType]}</Badge>}
              {salary && <Badge tone="success">{salary}</Badge>}
              {posted && (
                <span className="flex items-center gap-1 text-subtle">
                  <Clock className="size-4" /> {posted}
                </span>
              )}
            </div>
            {job.extras.possiblyStale && (
              <p className="flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                This posting may be old or reposted. Check that it&apos;s still open before applying.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants()}>
                Apply on company site <ExternalLink />
              </a>
              <SaveButton jobId={job.id} saved={job.saved} withLabel />
            </div>
          </CardContent>
        </Card>

        <FitEvaluation jobId={job.id} fit={job.fit} aiEnabled={aiEnabled} postedAt={job.postedAt} />

        {panel && quickMatch}

        {job.extras.summary && (
          <Card>
            <CardContent>
              <p className="text-xs font-semibold tracking-wider text-subtle uppercase">In short</p>
              <p className="mt-2 leading-relaxed">{job.extras.summary}</p>
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
                  <p className="text-sm font-semibold text-muted">Nice to have</p>
                  <RequirementList items={preferred.map((r) => r.text)} muted />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {job.description && (
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
            <a href={source.attribution.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {source.attribution.name}
            </a>
          </p>
        )}
      </div>

      {!panel && <aside className="flex flex-col gap-4 lg:sticky lg:top-10 lg:self-start">{quickMatch}</aside>}
    </div>
  );
}

function QuickMatchCard({ job, aiEnabled }: { job: JobListItem; aiEnabled: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {job.match ? <MatchRing score={job.match.score} size={64} /> : null}
          <div>
            <p className="font-display text-lg font-semibold">Quick match</p>
            <p className="text-sm text-muted">
              {job.match ? "Based on skill overlap with your profile." : "Add skills to your profile to see your match."}
            </p>
          </div>
        </div>
        {job.match && job.match.matched.length > 0 && <SkillList title="You have" skills={job.match.matched} tone="success" />}
        {job.match && job.match.missing.length > 0 && <SkillList title="They also want" skills={job.match.missing} />}
        <div className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-muted">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
          {aiEnabled ? (
            "A free estimate from skill overlap. The AI fit evaluation also weighs gates, experience and career fit. A tailored CV is coming next."
          ) : (
            <span>
              <Link href="/settings" className="font-semibold text-brand hover:underline">
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
        <li key={text} className={`flex gap-2.5 text-[15px] ${muted ? "text-muted" : ""}`}>
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
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
      <p className="mb-2 text-xs font-semibold tracking-wider text-subtle uppercase">{title}</p>
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
