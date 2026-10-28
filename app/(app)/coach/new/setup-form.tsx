"use client";

import { Briefcase, Flame, Loader2, Play, Target, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { startInterview } from "@/lib/client/mutations";
import {
  FOCUS_INFO,
  INTERVIEW_FOCUSES,
  INTERVIEW_LENGTHS,
  INTERVIEW_STYLES,
  MAX_JOB_DESCRIPTION,
  MAX_ROLE,
  panelFor,
  STYLE_INFO,
  type InterviewFocus,
  type InterviewLength,
  type InterviewSetupData,
  type InterviewStyle,
} from "@/lib/interview/types";
import { cn } from "@/lib/utils";

type Source = "application" | "role";

/**
 * What to practise: a job the user applied to (its posting and the documents they sent), or a
 * role on its own with an optional job description. Then the kind of interview and its length.
 */
export function SetupForm({ data }: { data: InterviewSetupData }) {
  const router = useRouter();
  const hasApplications = data.applications.length > 0;
  const [source, setSource] = useState<Source>(data.selectedApplicationId ? "application" : "role");
  const [applicationId, setApplicationId] = useState(data.selectedApplicationId ?? data.applications[0]?.id ?? "");
  const [targetRole, setTargetRole] = useState(data.suggestedRole);
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [focus, setFocus] = useState<InterviewFocus>(data.selectedApplicationId ? "posting" : "behavioral");
  const [length, setLength] = useState<InterviewLength>("quick");
  const [style, setStyle] = useState<InterviewStyle>("standard");
  const [panel, setPanel] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const application = data.applications.find((a) => a.id === applicationId) ?? null;
  const fromApplication = source === "application" && application !== null;
  // A posting-based round needs a posting: the application's, or one pasted in.
  const focuses = INTERVIEW_FOCUSES.filter((f) => f !== "posting" || !fromApplication || application.hasPosting);
  const chosenFocus = focuses.includes(focus) ? focus : "behavioral";

  if (data.profileEmpty) {
    return (
      <EmptyState
        icon={UserRound}
        title="Your profile is empty"
        body="The interviewer asks about your real experience, so it needs your profile first. Import your CV or fill in your profile."
        action={
          <Link href="/profile" className={buttonVariants()}>
            Go to your profile
          </Link>
        }
      />
    );
  }

  async function start() {
    setWorking(true);
    setError(null);
    setNeedsSetup(false);
    const result = await startInterview({
      applicationId: fromApplication ? application.id : null,
      targetRole: fromApplication ? "" : targetRole,
      company: fromApplication ? "" : company,
      jobDescription: fromApplication ? "" : jobDescription,
      focus: chosenFocus,
      length,
      style,
      panel,
      drill: null,
    });
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      setNeedsSetup(Boolean(result.needsSetup));
      return;
    }
    router.push(`/coach/${result.data}`);
  }

  const focusLabel = (f: InterviewFocus) => (f === "posting" && !fromApplication ? "Ad-hoc job posting" : FOCUS_INFO[f].label);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle>What are you practising for?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice
                icon={Briefcase}
                active={source === "application"}
                disabled={!hasApplications}
                title="A job I applied to"
                body={hasApplications ? "Uses the posting and the CV, letter and answers you sent." : "Apply to a job first to practise for it."}
                onClick={() => setSource("application")}
              />
              <Choice
                icon={Target}
                active={source === "role"}
                title="A role"
                body="Any job title, with a job description if you have one."
                onClick={() => setSource("role")}
              />
            </div>

            {source === "application" && hasApplications ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="application">Application</Label>
                <Select
                  id="application"
                  value={applicationId}
                  onValueChange={setApplicationId}
                  searchable
                  options={data.applications.map((a) => ({ value: a.id, label: `${a.role} · ${a.company}` }))}
                />
                {application && (
                  <p className="text-xs text-muted">
                    The interviewer reads {application.hasPosting ? "the posting" : "the role and company (the posting isn't stored anymore)"}
                    {application.documents.length ? ` and your ${application.documents.join(", ").toLowerCase()}` : " and your profile"}.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="role">Target role</Label>
                    <Input id="role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={MAX_ROLE} placeholder="e.g. Frontend Developer" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company">
                      Company <span className="font-normal text-subtle">(optional)</span>
                    </Label>
                    <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={MAX_ROLE} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd">
                    Job description <span className="font-normal text-subtle">{chosenFocus === "posting" ? "(needed for this focus)" : "(optional)"}</span>
                  </Label>
                  <Textarea
                    id="jd"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    maxLength={MAX_JOB_DESCRIPTION}
                    placeholder="Paste the posting to get questions about its requirements."
                    className="min-h-32 text-[13px]"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Focus</CardTitle>
            <CardDescription>The kind of interview to practise.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {focuses.map((f) => (
              <Choice key={f} active={chosenFocus === f} title={focusLabel(f)} body={FOCUS_INFO[f].description} onClick={() => setFocus(f)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interviewer</CardTitle>
            <CardDescription>How hard they push. The report grades every style on the same rubric.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {INTERVIEW_STYLES.map((s) => (
              <Choice
                key={s}
                icon={s === "hell" ? Flame : undefined}
                active={style === s}
                title={STYLE_INFO[s].label}
                body={STYLE_INFO[s].description}
                onClick={() => setStyle(s)}
                danger={s === "hell"}
              />
            ))}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 sm:col-span-2">
              <input type="checkbox" checked={panel} onChange={(e) => setPanel(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Users className="size-3.5" /> Panel interview
                </span>
                <span className="text-xs text-muted">
                  Two interviewers take turns:{" "}
                  {panelFor(chosenFocus)
                    .map((p) => `the ${p.role.toLowerCase()} (${p.focus})`)
                    .join(" and ")}
                  .
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Length</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(INTERVIEW_LENGTHS) as InterviewLength[]).map((l) => (
                <Choice
                  key={l}
                  active={length === l}
                  title={INTERVIEW_LENGTHS[l].label}
                  body={`${INTERVIEW_LENGTHS[l].questions} questions, ${INTERVIEW_LENGTHS[l].time}`}
                  onClick={() => setLength(l)}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-1 text-xs text-muted">
              <li>One question at a time, like a real interview.</li>
              <li>
                Up to {STYLE_INFO[style].followUps} follow-up{STYLE_INFO[style].followUps > 1 ? "s" : ""} per question when an answer is vague.
              </li>
              <li>No scores until the end, then a graded report.</li>
            </ul>
            {!data.aiEnabled ? (
              <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                The interviewer is an AI model.{" "}
                <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                  Choose an AI provider
                </Link>{" "}
                to start.
              </p>
            ) : (
              <Button size="lg" onClick={() => void start()} disabled={working}>
                {working ? <Loader2 className="animate-spin" /> : <Play />}
                {working ? "Preparing questions…" : "Start interview"}
              </Button>
            )}
            {working && <p className="text-xs text-muted">Local models can take a minute or two to plan. Keep this page open.</p>}
            {error && (
              <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                {error}{" "}
                {needsSetup && (
                  <Link href="/settings" className="font-medium underline">
                    Open Settings
                  </Link>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Choice({
  icon: Icon,
  active,
  disabled,
  title,
  body,
  onClick,
  danger,
}: {
  icon?: typeof Briefcase;
  active: boolean;
  disabled?: boolean;
  title: string;
  body: string;
  onClick: () => void;
  /** The "from Hell" choice, marked in the danger colour when picked. */
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? (danger ? "border-danger/50 bg-danger-soft" : "border-brand/50 bg-brand-soft") : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", active && (danger ? "text-danger" : "text-brand-ink"))}>
        {Icon && <Icon className="size-3.5" />} {title}
      </span>
      <span className="text-xs text-muted">{body}</span>
    </button>
  );
}
