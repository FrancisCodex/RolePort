import { Loader2 } from "lucide-react";

/** Lite edition, first visit: shown while the browser database is created (a few seconds, once). */
export function BrowserDbSetup() {
  return (
    <div role="status" className="flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-14 text-center">
      <span className="grid size-10 place-items-center rounded-lg border border-border text-muted">
        <Loader2 className="size-[18px] animate-spin" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold">Setting up your data in this browser…</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        This only happens on your first visit and takes a few seconds. Everything you add is saved here, on this device.
      </p>
    </div>
  );
}
