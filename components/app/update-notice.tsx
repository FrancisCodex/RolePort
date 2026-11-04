"use client";

import { ArrowUpCircle, Download, Loader2, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { megabytes, useAppUpdate } from "./use-app-update";

/**
 * Desktop app: "a new version is available", inside RolePort instead of a Windows dialog. Update
 * downloads it here; Later hides it for a day; Skip this version hides it until a newer one comes
 * out. Settings → About & updates has the same controls and the release notes.
 */
export function UpdateNotice() {
  const { update, busy, error, installing, download, install, later, skip } = useAppUpdate();
  // "Later" on a finished download: out of the way until the next launch (it installs on close anyway).
  const [hidden, setHidden] = useState(false);

  if (!update?.notify || !update.latest || hidden) return null;
  const { status, latest, progress } = update;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-20 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] lg:bottom-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <ArrowUpCircle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {installing
              ? "Restarting to update…"
              : status === "ready"
                ? `RolePort ${latest.version} is ready to install`
                : `RolePort ${latest.version} is available`}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {installing
              ? "RolePort closes, installs the update and opens again. This takes a moment."
              : status === "ready"
                ? "Restart RolePort to finish. Your jobs, CVs and settings stay as they are."
                : status === "downloading"
                  ? progress && progress.total
                    ? `Downloading ${megabytes(progress.transferred)} of ${megabytes(progress.total)}…`
                    : "Starting the download…"
                  : `You have ${update.current}. `}
            {!installing && status === "available" && (
              <Link href="/settings#about" className="font-medium text-brand-ink hover:underline">
                See what&apos;s new
              </Link>
            )}
          </p>
        </div>
        {!installing && status !== "downloading" && (
          <button
            type="button"
            onClick={() => (status === "ready" ? setHidden(true) : void later())}
            className="-mt-1 -mr-1 rounded p-1 text-subtle hover:text-fg"
            aria-label="Remind me later"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {status === "downloading" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.max(3, progress?.percent ?? 0)}%` }} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {!installing && status !== "downloading" && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {status === "ready" ? (
            <>
              <Button size="sm" onClick={() => void install()} disabled={busy !== null}>
                {busy === "install" ? <Loader2 className="animate-spin" /> : <RotateCw />} Restart to update
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
                Later
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => void download()} disabled={busy !== null}>
                {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Update
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void later()} disabled={busy !== null}>
                Later
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void skip()} disabled={busy !== null}>
                Skip this version
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
