"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Bot, Check, Cloud, Copy, Cpu, Download, FileText, KanbanSquare, Laptop, Loader2, Lock, Mail, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { MatchRing } from "@/components/ui/match-ring";
import { cn } from "@/lib/utils";
import { fitLabel } from "./demo-data";

const ease = [0.2, 0, 0, 1] as const;

type Tab = { id: string; icon: typeof Target; title: string; body: string };

const TABS: Tab[] = [
  { id: "match", icon: Target, title: "Honest match scores", body: "Toggle the skills on your profile and watch the score, strengths and gaps change." },
  { id: "kit", icon: FileText, title: "Tailor & apply in one place", body: "Tailor your CV and write the cover letter for a job in a click, then download or copy them." },
  { id: "pipeline", icon: KanbanSquare, title: "A pipeline you can drag", body: "Move applications from Saved to Offer. Your response rate keeps itself up to date." },
  { id: "privacy", icon: Lock, title: "Your AI, your data", body: "Pick a provider and see exactly where your CV goes. With Ollama, nowhere at all." },
];

/** Notion-style feature tabs: a short list on the left, a live demo of the chosen one on the right. */
export function FeatureTabs() {
  const [active, setActive] = useState(TABS[0].id);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-6">
      <div role="tablist" aria-label="Features" className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        <LayoutGroup id="feature-tabs">
          {TABS.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                onClick={() => setActive(t.id)}
                className={cn(
                  "relative flex min-w-56 shrink-0 gap-3 rounded-lg p-3.5 text-left transition-colors lg:min-w-0",
                  on ? "text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="feature-tab-bg"
                    transition={{ duration: 0.3, ease }}
                    className="absolute inset-0 rounded-lg border border-border bg-surface shadow-[var(--shadow-soft)]"
                  />
                )}
                <t.icon className={cn("relative mt-0.5 size-4 shrink-0", on ? "text-brand" : "text-subtle")} strokeWidth={1.75} />
                <span className="relative">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className={cn("mt-0.5 block text-[13px]", on ? "text-muted" : "text-subtle")}>{t.body}</span>
                </span>
              </button>
            );
          })}
        </LayoutGroup>
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="relative min-h-[420px] overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease }}
            className="h-full"
          >
            {active === "match" && <MatchDemo />}
            {active === "kit" && <KitDemo />}
            {active === "pipeline" && <PipelineDemo />}
            {active === "privacy" && <PrivacyDemo />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DemoHeader({ title, hint }: { title: ReactNode; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <p className="truncate text-[13px] font-medium">{title}</p>
      <p className="shrink-0 text-[11px] text-subtle">{hint}</p>
    </div>
  );
}

/* Match ---------------------------------------------------------------------- */

const REQUIREMENTS = [
  { skill: "React", weight: 24 },
  { skill: "TypeScript", weight: 20 },
  { skill: "Next.js", weight: 16 },
  { skill: "Testing", weight: 12 },
  { skill: "GraphQL", weight: 10 },
  { skill: "Figma", weight: 8 },
  { skill: "Tailwind", weight: 10 },
];

function MatchDemo() {
  const [have, setHave] = useState<string[]>(["React", "TypeScript", "Tailwind"]);
  const score = REQUIREMENTS.reduce((n, r) => n + (have.includes(r.skill) ? r.weight : 0), 0);
  const matched = REQUIREMENTS.filter((r) => have.includes(r.skill));
  const missing = REQUIREMENTS.filter((r) => !have.includes(r.skill)).sort((a, b) => b.weight - a.weight);

  return (
    <div className="flex h-full flex-col">
      <DemoHeader title="Frontend Developer · Kalye Labs" hint="Click your skills" />
      <div className="grid flex-1 gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Your profile</p>
          <div className="flex flex-wrap gap-1.5">
            {REQUIREMENTS.map(({ skill }) => {
              const on = have.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setHave((h) => (on ? h.filter((s) => s !== skill) : [...h, skill]))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    on ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-dashed border-border-strong text-muted hover:text-fg",
                  )}
                >
                  {on ? <Check className="size-3" strokeWidth={3} /> : <span className="text-subtle">+</span>}
                  {skill}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-4 rounded-lg border border-border p-4">
            <MatchRing score={score} size={72} />
            <div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={fitLabel(score)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-base font-semibold tracking-tight"
                >
                  {fitLabel(score)}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs text-muted">
                {matched.length} of {REQUIREMENTS.length} requirements met
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SkillList title="Strengths" items={matched.map((r) => r.skill)} tone="good" empty="Add a skill to see what carries you." />
          <SkillList
            title="Gaps to close"
            items={missing.map((r) => `${r.skill} · ${r.weight}% of the score`)}
            tone="gap"
            empty="Nothing missing. Apply today."
          />
        </div>
      </div>
    </div>
  );
}

function SkillList({ title, items, tone, empty }: { title: string; items: string[]; tone: "good" | "gap"; empty: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">{title}</p>
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.18, ease }}
              className="flex items-center gap-2 text-[13px]"
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full",
                  tone === "good" ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                )}
              >
                {tone === "good" ? <Check className="size-2.5" strokeWidth={3.5} /> : <X className="size-2.5" strokeWidth={3.5} />}
              </span>
              {item}
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && <li className="text-[13px] text-subtle">{empty}</li>}
      </ul>
    </div>
  );
}

/* Pipeline ------------------------------------------------------------------- */

const COLUMNS = [
  { id: "saved", title: "Saved", dot: "bg-subtle" },
  { id: "applied", title: "Applied", dot: "bg-brand" },
  { id: "interview", title: "Interview", dot: "bg-warning" },
  { id: "offer", title: "Offer", dot: "bg-success" },
] as const;
type Column = (typeof COLUMNS)[number]["id"];

const START_CARDS: { id: string; role: string; company: string; column: Column }[] = [
  { id: "a", role: "Frontend Developer", company: "Kalye Labs", column: "saved" },
  { id: "b", role: "React Native Developer", company: "Tala Health", column: "saved" },
  { id: "c", role: "Full Stack Developer", company: "Northwind Digital", column: "applied" },
  { id: "d", role: "Backend Engineer", company: "Harbour Bank", column: "applied" },
  { id: "e", role: "Product Designer", company: "Bayani Studio", column: "interview" },
];

function PipelineDemo() {
  const reduce = useReducedMotion();
  const [cards, setCards] = useState(START_CARDS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);

  const order: Column[] = COLUMNS.map((c) => c.id);
  const reached = (col: Column) => cards.filter((c) => order.indexOf(c.column) >= order.indexOf(col)).length;
  const applied = reached("applied");
  const responses = reached("interview");

  function move(id: string, column: Column) {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, column } : c)));
  }

  return (
    <div className="flex h-full flex-col">
      <DemoHeader title="Pipeline" hint="Drag a card, or use →" />
      <div className="grid grid-cols-3 border-b border-border text-center">
        <Stat label="Applied" value={applied} />
        <Stat label="Interviews" value={responses} />
        <Stat label="Response rate" value={applied ? `${Math.round((responses / applied) * 100)}%` : "–"} />
      </div>
      <LayoutGroup id="pipeline-demo">
        <div className="grid flex-1 grid-cols-2 gap-1.5 p-2 sm:grid-cols-4">
          {COLUMNS.map((col) => {
            const colCards = cards.filter((c) => c.column === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  if (dragId) move(dragId, col.id);
                  setDragId(null);
                  setOver(null);
                }}
                className={cn(
                  "flex min-h-40 flex-col rounded-lg border bg-surface-2/60 p-1.5 transition-colors",
                  over === col.id ? "border-brand/50 bg-brand-soft/60" : dragId ? "border-dashed border-border-strong" : "border-border",
                )}
              >
                <p className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1.5 text-xs font-medium">
                  <span className={cn("size-1.5 rounded-full", col.dot)} />
                  {col.title}
                  <span className="ml-auto text-[11px] text-subtle tabular-nums">{colCards.length}</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  {colCards.map((card) => {
                    const next = order[order.indexOf(card.column) + 1];
                    return (
                      // motion owns the onDrag* props, so native drag-and-drop lives on the inner element.
                      <motion.article key={card.id} layoutId={reduce ? undefined : `card-${card.id}`} transition={{ duration: 0.3, ease }}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", card.id);
                            setDragId(card.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOver(null);
                          }}
                          className={cn(
                            "group cursor-grab rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-soft)] active:cursor-grabbing",
                            dragId === card.id && "opacity-40",
                          )}
                        >
                        <p className="text-xs leading-snug font-medium">{card.role}</p>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <p className="truncate text-[11px] text-subtle">{card.company}</p>
                          {next ? (
                            <button
                              type="button"
                              onClick={() => move(card.id, next)}
                              aria-label={`Move to ${COLUMNS.find((c) => c.id === next)?.title}`}
                              className="grid size-5 shrink-0 place-items-center rounded text-subtle hover:bg-surface-3 hover:text-fg"
                            >
                              <ArrowRight className="size-3" />
                            </button>
                          ) : (
                            <span className="rounded bg-success-soft px-1 text-[10px] font-medium text-success">Offer</span>
                          )}
                        </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>
      <div className="flex justify-end border-t border-border px-4 py-2">
        <button type="button" onClick={() => setCards(START_CARDS)} className="text-[11px] text-subtle hover:text-fg">
          Reset board
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-r border-border px-2 py-2.5 last:border-r-0">
      <motion.p key={String(value)} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-base font-semibold tabular-nums">
        {value}
      </motion.p>
      <p className="text-[11px] text-subtle">{label}</p>
    </div>
  );
}

/* Privacy -------------------------------------------------------------------- */

const PROVIDERS = [
  { id: "ollama", label: "Ollama", note: "A free model on your computer", local: true, icon: Cpu },
  { id: "claude", label: "Claude", note: "Anthropic, with your API key", local: false, icon: Bot },
  { id: "openai", label: "OpenAI", note: "Or any compatible API, your key", local: false, icon: Cloud },
  { id: "none", label: "No AI", note: "Matching still works, offline", local: true, icon: ShieldCheck },
] as const;

function PrivacyDemo() {
  const [providerId, setProviderId] = useState<(typeof PROVIDERS)[number]["id"]>("ollama");
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const hasAi = provider.id !== "none";

  const aiNode = (
    <motion.div
      layoutId="ai-node"
      transition={{ duration: 0.45, ease }}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-soft)]"
    >
      <provider.icon className="size-4 text-brand" strokeWidth={1.75} />
      <span>
        <span className="block text-xs font-medium">{provider.label}</span>
        <span className="block text-[10px] text-subtle">{provider.local ? "Runs locally" : "Your key, your account"}</span>
      </span>
    </motion.div>
  );

  return (
    <div className="flex h-full flex-col">
      <DemoHeader title="Where your data goes" hint="Pick an AI provider" />
      <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === providerId}
            onClick={() => setProviderId(p.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              p.id === providerId ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <LayoutGroup id="privacy-demo">
        <div className="flex flex-1 flex-col items-stretch justify-center gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
          {/* The visitor's device */}
          <div className="flex-1 rounded-xl border border-dashed border-border-strong p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <Laptop className="size-3.5" /> Your device
            </p>
            <div className="flex flex-col gap-2">
              <Node icon={FileText} title="Your CV & profile" note="Stored on this device" />
              <Node icon={Target} title="HireMe" note="Search, scores, pipeline" />
              {hasAi && provider.local && aiNode}
            </div>
          </div>

          {hasAi && !provider.local ? (
            <>
              <Connector />
              <div className="flex flex-col items-center gap-1.5 sm:w-44">
                {aiNode}
                <p className="text-center text-[10px] text-subtle">Only the job and your profile, sent with your key</p>
              </div>
            </>
          ) : (
            <motion.p
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-brand-ink sm:w-44"
            >
              <ShieldCheck className="size-4" /> Nothing leaves your device
            </motion.p>
          )}
        </div>
      </LayoutGroup>

      <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted">
        <Lock className="size-3 shrink-0 text-brand" /> HireMe has no servers that see your data, in every mode. {provider.note}.
      </p>
    </div>
  );
}

function Node({ icon: Icon, title, note }: { icon: typeof Target; title: string; note: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/70 px-3 py-2">
      <Icon className="size-4 text-muted" strokeWidth={1.75} />
      <span>
        <span className="block text-xs font-medium">{title}</span>
        <span className="block text-[10px] text-subtle">{note}</span>
      </span>
    </div>
  );
}

/** A dashed line with data flowing along it (vertical on phones). */
function Connector() {
  return (
    <>
      <svg aria-hidden className="mx-auto h-10 w-2 shrink-0 sm:hidden" viewBox="0 0 2 40">
        <line x1="1" y1="0" x2="1" y2="40" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_0.6s_linear_infinite] motion-reduce:animate-none" />
      </svg>
      <svg aria-hidden className="hidden h-2 w-16 shrink-0 sm:block" viewBox="0 0 64 2">
        <line x1="0" y1="1" x2="64" y2="1" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_0.6s_linear_infinite] motion-reduce:animate-none" />
      </svg>
    </>
  );
}

/* Tailor & apply ------------------------------------------------------------- */

const CV_BEFORE = {
  headline: "Frontend Developer",
  bullets: ["Built the customer dashboard used by 40,000 merchants", "Wrote unit tests and reviewed pull requests"],
};
const CV_AFTER = {
  headline: "React Developer (Next.js)",
  bullets: [
    "Built the customer dashboard in React and TypeScript, used by 40,000 merchants",
    "Wrote Jest unit tests and reviewed pull requests for a team of 5",
  ],
};
const LETTER = [
  "I'm applying for the React Developer role at Kalye Labs. For the past four years I've built customer-facing web apps in React and TypeScript, most recently a dashboard used by 40,000 merchants.",
  "Your posting asks for Next.js and a habit of testing. I write Jest tests for everything I ship, and I'd welcome the chance to talk about your storefront.",
];

type Step = "idle" | "working" | "done";

function KitDemo() {
  const [cv, setCv] = useState<Step>("idle");
  const [letter, setLetter] = useState<Step>("idle");
  const [copied, setCopied] = useState(false);

  // Pretend generation: in HireMe this is your own AI provider, given your profile and the posting.
  const run = (set: (s: Step) => void) =>
    new Promise<void>((resolve) => {
      set("working");
      setTimeout(() => {
        set("done");
        resolve();
      }, 1100);
    });

  async function prepareAll() {
    if (cv !== "done") await run(setCv);
    if (letter !== "done") await run(setLetter);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Dear Hiring Manager,\n\n${LETTER.join("\n\n")}\n\nSincerely,\nJuan dela Cruz`);
      setCopied(true);
    } catch {}
  }

  const busy = cv === "working" || letter === "working";
  const shown = cv === "done" ? CV_AFTER : CV_BEFORE;

  return (
    <div className="flex h-full flex-col">
      <DemoHeader title="React Developer · Kalye Labs" hint="Prepare your application" />
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-[13px] font-medium">Your application kit</p>
        <DemoButton onClick={() => void prepareAll()} disabled={busy || (cv === "done" && letter === "done")} primary>
          <Sparkles className="size-3.5" /> Prepare all with AI
        </DemoButton>
      </div>

      <div className="grid flex-1 sm:grid-cols-2">
        {/* CV */}
        <div className="flex flex-col gap-2.5 border-b border-border p-4 sm:border-r sm:border-b-0">
          <KitTitle icon={FileText} title="Tailored CV" done={cv === "done"} />
          <div className="rounded-lg border border-border bg-surface-2/60 p-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={cv === "done" ? "after" : "before"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs font-semibold">{shown.headline}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {shown.bullets.map((b) => (
                    <li key={b} className="flex gap-1.5 text-[11px] leading-snug text-muted">
                      <span className="mt-[5px] size-1 shrink-0 rounded-full bg-subtle" /> {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>
          {cv === "done" ? (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1">
              {["React", "Next.js", "TypeScript", "Jest"].map((k) => (
                <span key={k} className="inline-flex items-center gap-0.5 rounded-md bg-success-soft px-1.5 py-px text-[10px] font-medium text-success">
                  <Check className="size-2.5" strokeWidth={3} /> {k}
                </span>
              ))}
              <span className="rounded-md border border-border px-1.5 py-px text-[10px] font-medium text-subtle">Not in your profile: GraphQL</span>
            </motion.div>
          ) : (
            <p className="text-[11px] text-subtle">From your profile. Tailoring uses only facts you&apos;ve given.</p>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5">
            <DemoButton onClick={() => void run(setCv)} disabled={busy || cv === "done"} primary={cv !== "done"}>
              {cv === "working" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {cv === "working" ? "Tailoring…" : cv === "done" ? "Tailored" : "Tailor with AI"}
            </DemoButton>
            <DemoButton disabled={cv !== "done"} primary={cv === "done"}>
              <Download className="size-3.5" /> ATS-friendly PDF
            </DemoButton>
          </div>
        </div>

        {/* Letter */}
        <div className="flex flex-col gap-2.5 p-4">
          <KitTitle icon={Mail} title="Cover letter" done={letter === "done"} />
          <div className="min-h-24 rounded-lg border border-border bg-surface-2/60 p-3 text-[11px] leading-relaxed text-muted">
            {letter === "done" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1.5">
                <p>Dear Hiring Manager,</p>
                {LETTER.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </motion.div>
            ) : letter === "working" ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Writing from your profile and the posting…
              </span>
            ) : (
              <span className="text-subtle">Not written yet.</span>
            )}
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <DemoButton onClick={() => void run(setLetter)} disabled={busy || letter === "done"} primary={letter !== "done"}>
              <Sparkles className="size-3.5" /> {letter === "done" ? "Written" : "Write with AI"}
            </DemoButton>
            <DemoButton onClick={() => void copy()} disabled={letter !== "done"} primary={letter === "done"}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy text"}
            </DemoButton>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted">
        <ShieldCheck className="size-3 shrink-0 text-brand" /> Every claim is checked against your profile, and the prompts are yours to read and edit.
      </p>
    </div>
  );
}

function KitTitle({ icon: Icon, title, done }: { icon: typeof Target; title: string; done: boolean }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium">
      <span
        className={cn(
          "grid size-6 place-items-center rounded-md border",
          done ? "border-success/30 bg-success-soft text-success" : "border-border text-muted",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={2.5} /> : <Icon className="size-3.5" strokeWidth={1.75} />}
      </span>
      {title}
    </p>
  );
}

function DemoButton({ children, onClick, disabled, primary }: { children: ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50",
        primary ? "bg-brand text-brand-fg hover:bg-brand-hover" : "border border-border text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
