"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A modal on the native <dialog> element: it traps focus, closes on Esc and sits above
 * everything without a portal. Clicking the backdrop counts as cancelling.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Esc: keep the dialog open until the parent says so, so state and DOM agree.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg shadow-[0_16px_48px_hsl(var(--shadow-color)/0.28)]",
        "backdrop:bg-black/45 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for deleting or throwing work away. */
  tone?: "primary" | "danger";
};

/** A yes/no question in a modal, in place of window.confirm. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} labelledBy="confirm-dialog-title">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <h2 id="confirm-dialog-title" className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {body && <div className="text-[13px] leading-relaxed text-muted">{body}</div>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          {/* The safe choice keeps focus; the action needs a deliberate click. */}
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * `const [confirm, dialog] = useConfirm()`: render `dialog` once, then
 * `if (!(await confirm({ title: "…" }))) return;` wherever window.confirm would go.
 */
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);

  function answer(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ""}
      body={request?.body}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      tone={request?.tone}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );

  return [confirm, dialog] as const;
}
