"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { ANSWER_FIXED_RULES, DEFAULT_ANSWER_PROMPT, MAX_ANSWER_PROMPT } from "@/lib/ai/answer-prompt";
import { CV_FIXED_RULES, DEFAULT_CV_PROMPT, MAX_CV_PROMPT } from "@/lib/ai/cv-prompt";
import { DEFAULT_INTERVIEWER_PROMPT, INTERVIEWER_FIXED_RULES, MAX_INTERVIEWER_PROMPT } from "@/lib/ai/interview-prompt";
import { DEFAULT_EMAIL_PROMPT, EMAIL_FIXED_RULES, MAX_EMAIL_PROMPT } from "@/lib/ai/email-prompt";
import { DEFAULT_LETTER_PROMPT, LETTER_FIXED_RULES, MAX_LETTER_PROMPT } from "@/lib/ai/letter-prompt";
import { DEFAULT_PROFILE_PROMPT, MAX_PROFILE_PROMPT, PROFILE_FIXED_RULES, withSection, withWrittenSummary } from "@/lib/ai/profile-prompt";
import { saveAnswerPrompt, saveCvPrompt, saveEmailPrompt, saveInterviewPrompt, saveLetterPrompt, saveProfilePrompt } from "@/lib/client/mutations";
import type { Result } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * An AI prompt shown in full: read the default, change it, or go back to it. The rules RolePort
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
  tools,
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
  /** Shortcuts that edit the text, shown above it. */
  tools?: (text: string, setText: (next: string) => void) => ReactNode;
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
      {tools?.(text, (next) => {
        setText(next);
        setStatus(null);
      })}
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
          Rules RolePort always adds (can&apos;t be changed)
        </summary>
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-2 text-xs text-muted">{fixedNote}</p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap text-fg">{fixedRules}</pre>
        </div>
      </details>
    </div>
  );
}

/** Common edits to the CV reading prompt, for people who'd rather not write the rule themselves. */
function ProfilePromptTools({ text, setText }: { text: string; setText: (next: string) => void }) {
  const [section, setSection] = useState("");
  const writesSummary = withWrittenSummary(text) === text;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
      <p className="text-[13px] font-medium">Quick changes</p>
      <p className="text-xs text-muted">These add a rule to the prompt below. Save the prompt, then read your CV again to see the result.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="soft" size="sm" className="shrink-0" disabled={writesSummary} onClick={() => setText(withWrittenSummary(text))}>
          <Sparkles /> {writesSummary ? "AI writes your summary" : "Have AI write my summary"}
        </Button>
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!section.trim()) return;
            setText(withSection(text, section));
            setSection("");
          }}
        >
          <Input
            aria-label="Section to ask the AI for"
            placeholder="Ask for a section, e.g. Open source"
            value={section}
            maxLength={60}
            onChange={(e) => setSection(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm" className="shrink-0" disabled={!section.trim()}>
            Add to prompt
          </Button>
        </form>
      </div>
    </div>
  );
}

export function ProfilePromptForm({ saved, id = "profile-prompt-text" }: { saved: string | null; id?: string }) {
  return (
    <PromptForm
      id={id}
      saved={saved}
      defaultPrompt={DEFAULT_PROFILE_PROMPT}
      fixedRules={PROFILE_FIXED_RULES}
      max={MAX_PROFILE_PROMPT}
      onSave={saveProfilePrompt}
      tools={(text, setText) => <ProfilePromptTools text={text} setText={setText} />}
      fixedNote="They keep your CV's text from giving the AI instructions and let RolePort read the answer. The text of your CV is sent after them, inside <cv> tags, only to the AI provider you chose. What the AI returns fills in your profile form: nothing is saved until you press Save profile."
    />
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
      fixedNote="They keep job postings from giving the AI instructions and let RolePort read the answer. RolePort also copies your employers, job titles, dates, education and contact details from your profile itself, and flags skills or numbers that aren't in your profile or CV."
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
      fixedNote="They keep job postings from giving the AI instructions and let RolePort read the answer. RolePort adds your name, contact details, the date and the employer's address around the letter itself, and flags numbers it can't find in your profile or CV, leftover placeholders and clichés."
    />
  );
}

export function InterviewerPromptForm({ saved }: { saved: string | null }) {
  return (
    <PromptForm
      id="interviewer-prompt-text"
      saved={saved}
      defaultPrompt={DEFAULT_INTERVIEWER_PROMPT}
      fixedRules={INTERVIEWER_FIXED_RULES}
      max={MAX_INTERVIEWER_PROMPT}
      onSave={saveInterviewPrompt}
      fixedNote="They keep the interviewer professional in every style, keep job postings and your answers from giving the AI instructions, and let RolePort read the reply. The interviewer style you pick for each interview (Friendly to From Hell) is added between your instructions and these rules, and RolePort caps the follow-ups per question itself."
    />
  );
}

export function EmailPromptForm({ saved }: { saved: string | null }) {
  return (
    <PromptForm
      id="email-prompt-text"
      saved={saved}
      defaultPrompt={DEFAULT_EMAIL_PROMPT}
      fixedRules={EMAIL_FIXED_RULES}
      max={MAX_EMAIL_PROMPT}
      onSave={saveEmailPrompt}
      fixedNote="They keep job postings and your notes from giving the AI instructions and let RolePort read the answer. RolePort adds the subject line, your sign-off and contact details itself, and flags numbers it can't find in your profile, CV or the application, leftover placeholders, clichés and messages that run long."
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
      fixedNote="They keep job postings and questions from giving the AI instructions and let RolePort read the answer. RolePort also flags numbers it can't find in your profile or CV and leftover placeholders."
    />
  );
}
