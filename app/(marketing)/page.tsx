import {
  ArrowRight,
  BarChart3,
  FileText,
  Flame,
  KanbanSquare,
  MessagesSquare,
  Search,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { HeroCards } from "@/components/marketing/hero-cards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const places = ["Metro Manila", "BGC", "Makati", "Ortigas", "Cebu IT Park", "Davao", "Iloilo", "Clark", "Remote"];

const steps = [
  {
    icon: UserRound,
    title: "Build your profile",
    body: "Upload your CV or answer a few quick questions. We turn it into a profile that knows your skills, goals, and deal-breakers.",
  },
  {
    icon: Search,
    title: "Get matched",
    body: "We search jobs across the Philippines and score each one on skills, experience, culture, career fit, and location.",
  },
  {
    icon: FileText,
    title: "Apply with confidence",
    body: "One tap tailors your CV and cover letter to the role, then a second AI reviewer checks it before you send.",
  },
];

const features = [
  { icon: Target, title: "Honest match scores", body: "See why a job fits, and what's missing, before you spend time applying.", tone: "bg-brand-soft text-brand-ink" },
  { icon: FileText, title: "Tailored CV & cover letter", body: "ATS-friendly PDFs written from your real experience. Nothing made up.", tone: "bg-success-soft text-success" },
  { icon: KanbanSquare, title: "Application pipeline", body: "Track every application from saved to signed, with follow-up nudges.", tone: "bg-warning-soft text-warning" },
  { icon: MessagesSquare, title: "Interview coach", body: "Prep packs and mock interviews built from the exact job you applied to.", tone: "bg-brand-soft text-brand-ink" },
  { icon: BarChart3, title: "Skill gap insights", body: "Find the skills employers keep asking for and get a learning plan.", tone: "bg-success-soft text-success" },
  { icon: Flame, title: "Daily streaks", body: "Small daily goals keep your job hunt moving, even on busy weeks.", tone: "bg-warning-soft text-warning" },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] bg-[radial-gradient(ellipse_at_top,var(--brand-soft),transparent_65%)]"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-14 pb-20 sm:px-6 md:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex min-w-0 flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-[var(--shadow-soft)]">
              <span className="size-1.5 rounded-full bg-success" />
              Now matching jobs across the Philippines 🇵🇭
            </span>
            <h1 className="mt-6 font-display text-[2.6rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
              Your next job, <span className="text-brand">matched</span> to you.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted text-pretty">
              HireMe finds the roles that actually fit, tells you why, and tailors your CV and cover letter in seconds.
              Less scrolling, more interviews.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Start for free
                <ArrowRight />
              </Link>
              <a href="#how" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                See how it works
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-subtle">
              <ShieldCheck className="size-4" />
              Your CV stays private. We never apply without you.
            </p>
          </div>
          <HeroCards />
        </div>
      </section>

      {/* Places marquee */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm font-semibold text-subtle sm:px-6">
          {places.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <p className="text-sm font-semibold tracking-wider text-brand uppercase">How it works</p>
        <h2 className="mt-2 max-w-xl font-display text-4xl font-bold tracking-tight text-balance">
          From profile to offer in three steps
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="rounded-3xl border border-border bg-surface p-7 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-fg shadow-[var(--shadow-press)]">
                  <step.icon className="size-5" />
                </span>
                <span className="font-display text-5xl font-bold text-surface-3">{i + 1}</span>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-surface-2/60 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold tracking-wider text-brand uppercase">Features</p>
          <h2 className="mt-2 max-w-xl font-display text-4xl font-bold tracking-tight text-balance">
            Everything your job hunt needs, in one calm place
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl border border-border bg-surface p-7 transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              >
                <span className={cn("grid size-11 place-items-center rounded-2xl", f.tone)}>
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center text-brand-fg sm:px-16">
          <div aria-hidden className="absolute -top-24 -left-24 size-72 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -right-16 -bottom-28 size-80 rounded-full bg-white/10" />
          <h2 className="relative font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Ready to get hired?
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-lg text-white/80">
            Set up your profile in about three minutes and see today&apos;s matches.
          </p>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ size: "lg" }),
              "relative mt-8 bg-white text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.2)] hover:bg-white/90",
            )}
          >
            Create my free account
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
