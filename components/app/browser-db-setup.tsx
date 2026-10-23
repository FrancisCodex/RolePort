import { Loader2 } from "lucide-react";

/** Lite edition, first visit: shown while the browser database is created (a few seconds, once). */
export function BrowserDbSetup() {
  return (
    <div role="status" className="flex flex-col items-center rounded-3xl border border-border bg-surface px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-3xl bg-brand-soft text-brand-ink">
        <Loader2 className="size-7 animate-spin" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold">Setting up your data in this browser…</h2>
      <p className="mt-2 max-w-sm text-muted">
        This only happens on your first visit and takes a few seconds. Everything you add is saved here, on this device.
      </p>
    </div>
  );
}
