"use client";

import { CircleCheck, Download, ExternalLink, Loader2, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { megabytes, useAppUpdate } from "@/components/app/use-app-update";
import type { AppUpdate } from "@/lib/desktop/updates";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/repo";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

/**
 * Desktop app: which version this is, checking for a newer one, its release notes, and
 * downloading and installing it, all from Settings. Nothing downloads until the user clicks.
 */
export function AboutUpdates({ initial }: { initial: AppUpdate }) {
  const { update: live, busy, error, installing, check, download, install, setAutoCheck } = useAppUpdate(initial);
  const update = live ?? initial;
  const { status, latest, progress } = update;
  const hasNew = latest !== null && (status === "available" || status === "downloading" || status === "ready");

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            RolePort {update.current} <span className="font-normal text-muted">for Windows</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted">
            {status === "checking" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Checking for updates…
              </>
            ) : hasNew ? (
              <>
                <Badge tone="brand">New</Badge> Version {latest.version} is available.
              </>
            ) : status === "up-to-date" ? (
              <>
                <CircleCheck className="size-3.5 text-success" /> You have the latest version.
              </>
            ) : !update.supported ? (
              "Updates work in the installed app, not when running RolePort from its source code."
            ) : (
              "Check to see if there's a newer version."
            )}
          </p>
          {update.lastChecked && <p className="mt-0.5 text-xs text-subtle">Last checked {when(update.lastChecked)}</p>}
        </div>
        {!hasNew && (
          <Button variant="secondary" onClick={() => void check()} disabled={!update.supported || busy !== null || status === "checking"}>
            {status === "checking" || busy === "check" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check for updates
          </Button>
        )}
      </div>

      {hasNew && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand/30 bg-brand-soft/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              What&apos;s new in {latest.version}
              {latest.date && <span className="font-normal text-muted"> · {new Date(latest.date).toLocaleDateString()}</span>}
            </p>
            {update.skipped === latest.version && <span className="text-xs text-subtle">You skipped this version in the reminder.</span>}
          </div>
          {latest.notes.some((n) => n.html) ? (
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
              {latest.notes
                .filter((n) => n.html)
                .map((n) => (
                  <section key={n.version}>
                    {latest.notes.length > 1 && <p className="mb-1 text-xs font-semibold text-subtle">{n.version}</p>}
                    <div className="job-description text-[13px]" dangerouslySetInnerHTML={{ __html: n.html }} />
                  </section>
                ))}
            </div>
          ) : (
            <p className="text-muted">No notes for this release.</p>
          )}

          {status === "downloading" ? (
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.max(3, progress?.percent ?? 0)}%` }} />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted tabular-nums">
                <Loader2 className="size-3.5 animate-spin" />
                {progress && progress.total ? `Downloading ${megabytes(progress.transferred)} of ${megabytes(progress.total)}…` : "Starting the download…"}
              </p>
            </div>
          ) : status === "ready" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void install()} disabled={busy !== null || installing}>
                {busy === "install" || installing ? <Loader2 className="animate-spin" /> : <RotateCw />}
                {installing ? "Restarting…" : "Restart to update"}
              </Button>
              <span className="text-xs text-muted">
                {installing ? "RolePort closes, installs the update and opens again." : "Or it installs the next time you close RolePort."}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void download()} disabled={busy !== null}>
                {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download and update
              </Button>
              <span className="text-xs text-muted">Your jobs, CVs and settings stay as they are.</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="flex gap-1.5 text-xs text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {error}{" "}
            <a href={DESKTOP_DOWNLOAD_URL} className="font-medium underline">
              Download the installer
            </a>
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <label className="flex items-start gap-2.5">
          <Checkbox
            checked={update.autoCheck}
            onCheckedChange={(on) => void setAutoCheck(on)}
            disabled={!update.supported || busy !== null}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Check for updates automatically</span>
            <span className="block text-muted">
              When RolePort opens and every few hours. A new version shows as a notice you can update from, put off, or skip. Nothing downloads
              until you choose to.
            </span>
          </span>
        </label>
        <a
          href={update.releasesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand-ink hover:underline"
        >
          Every version&apos;s release notes <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
