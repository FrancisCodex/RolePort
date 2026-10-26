"use client";

import { Check, Copy, Loader2, MessageSquareText, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { answerApplicationQuestion, saveQuestions } from "@/lib/client/mutations";
import { MAX_QUESTION, MAX_QUESTIONS, type QuestionItem, type QuestionsData } from "@/lib/questions/types";
import { wordCount } from "@/lib/letter/types";
import { RowIcon } from "./application-kit";

/**
 * The questions an application form asks, with an answer for each drafted from the profile (or
 * written by hand). Questions and answers save as you go; every AI answer lists what to check.
 */
export function QuestionsPanel({ applicationId, data }: { applicationId: string; data: QuestionsData }) {
  const [items, setItems] = useState<QuestionItem[]>(data.items);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // The latest list, for saves that follow an await (state in the closure would be stale).
  const latest = useRef(items);

  const canAi = data.aiEnabled && !data.profileEmpty;
  const answered = items.filter((i) => i.answer.trim()).length;

  function update(next: QuestionItem[]) {
    latest.current = next;
    setItems(next);
  }

  async function persist(next: QuestionItem[]) {
    update(next);
    const result = await saveQuestions(applicationId, next);
    if (!result.ok) setError(result.error);
  }

  async function answer(id: string) {
    setWorking(id);
    setError(null);
    setNeedsSetup(false);
    const result = await answerApplicationQuestion(applicationId, id);
    setWorking(null);
    if (!result.ok) {
      setError(result.error);
      setNeedsSetup(Boolean(result.needsSetup));
      return;
    }
    update(latest.current.map((i) => (i.id === id ? result.data : i)));
  }

  async function add() {
    const question = draft.trim();
    if (!question) return;
    if (items.length >= MAX_QUESTIONS) return setError(`Keep it to ${MAX_QUESTIONS} questions per application.`);
    const item: QuestionItem = { id: crypto.randomUUID(), question, answer: "", draft: null };
    setDraft("");
    setError(null);
    await persist([...latest.current, item]);
    if (canAi) await answer(item.id);
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this question and its answer?")) return;
    await persist(latest.current.filter((i) => i.id !== id));
  }

  async function redo(item: QuestionItem) {
    if (item.answer.trim() && !window.confirm("Write a new answer? It replaces the current one.")) return;
    await answer(item.id);
  }

  /** An edit by hand: no longer the AI's draft, so its warnings go away. */
  function edit(id: string, answerText: string) {
    update(latest.current.map((i) => (i.id === id ? { ...i, answer: answerText, draft: null } : i)));
  }

  async function copy(item: QuestionItem) {
    try {
      await navigator.clipboard.writeText(item.answer);
      setCopied(item.id);
    } catch {
      setError("Couldn't copy. Select the answer and copy it from there.");
    }
  }

  return (
    <li className="flex gap-3 px-5 py-3.5">
      <RowIcon icon={MessageSquareText} done={answered > 0 && answered === items.length} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-[13px] font-medium">Application questions</p>
          <p className="mt-0.5 text-xs text-muted">
            {items.length
              ? `${answered} of ${items.length} answered`
              : "Paste a question from the application form and get an answer grounded in your profile."}
          </p>
        </div>

        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium whitespace-pre-line">{item.question}</p>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                disabled={working === item.id}
                className="shrink-0 rounded p-1 text-subtle hover:text-danger disabled:opacity-50"
                aria-label="Remove question"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <Textarea
              value={item.answer}
              onChange={(e) => edit(item.id, e.target.value)}
              onBlur={() => void persist(latest.current)}
              placeholder={canAi ? "Write the answer yourself, or let AI draft it." : "Write your answer."}
              className="min-h-24 bg-surface text-[13px] leading-relaxed"
              disabled={working === item.id}
              aria-label={`Answer to: ${item.question}`}
            />
            {item.draft && item.draft.warnings.length > 0 && (
              <ul className="flex flex-col gap-1">
                {item.draft.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5 text-xs text-warning">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
            {working === item.id && <p className="text-xs text-muted">Writing your answer… local models can take a minute or two.</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {data.aiEnabled && (
                <Button
                  size="sm"
                  variant={item.answer.trim() ? "secondary" : "primary"}
                  onClick={() => void redo(item)}
                  disabled={working !== null || data.profileEmpty}
                >
                  {working === item.id ? <Loader2 className="animate-spin" /> : <Sparkles />} {item.answer.trim() ? "Write again" : "Write with AI"}
                </Button>
              )}
              {item.answer.trim() && (
                <Button size="sm" variant="secondary" onClick={() => void copy(item)}>
                  {copied === item.id ? <Check /> : <Copy />} {copied === item.id ? "Copied" : "Copy"}
                </Button>
              )}
              {item.answer.trim() && <span className="text-xs text-muted">{wordCount(item.answer)} words</span>}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add();
            }}
            placeholder="Paste a question, e.g. Why do you want to work here?"
            maxLength={MAX_QUESTION}
            className="min-h-16 text-[13px]"
            aria-label="New question"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={items.length ? "secondary" : "primary"} onClick={() => void add()} disabled={!draft.trim() || working !== null}>
              {working ? <Loader2 className="animate-spin" /> : <Plus />} {canAi ? "Add and answer" : "Add question"}
            </Button>
            {canAi && <span className="text-xs text-muted">Ctrl+Enter</span>}
          </div>
        </div>

        {data.profileEmpty && (
          <p className="text-xs text-muted">
            Answers are written from your profile.{" "}
            <Link href="/profile" className="font-medium text-brand-ink hover:underline">
              Fill in your profile or import your CV
            </Link>{" "}
            first.
          </p>
        )}
        {!data.aiEnabled && !data.profileEmpty && (
          <p className="text-xs text-muted">
            <Link href="/settings" className="font-medium text-brand-ink hover:underline">
              Choose an AI provider
            </Link>{" "}
            to have answers drafted for you. You can still keep your own answers here.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {needsSetup && (
          <p className="text-xs text-danger">
            AI isn&apos;t set up.{" "}
            <Link href="/settings" className="font-medium underline">
              Open Settings
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}
