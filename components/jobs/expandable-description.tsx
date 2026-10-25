"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A job description that starts as a short, faded preview with "Show more", so the posting is
 * there to re-read without pushing everything else down the page.
 */
export function ExpandableDescription({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  // Short descriptions fit in the preview: no fade, no button.
  const [overflows, setOverflows] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!open) setOverflows(el.scrollHeight > el.clientHeight + 4);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, html]);

  function toggle() {
    setOpen((o) => !o);
    // Collapsing a long description would leave the reader far down the page: bring the top back.
    if (open) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-xs font-medium text-muted">Job description</p>
      <div className="relative">
        <div
          ref={box}
          id="job-description"
          className={cn("job-description overflow-hidden", !open && "max-h-36")}
          // Sanitized at ingest (lib/jobs/html.ts).
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!open && overflows && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-b from-transparent to-surface" />}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="job-description"
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-ink hover:underline"
        >
          {open ? "Show less" : "Show more"} {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      )}
    </div>
  );
}
