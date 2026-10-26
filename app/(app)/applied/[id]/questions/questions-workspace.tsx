"use client";

import { Check, Copy, Loader2, Plus, Sparkles, Trash2, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { PromptDetails } from "@/components/app/prompt-details";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/fields";
import { answerApplicationQuestion, saveQuestions } from "@/lib/client/mutations";
import { wordCount } from "@/lib/letter/types";
import { MAX_ANSWER, MAX_QUESTION, MAX_QUESTIONS, type QuestionItem, type QuestionsData } from "@/lib/questions/types";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One application's form questions in depth: add them, have AI answer each from the profile,
 * edit the answers, see what each answer leans on and what to check, and see (and change, in
 * Settings) the prompt behind it. The application page shows only the final answers.
 */
export function QuestionsWorkspace({ data }: { data: QuestionsData }) {
  const [items, setItems] = useState<QuestionItem[]>(data.items);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState<string | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // The latest list, for saves that follow an await (state in the closure would be stale).
  const latest = useRef(items);

  const canAi = data.aiEnabled;
  const unanswered = items.filter((i) => !i.answer.trim());

  function update(next: QuestionItem[]) {
    latest.current = next;
    setItems(next);
  }

  async function persist(next: QuestionItem[]) {
    update(next);
    const result = await saveQuestions(data.applicationId, next);
    if (!result.ok) setError(result.error);
  }

  /** Answer one question; false if it failed (the message is already shown). */
  async function answer(id: string): Promise<boolean> {
    const result = await answerApplicationQuestion(data.applicationId, id);
    if (!result.ok) {
      setError(result.error);
      setNeedsSetup(Boolean(result.needsSetup));
      return false;
    }
    update(latest.current.map((i) => (i.id === id ? result.data : i)));
    return true;
  }

  async function run(ids: string[], key: string) {
    setWorking(key);
    setError(null);
    setNeedsSetup(false);
    // One after the other: a local model handles one request at a time anyway.
    for (const id of ids) if (!(await answer(id))) break;
    setWorking(null);
  }

  async function add() {
    const question = draft.trim();
    if (!question) return;
    if (items.length >= MAX_QUESTIONS) return setError(`Keep it to ${MAX_QUESTIONS} questions per application.`);
    const item: QuestionItem = { id: crypto.randomUUID(), question, answer: "", draft: null };
    setDraft("");
    setError(null);
    await persist([...latest.current, item]);
    if (canAi && !data.profileEmpty) await run([item.id], item.id);
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this question and its answer?")) return;
    await persist(latest.current.filter((i) => i.id !== id));
  }

  async function redo(item: QuestionItem) {
    if (item.answer.trim() && !window.confirm("Write a new answer? It replaces the current one, including your edits.")) return;
    await run([item.id], item.id);
  }

  /** An edit by hand: it is no longer the AI's draft, so the review of that draft goes away. */
  function edit(id: string, answerText: string) {
    update(latest.current.map((i) => (i.id === id ? { ...i, answer: answerText, draft: null } : i)));
    setCopied(null);
  }

  async function copy(item: QuestionItem) {
    try {
      await navigator.clipboard.writeText(item.answer);
      setCopied(item.id);
    } catch {
      setError("Couldn't copy. Select the answer and copy it from there.");
    }
  }

  if (data.profileEmpty) {
    return (
      <EmptyState
        icon={UserRound}
        title="Your profile is empty"
        body="Answers are written from your profile: your experience and skills. Import your CV or fill in your profile first."
        action={
          <Link href="/profile" className={buttonVariants()}>
            Go to your profile
          </Link>
        }
      />
    );
  }

  const busy = working !== null;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Add a question</CardTitle>
            <CardDescription>Paste it as the application form words it. {canAi ? "It's answered as soon as you add it." : "Write the answer yourself below."}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add();
              }}
              placeholder="e.g. Why do you want to work here?"
              maxLength={MAX_QUESTION}
              className="min-h-20 text-[13px]"
              aria-label="New question"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void add()} disabled={!draft.trim() || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Plus />} {canAi ? "Add and answer" : "Add question"}
              </Button>
              <span className="text-xs text-subtle">Ctrl+Enter</span>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 && <p className="px-1 text-[13px] text-muted">No questions yet. Add the first one above.</p>}

        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="whitespace-pre-line">{item.question}</CardTitle>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  disabled={busy}
                  className="shrink-0 rounded p-1 text-subtle hover:text-danger disabled:opacity-50"
                  aria-label="Remove question"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                value={item.answer}
                onChange={(e) => edit(item.id, e.target.value)}
                onBlur={() => void persist(latest.current)}
                maxLength={MAX_ANSWER}
                placeholder={canAi ? "Write the answer yourself, or let AI draft it." : "Write your answer."}
                className="min-h-32 text-[13px] leading-relaxed"
                disabled={working === item.id || working === "all"}
                aria-label={`Answer to: ${item.question}`}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {canAi && (
                  <Button variant={item.answer.trim() ? "secondary" : "primary"} onClick={() => void redo(item)} disabled={busy}>
                    {working === item.id ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {working === item.id ? "Writing…" : item.answer.trim() ? "Write again" : "Write with AI"}
                  </Button>
                )}
                {item.answer.trim() && (
                  <Button variant="secondary" onClick={() => void copy(item)}>
                    {copied === item.id ? <Check /> : <Copy />} {copied === item.id ? "Copied" : "Copy"}
                  </Button>
                )}
                {item.answer.trim() && <span className="text-xs text-subtle tabular-nums">{wordCount(item.answer)} words</span>}
              </div>
              {item.draft ? <WhyThisAnswer draft={item.draft} /> : item.answer.trim() ? <p className="text-xs text-subtle">Written or edited by you.</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="flex flex-col gap-3 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Answer with AI</CardTitle>
            <CardDescription>Answers each question from your profile and this posting, using only facts you&apos;ve given.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!canAi ? (
              <p className="text-[13px] text-muted">
                <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                  Choose an AI provider
                </Link>{" "}
                to have answers drafted. You can still write and keep your own answers here.
              </p>
            ) : (
              <Button
                onClick={() => void run(unanswered.map((i) => i.id), "all")}
                disabled={busy || unanswered.length === 0}
              >
                {working === "all" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {working === "all" ? "Writing…" : unanswered.length ? `Answer ${unanswered.length} unanswered` : "Everything is answered"}
              </Button>
            )}
            {!data.hasPosting && <p className="text-xs text-muted">The posting isn&apos;t stored anymore, so answers come from your profile alone.</p>}
            {busy && <p className="text-xs text-muted">Local models can take a few minutes. Keep this page open.</p>}
            {error && (
              <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                {error}{" "}
                {needsSetup && (
                  <Link href="/settings" className="font-medium underline">
                    Open Settings
                  </Link>
                )}
              </p>
            )}
            <PromptDetails prompt={data.prompt} settingsAnchor="answer-prompt" />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/** What an AI answer leans on and what to check, so the user can see why it reads the way it does. */
function WhyThisAnswer({ draft }: { draft: NonNullable<QuestionItem["draft"]> }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs">
      <p className="text-subtle">
        Drafted {formatWhen(draft.at)} with {draft.model}
        {draft.customPrompt ? " using your own prompt" : ""}.
      </p>
      {draft.warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-warning/20 bg-warning-soft p-2.5">
          <p className="flex items-center gap-1.5 font-medium text-warning">
            <TriangleAlert className="size-3.5" /> Check before you send
          </p>
          <ul className="flex flex-col gap-1">
            {draft.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.notes && <p className="text-muted">{draft.notes}</p>}
      {draft.facts.length > 0 && (
        <div>
          <p className="mb-1.5 font-medium text-muted">What it leans on</p>
          <ul className="flex flex-col gap-1">
            {draft.facts.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
