"use client";

import { Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { downloadDesktopJobSpy, removeDesktopJobSpy, saveJobSpyEnabled } from "@/lib/client/mutations";
import type { DesktopJobSpy as DesktopJobSpyView } from "@/lib/desktop/jobspy";

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/**
 * Desktop app: LinkedIn, Indeed and more through JobSpy, downloaded as one program file only when
 * the user agrees, with what it is, how big, where from and where it goes shown first.
 */
export function DesktopJobSpy({ jobspy, enabled }: { jobspy: DesktopJobSpyView; enabled: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"download" | "toggle" | "remove" | null>(null);
  const [, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  function run(kind: NonNullable<typeof busy>, task: () => Promise<{ ok: boolean; text: string } | null>) {
    setMessage(null);
    setBusy(kind);
    start(async () => {
      setMessage(await task());
      setBusy(null);
    });
  }

  const download = () =>
    run("download", async () => {
      const result = await downloadDesktopJobSpy();
      return result.ok ? { ok: true, text: "Downloaded and on. LinkedIn, Indeed and other boards are now part of every search." } : { ok: false, text: result.error };
    });

  const toggle = (next: boolean) =>
    run("toggle", async () => {
      const result = await saveJobSpyEnabled({ enabled: next });
      return result.ok ? { ok: true, text: next ? "On. LinkedIn, Indeed and other boards are now part of every search." : "Off." } : { ok: false, text: result.error };
    });

  async function remove() {
    const ok = await confirm({
      title: "Remove JobSpy?",
      body: "This deletes the JobSpy file from this computer and turns the LinkedIn, Indeed and other JobSpy boards off. You can download it again any time.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    run("remove", async () => {
      const result = await removeDesktopJobSpy();
      return result.ok ? { ok: true, text: "Removed." } : { ok: false, text: result.error };
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">LinkedIn, Indeed and more via JobSpy</p>
        <p className="text-[13px] text-muted">
          Free and no key needed. Searches LinkedIn, Indeed, Google Jobs, Glassdoor and regional boards such as Bayt (Gulf) and Naukri (India)
          from this computer. Powered by{" "}
          <a
            href="https://github.com/speedyapply/JobSpy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
          >
            JobSpy <ExternalLink className="size-3" />
          </a>
          , an open-source project by Cullen Watson and contributors.
        </p>
      </div>

      {!jobspy.available ? (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-muted">JobSpy isn&apos;t available for this computer in this version of RolePort yet.</p>
      ) : !jobspy.downloaded ? (
        <>
          <p className="text-[13px] text-muted">
            It needs one extra program, downloaded only if you choose to. Nothing is downloaded until you click the button.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border px-3 py-2.5 text-[13px]">
            <dt className="text-muted">What</dt>
            <dd>JobSpy {jobspy.version}, built from RolePort&apos;s open-source code</dd>
            <dt className="text-muted">Size</dt>
            <dd>{jobspy.size ? megabytes(jobspy.size) : "Unknown"}</dd>
            <dt className="text-muted">From</dt>
            <dd className="min-w-0 break-all font-mono text-xs leading-5">{jobspy.source}</dd>
            <dt className="text-muted">Saved in</dt>
            <dd className="min-w-0 break-all font-mono text-xs leading-5">{jobspy.folder}</dd>
          </dl>
          <p className="rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[13px] text-warning">
            JobSpy reads public job pages from your own network. These sites&apos; terms don&apos;t allow automated access, and they may rate-limit
            or block your connection for a while. Use it for your own job search only. Results are cached for a few hours to keep requests low.
          </p>
        </>
      ) : null}

      {message && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}
        >
          {message.text}
        </p>
      )}

      {jobspy.available && (
        <div className="flex flex-wrap gap-2">
          {!jobspy.downloaded ? (
            <Button onClick={download} disabled={busy !== null}>
              {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}
              {busy === "download" ? "Downloading and checking…" : "I understand, download and turn on"}
            </Button>
          ) : (
            <>
              <Button variant={enabled ? "ghost" : "primary"} onClick={() => toggle(!enabled)} disabled={busy !== null}>
                {busy === "toggle" && <Loader2 className="animate-spin" />} {enabled ? "Turn off" : "Turn on"}
              </Button>
              <Button variant="ghost" onClick={remove} disabled={busy !== null}>
                {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove JobSpy
              </Button>
            </>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
