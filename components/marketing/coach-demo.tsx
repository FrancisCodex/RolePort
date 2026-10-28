"use client";

import { motion } from "motion/react";
import { Flame, Quote, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The Interview Coach, scripted: one question, pick an answer, see the interviewer push back on a
 * vague one (in the chosen style), then a small report with rubric scores and, if the answer
 * stretched the truth, the consistency flag RolePort raises against the CV. No AI is called here.
 */

const ease = [0.2, 0, 0, 1] as const;

type AnswerId = "vague" | "specific" | "stretched";
type Style = "standard" | "hell";

const QUESTION = "Tell me about a time you made something noticeably faster. What did you do?";

const ANSWERS: Record<AnswerId, { label: string; text: string }> = {
  vague: { label: "A vague answer", text: "We had some performance issues on the dashboard, so the team worked on it and it got a lot faster." },
  specific: {
    label: "A specific answer",
    text: "I profiled our dashboard, moved the charts to lazy loading and switched the account pages to server rendering. Load time dropped 40%, and I wrote the migration guide the other teams used.",
  },
  stretched: {
    label: "A stretched answer",
    text: "I led a team of six to rebuild the dashboard, and we cut load time by 70%.",
  },
};

const FOLLOW_UP: Record<Style, { lead: string; text: string }> = {
  standard: { lead: "Okay, thanks.", text: "What did you do yourself, and how did you measure the improvement?" },
  hell: { lead: "Hm. I'm not convinced.", text: "That sounds like the team's work. What exactly did you change, and how much faster did it get?" },
};

/** Rubric scores (out of 4) for the final answer, a little lower if it took a follow-up to get there. */
function scoresFor(final: AnswerId, needed: boolean) {
  const base =
    final === "specific"
      ? { "Answered the question": 4, Structure: 3, Specifics: 4, "Your part": 4, Result: 4 }
      : final === "stretched"
        ? { "Answered the question": 3, Structure: 2, Specifics: 2, "Your part": 3, Result: 3 }
        : { "Answered the question": 2, Structure: 1, Specifics: 1, "Your part": 1, Result: 1 };
  return Object.entries(base).map(([k, v]) => [k, needed && v > 1 ? v - 1 : v] as const);
}

export function CoachDemo() {
  const [style, setStyle] = useState<Style>("standard");
  const [answers, setAnswers] = useState<AnswerId[]>([]);
  const followedUp = answers[0] === "vague";
  const done = answers.length > 0 && (answers.at(-1) !== "vague" || answers.length === 2);
  const awaiting = !done;
  const choices: AnswerId[] = followedUp ? ["specific", "stretched"] : ["vague", "specific", "stretched"];

  const final = answers.at(-1) ?? "specific";
  const scores = scoresFor(final, followedUp);
  const avg = scores.reduce((n, [, v]) => n + v, 0) / scores.length;
  const stretched = answers.includes("stretched");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="truncate text-[13px] font-medium">Behavioral · Frontend Developer</p>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Interviewer style">
          {(["standard", "hell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => setStyle(s)}
              disabled={answers.length > 0}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60",
                style === s
                  ? s === "hell"
                    ? "border-danger/40 bg-danger-soft text-danger"
                    : "border-brand/40 bg-brand-soft text-brand-ink"
                  : "border-border text-muted hover:text-fg",
              )}
            >
              {s === "hell" && <Flame className="size-3" />} {s === "hell" ? "From Hell" : "Standard"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* The exchange so far */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-2/60 p-3">
          <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">Question 1 of 1</p>
          <p className="text-[13px] leading-snug font-medium">{QUESTION}</p>
          {answers.map((a, i) => (
            <div key={`${a}-${i}`} className="flex flex-col gap-2">
              <Bubble>{ANSWERS[a].text}</Bubble>
              {i === 0 && a === "vague" && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }} className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-muted">{FOLLOW_UP[style].lead}</p>
                  <p className="text-[13px] leading-snug font-medium">
                    <span className="mr-1 text-[11px] text-brand-ink">Follow-up</span>
                    {FOLLOW_UP[style].text}
                  </p>
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {awaiting ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{followedUp ? "Answer the follow-up" : "Pick how you answer"}</p>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnswers((list) => [...list, id])}
                  className="rounded-md border border-border px-2.5 py-1 text-left text-xs text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"
                >
                  {ANSWERS[id].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold tracking-tight tabular-nums">
                {avg.toFixed(1)}
                <span className="text-xs font-normal text-subtle">/4</span>
              </span>
              <div className="grid flex-1 grid-cols-5 gap-1" aria-label="Rubric scores">
                {scores.map(([label, v]) => (
                  <div key={label} title={`${label}: ${v}/4`} className="flex flex-col gap-1">
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className={cn("block h-full rounded-full", v <= 1 ? "bg-danger" : v === 2 ? "bg-warning" : "bg-brand")} style={{ width: `${(v / 4) * 100}%` }} />
                    </span>
                    <span className="truncate text-[10px] text-subtle">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            {followedUp && <p className="text-[11px] text-muted">It took a follow-up to get to the detail, so the scores are a little lower.</p>}
            {stretched ? (
              <div className="flex flex-col gap-1 rounded-md border border-danger/25 bg-danger-soft/50 p-2.5 text-[11px]">
                <p className="flex items-center gap-1 font-medium text-danger">
                  <TriangleAlert className="size-3" /> Contradicts what you sent
                </p>
                <p className="text-muted">
                  You said: <span className="italic">&ldquo;we cut load time by 70%&rdquo;</span>
                </p>
                <p className="flex gap-1 text-muted">
                  <Quote className="mt-0.5 size-2.5 shrink-0" /> Your tailored CV says: <span className="italic">&ldquo;cutting load time by 40%&rdquo;</span>
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] text-success">
                <ShieldCheck className="size-3" /> Matches your CV. Next: a stronger version to rehearse in the cheat sheet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setAnswers([])}
              className="inline-flex w-fit items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-border-strong hover:text-fg"
            >
              <RotateCcw className="size-3" /> Try another answer
            </button>
          </motion.div>
        )}
      </div>
      <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted">
        <ShieldCheck className="size-3 shrink-0 text-brand" /> Built from the job and what you sent. Answer by typing or out loud, then rehearse the
        report&apos;s stronger answers.
      </p>
    </div>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease }}
      className="ml-auto max-w-[92%] rounded-lg bg-surface px-3 py-2 text-[12px] leading-relaxed text-muted shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {children}
    </motion.p>
  );
}
