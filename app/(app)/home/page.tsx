import { ArrowRight, Bookmark, Check, Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai/config";
import { countMyApplications } from "@/lib/jobs/data";
import { getMyProfile } from "@/lib/profile/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const [{ profile, hasCv, isComplete }, saved, aiEnabled] = await Promise.all([
    getMyProfile(),
    countMyApplications(),
    isAiConfigured(),
  ]);
  const firstName = profile.name.split(" ")[0] || "there";
  const firstRole = profile.desiredRoles[0];

  const checklist = [
    { label: "Import your CV", done: hasCv, href: "/profile" },
    { label: "Add your skills and the roles you want", done: isComplete, href: "/profile" },
    { label: "Search for jobs", done: saved > 0, href: firstRole ? `/jobs?q=${encodeURIComponent(firstRole)}` : "/jobs" },
    { label: "Save a job to your pipeline", done: saved > 0, href: "/jobs" },
  ];
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-semibold text-muted">Mabuhay! 👋</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hi {firstName}, let&apos;s find your next role</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold">{pct === 100 ? "You're all set" : "Getting started"}</p>
                <p className="text-sm text-muted">
                  {done} of {checklist.length} done
                </p>
              </div>
              <span className="font-display text-2xl font-bold text-brand tabular-nums">{pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-1">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2",
                      item.done && "text-subtle",
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
                    <span className={cn("flex-1 font-medium", item.done && "line-through")}>{item.label}</span>
                    {!item.done && <ArrowRight className="size-4 text-subtle" />}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Link href={firstRole ? `/jobs?q=${encodeURIComponent(firstRole)}` : "/jobs"} className="group">
            <Card className="transition-shadow group-hover:shadow-[var(--shadow-lift)]">
              <CardContent className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
                  <Search className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">Find jobs</p>
                  <p className="truncate text-sm text-muted">{firstRole ? `Search “${firstRole}”` : "Search across the Philippines"}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/pipeline" className="group">
            <Card className="transition-shadow group-hover:shadow-[var(--shadow-lift)]">
              <CardContent className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
                  <Bookmark className="size-6" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums">{saved}</p>
                  <p className="text-sm text-muted">In your pipeline</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {!hasCv && (
        <Card className="mt-4 overflow-hidden border-none bg-brand text-brand-fg">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Sparkles className="size-8 shrink-0" />
              <div>
                <p className="font-display text-lg font-semibold">Start from your CV</p>
                <p className="text-sm text-white/80">
                  {aiEnabled
                    ? "Upload it and AI fills in your whole profile."
                    : "Upload it and we'll pick out your skills for you."}
                </p>
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
      )}
    </>
  );
}
