"use client";

import { Building2, ChevronRight, ExternalLink, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { followCompany, unfollowCompany } from "@/lib/client/mutations";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { companyJobsHref } from "@/lib/companies/links";

// Real companies on different hiring services, so a first-timer can see it work in one click.
const EXAMPLES = [
  { name: "Hugging Face", url: "https://apply.workable.com/huggingface" },
  { name: "Palantir", url: "https://jobs.lever.co/palantir" },
  { name: "bunq", url: "https://bunq.recruitee.com" },
];

const STEPS = [
  <>Go to the company&apos;s website and open its <strong className="font-medium text-fg">Careers</strong> or <strong className="font-medium text-fg">Jobs</strong> page, the one that lists its open positions.</>,
  <>Copy the link from your browser&apos;s address bar and paste it below.</>,
  <>Search as usual. That company&apos;s openings that match your search show up in your results, marked <strong className="font-medium text-fg">From the company</strong>. To see all of a company&apos;s jobs at once, click its name above your results.</>,
];

/**
 * Following companies, explained for someone doing it the first time: what it does, how to find
 * the right link, the form, and the companies already followed. Used on Jobs (in a dialog) and in Settings.
 */
export function CompanyManager({ companies, onNavigate }: { companies: FollowedCompanyView[]; onNavigate?: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string; companyId?: string } | null>(null);
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await followCompany({ url, name: name || undefined });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      const { id, name: added, openJobs } = result.data;
      setMessage({
        ok: true,
        companyId: openJobs > 0 ? id : undefined,
        text:
          openJobs > 0
            ? `You're following ${added}. They have ${openJobs} open job${openJobs === 1 ? "" : "s"} right now; the ones that match your searches will show up in your results.`
            : `You're following ${added}. They have no open jobs right now; new ones will show up in your searches when they post them.`,
      });
      setUrl("");
      setName("");
    });
  }

  function remove(id: string) {
    setRemoving(id);
    setMessage(null);
    start(async () => {
      const result = await unfollowCompany({ id });
      if (!result.ok) setMessage({ ok: false, text: result.error });
      setRemoving(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-muted">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={add} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="careers-url">Link to the company&apos;s careers page</Label>
          <Input
            id="careers-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://careers.example.com"
          />
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            Try one:
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => {
                  setUrl(ex.url);
                  setMessage(null);
                }}
                className="rounded-md border border-border px-1.5 py-0.5 font-medium text-muted hover:border-border-strong hover:text-fg"
              >
                {ex.name}
              </button>
            ))}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company-name">Company name (optional)</Label>
          <Input id="company-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Leave empty and RolePort fills it in" />
        </div>
        {message && (
          <p
            role="status"
            className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}
          >
            {message.text}
            {message.companyId && (
              <>
                {" "}
                <Link href={companyJobsHref(message.companyId)} onClick={onNavigate} className="underline underline-offset-2 hover:no-underline">
                  See all their jobs
                </Link>
              </>
            )}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending && !removing ? <Loader2 className="animate-spin" /> : <Plus />}
            {pending && !removing ? "Checking the page…" : "Follow company"}
          </Button>
        </div>
      </form>

      <details className="group rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-fg">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          Which companies can I follow?
        </summary>
        <div className="mt-2 flex flex-col gap-2 leading-relaxed">
          <p>
            Many companies post their jobs through a hiring service. RolePort can read the six most common ones: Greenhouse, Lever, Ashby,
            SmartRecruiters, Workable and Recruitee. You don&apos;t need to know which one a company uses: paste the link and RolePort checks.
          </p>
          <p>
            If RolePort says it can&apos;t read the page, open one of the company&apos;s job postings and paste that link instead. It often
            points straight to the hiring service.
          </p>
          <p>
            Only openings that fit your search show up: the job title or skill, the country (or remote) and the work setup. A company with no
            openings in the country you search won&apos;t show anything there.
          </p>
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">
          {companies.length ? `You follow ${companies.length} compan${companies.length === 1 ? "y" : "ies"}` : "You don't follow any companies yet."}
        </p>
        {companies.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <Building2 className="size-4 shrink-0 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                  <p className="text-xs text-subtle">Jobs read from {c.boardLabel}</p>
                </div>
                <Link
                  href={companyJobsHref(c.id)}
                  onClick={onNavigate}
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-ink hover:bg-surface-3"
                >
                  See jobs
                </Link>
                {c.careersUrl && (
                  <a
                    href={c.careersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${c.name}'s careers page`}
                    className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-fg"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={pending} aria-label={`Stop following ${c.name}`}>
                  {removing === c.id ? <Loader2 className="animate-spin" /> : <X />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
