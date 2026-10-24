"use client";

import { Download, HardDrive, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { backupFileName } from "@/lib/backup/format";
import type { ImportMode, ImportSummary } from "@/lib/backup/import";
import { exportData, importData } from "@/lib/client/mutations";
import { downloadText, recordBackup, requestPersistence, storageStatus, type StorageStatus } from "@/lib/client/storage";
import { cn } from "@/lib/utils";

type Message = { ok: boolean; text: string } | null;

function describe(s: ImportSummary): string {
  const parts = [
    s.profile && "your profile",
    s.settings && "settings",
    s.applications && `${s.applications} application${s.applications === 1 ? "" : "s"}`,
    s.evaluations && `${s.evaluations} evaluation${s.evaluations === 1 ? "" : "s"}`,
    s.jobs && `${s.jobs} job${s.jobs === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.length ? `Imported ${parts.join(", ")}.` : "Everything in that backup is already here.";
}

/** Download a backup, or restore one. The same file works in HireMe Lite and a self-hosted install. */
export function BackupControls({ browserStorage = false }: { browserStorage?: boolean }) {
  const [message, setMessage] = useState<Message>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function exportNow() {
    setMessage(null);
    setBusy("export");
    start(async () => {
      const result = await exportData();
      if (result.ok) {
        downloadText(backupFileName(), result.data);
        recordBackup();
        setMessage({ ok: true, text: "Backup downloaded. Keep it somewhere safe, like a cloud drive." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
      setBusy(null);
    });
  }

  function importNow() {
    if (!file) return;
    setMessage(null);
    setBusy("import");
    const form = new FormData();
    form.set("backup", file);
    form.set("mode", mode);
    start(async () => {
      const result = await importData(form);
      setMessage(result.ok ? { ok: true, text: describe(result.data) } : { ok: false, text: result.error });
      if (result.ok) setFile(null);
      setBusy(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p className="font-medium text-fg">Backups</p>
        <p>One file with your profile, CV text, pipeline and evaluations. It works in HireMe Lite and in a self-hosted install. API keys aren&apos;t included.</p>
      </div>

      {browserStorage && <BrowserStorage />}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportNow} disabled={busy !== null}>
          {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />} Download backup
        </Button>
        <Button variant="ghost" onClick={() => input.current?.click()} disabled={busy !== null}>
          <Upload /> Restore from a backup
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setMode("merge");
            setMessage(null);
            e.target.value = "";
          }}
        />
      </div>

      {file && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="font-medium text-fg">Restore {file.name}</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">How to restore</legend>
            {(
              [
                ["merge", "Add to what's here", "Keeps your current data. Where both have the same job, the newer version wins."],
                ["replace", "Replace what's here", "Deletes your current profile, pipeline and evaluations first. Settings and API keys stay."],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-md border px-3 py-2",
                  mode === value ? "border-brand/50 bg-brand-soft" : "border-border hover:border-border-strong",
                )}
              >
                <input type="radio" name="restore-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[var(--brand)]" />
                <span>
                  <span className="block font-medium text-fg">{label}</span>
                  <span className="text-xs">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <Button onClick={importNow} disabled={busy !== null} variant={mode === "replace" ? "danger" : "primary"}>
              {busy === "import" && <Loader2 className="animate-spin" />} {mode === "replace" ? "Replace my data" : "Restore"}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Lite edition: how much this browser holds, and whether it may clear it under storage pressure. */
function BrowserStorage() {
  const [status, setStatus] = useState<StorageStatus | null>(null);

  useEffect(() => {
    let live = true;
    storageStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  if (!status) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5">
      {status.usedBytes != null && (
        <p className="flex items-center gap-2">
          <HardDrive className="size-3.5 shrink-0 text-subtle" />
          Using {formatBytes(status.usedBytes)}
          {status.quotaBytes ? ` of ${formatBytes(status.quotaBytes)} available` : ""} in this browser.
        </p>
      )}
      {status.persisted ? (
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 shrink-0 text-success" />
          Protected: this browser won&apos;t clear HireMe&apos;s data to free up space.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>Not protected yet: the browser may clear this data if your device runs low on space.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => requestPersistence().then((persisted) => setStatus((s) => s && { ...s, persisted }))}
          >
            Protect my data
          </Button>
          {status.persisted === false && (
            <span className="text-xs text-subtle">Browsers decide this themselves. Installing HireMe as an app usually helps.</span>
          )}
        </div>
      )}
    </div>
  );
}
