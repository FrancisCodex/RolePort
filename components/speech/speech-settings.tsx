"use client";

import { CircleCheck, Cpu, Download, Globe, HardDrive, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { useSpeechEngine, useWhisperModel } from "@/lib/speech/settings";
import { downloadWhisper } from "@/lib/speech/whisper";
import {
  deleteModel,
  downloadedModels,
  MODEL_HOST,
  modelMb,
  storageLeftMb,
  whisperModel,
  WHISPER_MODELS,
  WHISPER_RUNTIME,
  type WhisperModelId,
} from "@/lib/speech/whisper-models";
import { cn } from "@/lib/utils";

/** Fired after a model is downloaded or removed, so every panel on the page shows the same list. */
const WHISPER_CHANGED = "roleport:whisper-changed";
const announce = () => window.dispatchEvent(new Event(WHISPER_CHANGED));

/** The Whisper models in this browser and its free space, kept current across panels. */
function useWhisperStorage(): { have: WhisperModelId[] | null; space: number | null } {
  const [state, setState] = useState<{ have: WhisperModelId[] | null; space: number | null }>({ have: null, space: null });
  useEffect(() => {
    let live = true;
    const load = () =>
      void Promise.all([downloadedModels(), storageLeftMb()]).then(([have, space]) => {
        if (live) setState({ have, space });
      });
    load();
    window.addEventListener(WHISPER_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(WHISPER_CHANGED, load);
    };
  }, []);
  return state;
}

/** "Remove Whisper X?" with what it frees, then the removal. Returns the remover and its dialog. */
function useRemoveModel() {
  const [confirm, confirmDialog] = useConfirm();
  async function remove(id: WhisperModelId) {
    const m = whisperModel(id);
    const ok = await confirm({
      title: `Remove Whisper ${m.label}?`,
      body: `This deletes its ${modelMb(m)} MB of files from this browser. You can download it again any time; answers out loud will need a model or built-in speech until then.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    await deleteModel(id);
    announce();
  }
  return [remove, confirmDialog] as const;
}

/**
 * How answers spoken out loud become text: the browser's built-in speech (the default, nothing
 * to download) or Whisper on this device (an optional download). Every file a download fetches,
 * its size and where it comes from are shown before anything starts, and it can be removed
 * again. Used in Voice settings, Settings and onboarding.
 */
export function SpeechSettings({ intro = true }: { intro?: boolean }) {
  const [engine, setEngine] = useSpeechEngine();
  const { have } = useWhisperStorage();
  return (
    <div className="flex flex-col gap-3">
      {intro && (
        <p className="text-[13px] text-muted">
          When you answer a mock interview out loud, this turns your speech into text. Built-in speech needs no download. Whisper is an optional
          download that works in every browser and keeps your voice on this device.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <EngineChoice
          active={engine === "browser"}
          onClick={() => setEngine("browser")}
          icon={Globe}
          title="Built-in browser speech"
          badge="Default"
          body="Nothing to download. Works in Chrome, Edge and Safari, not in Brave, Firefox or most in-app browsers. Chrome and Edge send your audio to Google or Microsoft to transcribe."
        />
        <EngineChoice
          active={engine === "whisper"}
          onClick={() => setEngine("whisper")}
          icon={Cpu}
          title="Whisper on this device"
          badge="Optional download"
          body="Works in every modern browser and in the desktop app. Your voice never leaves this computer. Needs a one-time download, and text appears when you stop rather than while you talk."
        />
      </div>
      {engine === "whisper" ? (
        <WhisperManager onDownloaded={() => setEngine("whisper")} />
      ) : (
        have && have.length > 0 && <DownloadedModels have={have} />
      )}
    </div>
  );
}

function EngineChoice({
  active,
  onClick,
  icon: Icon,
  title,
  badge,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  title: string;
  badge: string;
  body: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
        active ? "border-brand/50 bg-brand-soft" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className={cn("flex flex-wrap items-center gap-1.5 text-[13px] font-medium", active && "text-brand-ink")}>
        <Icon className="size-3.5" /> {title} <Badge>{badge}</Badge>
      </span>
      <span className="text-xs text-muted">{body}</span>
    </button>
  );
}

/** Models still in this browser while built-in speech is selected: what they take up, and a way to remove them. */
function DownloadedModels({ have }: { have: WhisperModelId[] }) {
  const [remove, confirmDialog] = useRemoveModel();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
      {confirmDialog}
      <p className="text-xs text-muted">
        Still on this device, but not in use while built-in speech is selected. Remove {have.length === 1 ? "it" : "them"} to free the space, or switch to
        Whisper above to use {have.length === 1 ? "it" : "them"}.
      </p>
      <ul className="flex flex-col gap-1.5">
        {have.map((id) => {
          const m = whisperModel(id);
          return (
            <li key={id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]">
              <span className="flex items-center gap-1.5">
                <HardDrive className="size-3.5 text-subtle" /> Whisper {m.label}
                <span className="text-xs text-muted tabular-nums">about {modelMb(m)} MB</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => void remove(id)} className="hover:text-danger">
                <Trash2 /> Remove
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Progress = { loaded: number; total: number };

/** Choose, download and remove Whisper models, with exactly what each download contains. */
export function WhisperManager({ onDownloaded }: { onDownloaded?: () => void }) {
  const [model, setModel] = useWhisperModel();
  const { have, space } = useWhisperStorage();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, confirmDialog] = useRemoveModel();
  const chosen = whisperModel(model);
  const downloaded = have?.includes(chosen.id) ?? false;

  async function download() {
    setError(null);
    setProgress({ loaded: 0, total: 0 });
    try {
      await downloadWhisper(chosen.id, setProgress);
      announce();
      onDownloaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The download failed. Try again.");
    } finally {
      setProgress(null);
    }
  }

  const needMb = modelMb(chosen) + WHISPER_RUNTIME.mb;
  const tooBig = space !== null && space < needMb * 1.2;
  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3">
      {confirmDialog}
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Whisper model">
        {WHISPER_MODELS.map((m) => (
          <label
            key={m.id}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-md border bg-surface p-2.5",
              m.id === chosen.id ? "border-brand/50" : "border-border hover:border-border-strong",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <input type="radio" name="whisper-model" checked={m.id === chosen.id} onChange={() => setModel(m.id)} className="mt-0.5 accent-[var(--brand)]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                {m.label} <span className="font-normal text-muted tabular-nums">about {modelMb(m)} MB</span>
                {have?.includes(m.id) && (
                  <Badge tone="success">
                    <CircleCheck /> On this device
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted">{m.description}</span>
            </span>
            {have?.includes(m.id) && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void remove(m.id);
                }}
                className="shrink-0 rounded p-1 text-subtle hover:text-danger"
                aria-label={`Remove Whisper ${m.label} from this browser`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </label>
        ))}
      </div>

      {!downloaded && (
        <details className="rounded-md border border-border bg-surface text-xs" open>
          <summary className="cursor-pointer px-3 py-2 font-medium text-muted hover:text-fg">What gets downloaded</summary>
          <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 text-muted">
            <ul className="flex flex-col gap-1">
              {chosen.files.map((f) => (
                <li key={f.name} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-[11px]">{f.name}</span>
                  <span className="shrink-0 tabular-nums">{f.mb} MB</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span>{WHISPER_RUNTIME.name}, if this browser doesn&apos;t have it yet</span>
                <span className="shrink-0 tabular-nums">{WHISPER_RUNTIME.mb} MB</span>
              </li>
            </ul>
            <p className="flex gap-1.5">
              <Globe className="mt-0.5 size-3 shrink-0" />
              <span>
                The model files come from {MODEL_HOST}/{chosen.repo} (OpenAI&apos;s Whisper, MIT licence, converted by Hugging Face). The runtime comes
                from {WHISPER_RUNTIME.from}.
              </span>
            </p>
            <p className="flex gap-1.5">
              <HardDrive className="mt-0.5 size-3 shrink-0" />
              <span>
                Kept in this browser&apos;s storage for this site{space !== null ? ` (about ${(space / 1000).toFixed(space > 10000 ? 0 : 1)} GB free)` : ""}
                . It stays until you remove it here or clear this site&apos;s data, and isn&apos;t part of backups. Recordings are transcribed on this
                device and never uploaded.
              </span>
            </p>
          </div>
        </details>
      )}

      {downloaded ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CircleCheck className="size-3.5" /> Whisper {chosen.label} is on this device and ready to use.
        </p>
      ) : busy ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: progress.total ? `${Math.min(100, (progress.loaded / progress.total) * 100)}%` : "3%" }}
            />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted tabular-nums">
            <Loader2 className="size-3.5 animate-spin" />
            Downloading {(progress.loaded / 1e6).toFixed(0)} of {progress.total ? `${(progress.total / 1e6).toFixed(0)} MB` : "…"}. Keep this page open.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void download()} disabled={tooBig}>
            <Download /> Download Whisper {chosen.label} (about {needMb} MB)
          </Button>
          <span className="text-xs text-subtle">Optional. Built-in speech keeps working without it.</span>
        </div>
      )}
      {tooBig && !downloaded && (
        <p className="flex gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> This browser has about {space} MB free for RolePort, which isn&apos;t enough. Pick a smaller model
          or free some space.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
