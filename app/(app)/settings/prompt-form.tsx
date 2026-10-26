"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { ANSWER_FIXED_RULES, DEFAULT_ANSWER_PROMPT, MAX_ANSWER_PROMPT } from "@/lib/ai/answer-prompt";
import { CV_FIXED_RULES, DEFAULT_CV_PROMPT, MAX_CV_PROMPT } from "@/lib/ai/cv-prompt";
import { DEFAULT_LETTER_PROMPT, LETTER_FIXED_RULES, MAX_LETTER_PROMPT } from "@/lib/ai/letter-prompt";
import { saveAnswerPrompt, saveCvPrompt, saveLetterPrompt } from "@/lib/client/mutations";
import type { Result } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * An AI prompt shown in full: read the default, change it, or go back to it. The rules HireMe
 * always adds are shown below, read-only, so nothing sent is hidden. Used for the CV tailoring
 * and cover letter prompts.
 */
export function PromptForm({
  id,
  saved,
  defaultPrompt,
  fixedRules,
  fixedNote,
  max,
  onSave,
}: {
  id: string;
  /** The user's own prompt, or null when they use the default. */
  saved: string | null;
  defaultPrompt: string;
  fixedRules: string;
  /** Why the fixed rules exist, in the user's terms. */
  fixedNote: ReactNode;
  max: number;
  onSave: (prompt: string | null) => Promise<Result>;
}) {
  const [text, setText] = useState(saved ?? defaultPrompt);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const isDefault = text.trim() === defaultPrompt.trim();
  const changed = text.trim() !== (saved ?? defaultPrompt).trim();

  function save(next: string | null) {
    setStatus(null);
    startTransition(async () => {
      const result = await onSave(next);
      if (result.ok) {
        if (next === null) setText(defaultPrompt);
        setStatus({ ok: true, text: next === null ? "Back to the default prompt." : "Saved. The next run uses your prompt." });
      } else setStatus({ ok: false, text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">
          Instructions
        </label>
        <Badge tone={saved ? "brand" : "neutral"}>{saved ? "Your prompt" : "Default prompt"}</Badge>
      </div>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        maxLength={max}
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
          {text.length.toLocaleString("en")} / {max.toLocaleString("en")}
        </span>
        {status && <span className={cn("text-xs", status.ok ? "text-success" : "text-danger")}>{status.text}</span>}
      </div>

      <details className="group rounded-lg border border-border bg-surface-2">
        <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-muted select-none hover:text-fg">
          Rules HireMe always adds (can&apos;t be changed)
        </summary>
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-2 text-xs text-muted">{fixedNote}</p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap text-fg">{fixedRules}</pre>
        </div>
      </details>
    </div>
  );
}

export function CvPromptForm({ saved }: { saved: string | null }) {
  return (
    <PromptForm
      id="cv-prompt-text"
      saved={saved}
      defaultPrompt={DEFAULT_CV_PROMPT}
      fixedRules={CV_FIXED_RULES}
      max={MAX_CV_PROMPT}
      onSave={saveCvPrompt}
      fixedNote="They keep job postings from giving the AI instructions and let HireMe read the answer. HireMe also copies your employers, job titles, dates, education and contact details from your profile itself, and flags skills or numbers that aren't in your profile or CV."
    />
  );
}

export function LetterPromptForm({ saved }: { saved: string | null }) {
  return (
    <PromptForm
      id="letter-prompt-text"
      saved={saved}
      defaultPrompt={DEFAULT_LETTER_PROMPT}
      fixedRules={LETTER_FIXED_RULES}
      max={MAX_LETTER_PROMPT}
      onSave={saveLetterPrompt}
      fixedNote="They keep job postings from giving the AI instructions and let HireMe read the answer. HireMe adds your name, contact details, the date and the employer's address around the letter itself, and flags numbers it can't find in your profile or CV, leftover placeholders and clichés."
    />
  );
}

export function AnswerPromptForm({ saved }: { saved: string | null }) {
  return (
    <PromptForm
      id="answer-prompt-text"
      saved={saved}
      defaultPrompt={DEFAULT_ANSWER_PROMPT}
      fixedRules={ANSWER_FIXED_RULES}
      max={MAX_ANSWER_PROMPT}
      onSave={saveAnswerPrompt}
      fixedNote="They keep job postings and questions from giving the AI instructions and let HireMe read the answer. HireMe also flags numbers it can't find in your profile or CV and leftover placeholders."
    />
  );
}
