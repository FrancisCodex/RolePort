import { ArrowRight, Check, Flame, Sparkles, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const checklist = [
  { label: "Create your account", done: true },
  { label: "Upload your CV or answer a few questions", done: false, href: "/profile" },
  { label: "Set your preferred roles, city and salary", done: false, href: "/profile" },
  { label: "Review your first matches", done: false, href: "/jobs" },
];

export default function HomePage() {
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);

  return (
    <>
      <Suspense fallback={<div className="mb-8 h-[4.5rem] w-72 animate-pulse rounded-2xl bg-surface-3" />}>
        <Greeting />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold">Finish setting up</p>
                <p className="text-sm text-muted">
                  {done} of {checklist.length} done. Matches unlock once your profile is ready.
                </p>
              </div>
              <span className="font-display text-2xl font-bold text-brand tabular-nums">{pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-1">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href ?? "/home"}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                      item.done ? "pointer-events-none text-subtle line-through" : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border-2",
                        item.done ? "border-success bg-success text-white" : "border-border-strong",
                      )}
                    >
                      {item.done && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {!item.done && <ArrowRight className="size-4 text-subtle" />}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
                <Flame className="size-6" fill="currentColor" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold">1 day</p>
                <p className="text-sm text-muted">Job hunt streak</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
                <Target className="size-6" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold">—</p>
                <p className="text-sm text-muted">Matches this week</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden border-none bg-brand text-brand-fg">
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Sparkles className="size-8 shrink-0" />
            <div>
              <p className="font-display text-lg font-semibold">Let AI build your profile</p>
              <p className="text-sm text-white/80">Upload your CV and we&apos;ll pull out your skills and experience.</p>
            </div>
          </div>
          <Link
            href="/profile"
            className={cn(buttonVariants(), "bg-white text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.2)] hover:bg-white/90")}
          >
            Upload CV
          </Link>
        </CardContent>
      </Card>
    </>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.name.split(" ")[0];
  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-muted">Mabuhay! 👋</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Hi {firstName}, let&apos;s find your next role</h1>
    </div>
  );
}
