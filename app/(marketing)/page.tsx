import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  Globe,
  KanbanSquare,
  Lock,
  MessagesSquare,
  Search,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { HeroCards } from "@/components/marketing/hero-cards";
import { GitHubMark, REPO_URL, SetupGuide } from "@/components/marketing/setup-guide";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const places = ["Philippines", "Singapore", "Australia", "United Kingdom", "United States", "Canada", "UAE", "India", "Remote"];

const steps = [
  {
    icon: UserRound,
    title: "Build your profile",
    body: "Import your CV and HireMe picks out your skills, experience and languages. Set where you live and the countries you'd move to.",
  },
  {
    icon: Search,
    title: "Search and score",
    body: "Search jobs in your country, abroad or remote. Every result gets a match score, and your AI can explain the fit in detail.",
  },
  {
    icon: KanbanSquare,
    title: "Track every application",
    body: "Save the jobs worth your time and move them from Saved to Applied, Interview and Offer as things happen.",
  },
];

const features = [
  { icon: Target, title: "Honest match scores", body: "See why a job fits, and what's missing, before you spend time applying.", tone: "bg-brand-soft text-brand-ink" },
  { icon: Globe, title: "Search anywhere", body: "Jobs from freehire, Jobicy, JSearch and JobSpy, filtered by the country you choose.", tone: "bg-success-soft text-success" },
  { icon: Bot, title: "Bring your own AI", body: "Claude, OpenAI, OpenRouter, Groq, or a free local model through Ollama.", tone: "bg-warning-soft text-warning" },
  { icon: Lock, title: "Private by default", body: "Your CV, profile and keys live in a database on your machine. No account needed.", tone: "bg-brand-soft text-brand-ink" },
  { icon: KanbanSquare, title: "Application pipeline", body: "A drag-and-drop board for every job you save, from first look to offer.", tone: "bg-success-soft text-success" },
  { icon: FileText, title: "Tailored CV & cover letter", body: "Coming next: ATS-friendly documents written from your real experience.", tone: "bg-warning-soft text-warning", soon: true },
  { icon: MessagesSquare, title: "Interview coach", body: "Coming next: prep packs and mock interviews built from the job you applied to.", tone: "bg-brand-soft text-brand-ink", soon: true },
  { icon: BarChart3, title: "Skill gap insights", body: "Planned: the skills employers keep asking for, and a plan to learn them.", tone: "bg-success-soft text-success", soon: true },
];

const afterInstall = [
  "Open localhost:3000 in your browser and click Open HireMe.",
  "In Profile, import your CV and set the countries you're searching in.",
  "Optional: in Settings, pick an AI provider and turn on more job sources.",
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
            <a
              href={REPO_URL}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-[var(--shadow-soft)] hover:text-fg"
            >
              <span className="size-1.5 rounded-full bg-success" />
              Free and open source · MIT licence
            </a>
            <h1 className="mt-6 font-display text-[2.6rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
              Your job search, <span className="text-brand">on your own machine.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted text-pretty">
              HireMe finds jobs in your country or abroad, scores how well each one fits you, and tracks every
              application. Your CV and data never leave your computer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#get-started" className={buttonVariants({ size: "lg" })}>
                Get started
                <ArrowRight />
              </a>
              <a href={REPO_URL} className={buttonVariants({ size: "lg", variant: "secondary" })}>
                <GitHubMark />
                View on GitHub
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-subtle">
              <Lock className="size-4" />
              No account, no subscription. Bring your own AI, or none at all.
            </p>
          </div>
          <HeroCards />
        </div>
      </section>

      {/* Countries strip */}
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
          From CV to offer in three steps
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
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl border border-border bg-surface p-7 transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("grid size-11 place-items-center rounded-2xl", f.tone)}>
                    <f.icon className="size-5" />
                  </span>
                  {f.soon && (
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-subtle">Soon</span>
                  )}
                </div>
                <h3 className="mt-5 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get started: self-hosting */}
      <section id="get-started" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wider text-brand uppercase">Get started</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-balance">
              Run HireMe on your computer
            </h2>
            <p className="mt-4 text-lg text-muted text-pretty">
              Every feature works on your own install, with no sign-in. It takes a few commands and about five minutes.
            </p>
            <ol className="mt-8 flex flex-col gap-4">
              {afterInstall.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand-ink">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-muted">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`${REPO_URL}#quick-start`} className={buttonVariants({ variant: "secondary" })}>
                <GitHubMark />
                Full setup guide
              </a>
              <Link href="/home" className={buttonVariants({ variant: "ghost" })}>
                Already installed? Open HireMe
                <ArrowRight />
              </Link>
            </div>
          </div>
          <SetupGuide />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center text-brand-fg sm:px-16">
          <div aria-hidden className="absolute -top-24 -left-24 size-72 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -right-16 -bottom-28 size-80 rounded-full bg-white/10" />
          <h2 className="relative font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Built in the open
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-lg text-white/80">
            Add a job source for your country, improve a provider, or polish the UI. Contributions are welcome.
          </p>
          <a
            href={REPO_URL}
            className={cn(
              buttonVariants({ size: "lg" }),
              "relative mt-8 bg-white text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.2)] hover:bg-white/90",
            )}
          >
            <GitHubMark />
            Contribute on GitHub
          </a>
        </div>
      </section>
    </>
  );
}
