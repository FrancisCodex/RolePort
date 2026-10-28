import { ArrowRight, BarChart3, Bot, FileText, Globe, Lock, Mail, MessageSquareText, MessagesSquare, ScrollText, Search, Send, UserRound } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CommandHint } from "@/components/marketing/command-menu";
import { FeatureTabs } from "@/components/marketing/feature-demos";
import { DotBackground } from "@/components/marketing/dot-background";
import { Reveal } from "@/components/marketing/landing-motion";
import { ProductDemo } from "@/components/marketing/product-demo";
import { GitHubMark, REPO_URL, SetupGuide } from "@/components/marketing/setup-guide";
import { buttonVariants } from "@/components/ui/button";
import { isLite, liteUrl } from "@/lib/mode";
import { cn } from "@/lib/utils";

const places = ["Philippines", "Singapore", "Australia", "United Kingdom", "United States", "Canada", "UAE", "India", "Japan", "Germany", "Remote"];

const steps = [
  {
    icon: UserRound,
    title: "Build your profile",
    body: "Import your CV and RolePort picks out your skills, experience and languages. Set where you live and the countries you'd move to.",
  },
  {
    icon: Search,
    title: "Search and score",
    body: "Search jobs in your country, abroad or remote. Every result gets a match score, and your AI can explain the fit in detail.",
  },
  {
    icon: Send,
    title: "Apply with everything ready",
    body: "Press Apply and get a page for that job: tailor your CV, write the cover letter, then track it from Applied to Offer.",
  },
];

/** The features the interactive tabs don't already show. */
const moreFeatures = [
  {
    icon: Globe,
    title: "Search anywhere, once",
    body: "Jobs from freehire, Jobicy, JSearch and JobSpy (LinkedIn, Indeed, Glassdoor and more), with the same opening shown once even when it's on several boards.",
  },
  { icon: Bot, title: "Bring your own AI", body: "Claude, OpenAI, OpenRouter, Groq, or a free local model through Ollama." },
  {
    icon: FileText,
    title: "ATS-friendly tailored CV",
    body: "Rewritten for each job from your real experience, checked for anything it can't back up, and downloaded as a PDF that applicant tracking systems can read.",
  },
  {
    icon: Mail,
    title: "Cover letters in a click",
    body: "Written from your profile and the posting, checked for clichés and claims you didn't make. Copy it into the form or download it.",
  },
  {
    icon: ScrollText,
    title: "Prompts you can read",
    body: "See exactly what's sent to the AI, change how your CV, letters and answers are written, or go back to the default.",
  },
  { icon: MessageSquareText, title: "Application answers", body: "Paste a question from the application form and get an answer from your real experience, with what it leans on and what to check." },
  { icon: MessagesSquare, title: "Interview coach", body: "Coming next: prep packs and mock interviews built from the job you applied to.", soon: true },
  { icon: BarChart3, title: "Skill gap insights", body: "Planned: the skills employers keep asking for, and a plan to learn them.", soon: true },
  {
    icon: Lock,
    title: "Private by default",
    body: isLite
      ? "Your CV, profile and keys stay in your browser, on your device. No account needed."
      : "Your CV, profile and keys live in a database on your machine. No account needed.",
  },
];

const afterInstall = [
  "Open localhost:3000 in your browser and click Open RolePort.",
  "In Profile, import your CV and set the countries you're searching in.",
  "Optional: in Settings, pick an AI provider and turn on more job sources.",
];

/** Small monospace section label, the way developer tools title their sections. */
function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs text-subtle">{children}</p>;
}

/** Headline words that rise into place one after another (pure CSS, so it plays before hydration). */
function RiseWords({ text, from = 0 }: { text: string; from?: number }) {
  return text.split(" ").map((word, i) => (
    <span
      key={`${word}-${i}`}
      className="inline-block animate-[rise_0.8s_var(--ease-snappy)_both] whitespace-pre"
      style={{ animationDelay: `${(from + i) * 70}ms` } as CSSProperties}
    >
      {word}{" "}
    </span>
  ));
}

export default function LandingPage() {
  const lead = "Your job search,";
  const tail = isLite ? "right in your browser." : "on your own machine.";

  return (
    <>
      {/* Hero: pitch, then the product itself, live. */}
      <DotBackground variant="hero" className="-mt-14 overflow-hidden border-b border-border pt-14">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 text-center sm:px-6 md:pt-24">
          <a
            href={REPO_URL}
            className="inline-flex animate-[rise_0.6s_var(--ease-snappy)_both] items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-2 text-xs font-medium text-muted shadow-[var(--shadow-soft)] hover:text-fg"
          >
            <span className="size-1.5 rounded-full bg-brand" />
            Free and open source · MIT licence
            <ArrowRight className="size-3" />
          </a>
          {/* The dotted background stays clear in a soft oval round the headline and copy. */}
          <div data-dots-clear className="flex flex-col items-center">
            <h1 className="mt-6 max-w-3xl text-[2.6rem] leading-[1.03] font-semibold tracking-[-0.04em] text-balance sm:text-6xl md:text-[4.25rem]">
              <RiseWords text={lead} />
              <span className="text-muted">
                <RiseWords text={tail} from={lead.split(" ").length} />
              </span>
            </h1>
            <p
              className="mt-5 max-w-xl animate-[rise_0.8s_var(--ease-snappy)_both] text-base text-muted text-pretty [animation-delay:400ms] sm:text-[17px] sm:leading-relaxed"
            >
              RolePort finds jobs in your country or abroad, scores how well each one fits you, tailors your CV and cover letter for each one, and
              tracks every application.{" "}
              {isLite ? "Nothing to install: your data stays in your browser." : "Your CV and data never leave your computer."}
            </p>
          </div>
          <div className="mt-8 flex animate-[rise_0.8s_var(--ease-snappy)_both] flex-wrap justify-center gap-2 [animation-delay:500ms]">
            {isLite ? (
              <>
                <Link href="/home" className={buttonVariants({ size: "lg" })}>
                  Try it in your browser
                  <ArrowRight />
                </Link>
                <a href="#get-started" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                  Install on your computer
                </a>
              </>
            ) : (
              <>
                <a href="#get-started" className={buttonVariants({ size: "lg" })}>
                  Get started
                  <ArrowRight />
                </a>
                {liteUrl && (
                  <a href={`${liteUrl}/home`} className={buttonVariants({ size: "lg", variant: "secondary" })}>
                    Try it in your browser
                  </a>
                )}
                <a href={REPO_URL} className={buttonVariants({ size: "lg", variant: liteUrl ? "ghost" : "secondary" })}>
                  <GitHubMark />
                  View on GitHub
                </a>
              </>
            )}
          </div>
          <CommandHint className="mt-5 animate-[rise_0.8s_var(--ease-snappy)_both] [animation-delay:600ms]" />
        </section>

        <div className="relative mx-auto mt-14 max-w-5xl px-4 pb-16 sm:px-6 md:mt-16 md:pb-24">
          <p className="mb-3 text-center text-xs text-subtle">
            This is a live demo with sample jobs. Search, filter, open a job and save it.
          </p>
          <Reveal delay={0.35}>
            <ProductDemo />
          </Reveal>
        </div>
      </DotBackground>

      {/* Countries marquee */}
      <section className="border-b border-border py-5" aria-label="Countries you can search">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-[marquee_45s_linear_infinite] gap-10 pr-10 text-[13px] text-subtle hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...places, ...places].map((p, i) => (
              <span key={i} aria-hidden={i >= places.length || undefined} className="flex items-center gap-10 whitespace-nowrap">
                {p}
                <span className="size-1 rounded-full bg-border-strong" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal>
          <Eyebrow>01 · Try it here</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
            See how it works before you install anything
          </h2>
          <p className="mt-3 max-w-xl text-muted">Everything below is interactive. Click around.</p>
        </Reveal>
        <Reveal className="mt-10" delay={0.1}>
          <FeatureTabs />
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-sidebar py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <Eyebrow>02 · How it works</Eyebrow>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
              From CV to offer in three steps
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08}>
                <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong">
                  <span className="absolute top-4 right-5 font-mono text-5xl font-semibold text-surface-3 transition-colors group-hover:text-brand/25">
                    {i + 1}
                  </span>
                  <span className="grid size-8 place-items-center rounded-md border border-border bg-surface-2 text-muted transition-colors group-hover:border-brand/40 group-hover:text-brand">
                    <step.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-[15px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Everything else */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <Eyebrow>03 · And more</Eyebrow>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
            Built for a calm, thorough job hunt
          </h2>
        </Reveal>
        <Reveal className="mt-12" delay={0.1}>
          <div className="grid overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 sm:gap-px lg:grid-cols-3">
            {moreFeatures.map((f) => (
              <div key={f.title} className="border-b border-border bg-surface p-5 transition-colors last:border-b-0 hover:bg-surface-2 sm:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <f.icon className={cn("size-[18px]", f.soon ? "text-subtle" : "text-brand")} strokeWidth={1.75} />
                  {f.soon && <span className="rounded-md border border-border px-1.5 py-px text-[11px] font-medium text-subtle">Soon</span>}
                </div>
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-[13px] text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Get started: self-hosting */}
      <section id="get-started" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal className="min-w-0">
            <Eyebrow>04 · {isLite ? "Install" : "Get started"}</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
              {isLite ? "Prefer your own install?" : "Run RolePort on your computer"}
            </h2>
            <p className="mt-4 text-muted text-pretty sm:text-base">
              {isLite
                ? "The installed version keeps your data in a database on your computer, so it's not tied to one browser. Move over any time with a backup from Settings. It takes a few commands and about five minutes."
                : "Every feature works on your own install, with no sign-in. It takes a few commands and about five minutes."}
            </p>
            <ol className="mt-8 flex flex-col gap-3">
              {afterInstall.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-muted">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-2">
              <a href={`${REPO_URL}#quick-start`} className={buttonVariants({ variant: "secondary" })}>
                <GitHubMark />
                Full setup guide
              </a>
              <Link href="/home" className={buttonVariants({ variant: "ghost" })}>
                Already installed? Open RolePort
                <ArrowRight />
              </Link>
            </div>
          </Reveal>
          <Reveal className="min-w-0" delay={0.1}>
            <SetupGuide />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <DotBackground variant="calm" className="overflow-hidden rounded-xl border border-border bg-surface px-6 py-20 text-center sm:px-16">
            <div data-dots-clear>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">Your next job, found your way</h2>
              <p className="mx-auto mt-4 max-w-md text-muted">
                Free, open source and private. Start in your browser in seconds, or install it in five minutes.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Link href="/home" className={buttonVariants({ size: "lg" })}>
                Open RolePort
                <ArrowRight />
              </Link>
              <a href={REPO_URL} className={buttonVariants({ size: "lg", variant: "secondary" })}>
                <GitHubMark />
                Contribute on GitHub
              </a>
            </div>
            <CommandHint className="mt-5" />
          </DotBackground>
        </Reveal>
      </section>
    </>
  );
}
