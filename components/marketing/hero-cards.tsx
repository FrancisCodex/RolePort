"use client";

import { Bookmark, Briefcase, Flame, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { MatchRing } from "@/components/ui/match-ring";

const jobs = [
  { title: "Frontend Engineer", company: "Kalye Labs", place: "Makati · Hybrid", pay: "₱90k–₱130k / mo", score: 94 },
  { title: "Data Analyst", company: "Isla Bank", place: "Cebu IT Park · Onsite", pay: "₱55k–₱75k / mo", score: 81 },
  { title: "Customer Success Lead", company: "Tala Health", place: "Remote · PH", pay: "₱60k–₱85k / mo", score: 68 },
];

const spring = { type: "spring", stiffness: 260, damping: 22 } as const;

export function HeroCards() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-md">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12, rotate: 6 }}
        animate={{ opacity: 1, y: 0, rotate: 4 }}
        transition={{ ...spring, delay: 0.5 }}
        className="absolute -top-6 right-0 z-20 flex items-center gap-2 rounded-2xl bg-surface px-3.5 py-2 text-sm font-bold shadow-[var(--shadow-lift)] sm:-right-8"
      >
        <Flame className="size-4 text-warning" fill="currentColor" />
        7-day streak
      </motion.div>

      <div className="flex flex-col gap-3">
        {jobs.map((job, i) => (
          <motion.article
            key={job.title}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.1 + i * 0.12 }}
            whileHover={reduce ? undefined : { y: -3 }}
            className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5"
            style={{ marginLeft: `${i * 6}%`, marginRight: `${(2 - i) * 6}%` }}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
              <Briefcase className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{job.title}</p>
              <p className="truncate text-sm text-muted">{job.company}</p>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-subtle">
                <MapPin className="size-3 shrink-0" />
                {job.place} · {job.pay}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MatchRing score={job.score} size={48} />
            </div>
            <Bookmark className="hidden size-5 shrink-0 text-subtle sm:block" />
          </motion.article>
        ))}
      </div>
    </div>
  );
}
