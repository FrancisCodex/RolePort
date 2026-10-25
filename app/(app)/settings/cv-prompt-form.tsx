"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { CV_FIXED_RULES, DEFAULT_CV_PROMPT, MAX_CV_PROMPT } from "@/lib/ai/cv-prompt";
import { saveCvPrompt } from "@/lib/client/mutations";
import { cn } from "@/lib/utils";

/**
 * The CV tailoring instructions, in full: read the default, change it, or go back to it.
 * The rules HireMe always adds are shown below, read-only, so nothing sent is hidden.
 */
export function CvPromptForm({ saved }: { saved: string | null }) {
  const [text, setText] = useState(saved ?? DEFAULT_CV_PROMPT);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const isDefault = text.trim() === DEFAULT_CV_PROMPT.trim();
  const changed = text.trim() !== (saved ?? DEFAULT_CV_PROMPT).trim();

  function save(next: string | null) {
    setStatus(null);
    startTransition(async () => {
      const result = await saveCvPrompt(next);
      if (result.ok) {
        if (next === null) setText(DEFAULT_CV_PROMPT);
        setStatus({ ok: true, text: next === null ? "Back to the default prompt." : "Saved. The next tailoring uses your prompt." });
      } else setStatus({ ok: false, text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="cv-prompt" className="text-[13px] font-medium">
          Instructions
        </label>
        <Badge tone={saved ? "brand" : "neutral"}>{saved ? "Your prompt" : "Default prompt"}</Badge>
      </div>
      <Textarea
        id="cv-prompt"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        maxLength={MAX_CV_PROMPT}
        spellCheck={false}
        className="min-h-80 font-mono text-xs leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        {/* Saving the default text stores nothing, so future improvements to the default still reach this user. */}
        <Button onClick={() => save(isDefault ? null : text)} disabled={pending || !changed || !text.trim()}>
          {pending ? "Saving…" : "Save prompt"}
        </Button>
        <Button variant="ghost" onClick={() => save(null)} disabled={pending || (!saved && isDefault)}>
          <RotateCcw /> Reset to default
        </Button>
        <span className="text-xs text-subtle tabular-nums">
          {text.length.toLocaleString("en")} / {MAX_CV_PROMPT.toLocaleString("en")}
        </span>
        {status && <span className={cn("text-xs", status.ok ? "text-success" : "text-danger")}>{status.text}</span>}
      </div>

      <details className="group rounded-lg border border-border bg-surface-2">
        <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-muted select-none hover:text-fg">
          Rules HireMe always adds (can&apos;t be changed)
        </summary>
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-2 text-xs text-muted">
            They keep job postings from giving the AI instructions and let HireMe read the answer. HireMe also copies your employers, job
            titles, dates, education and contact details from your profile itself, and flags skills or numbers that aren&apos;t in your
            profile or CV.
          </p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap text-fg">{CV_FIXED_RULES}</pre>
        </div>
      </details>
    </div>
  );
}
