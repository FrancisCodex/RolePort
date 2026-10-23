"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Briefcase,
  Check,
  FileUp,
  HardDriveDownload,
  KanbanSquare,
  KeyRound,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Target,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { CountryPicker, mergeDraft, SORTED_COUNTRIES } from "@/app/(app)/profile/profile-editor";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TagInput, ToggleGroup } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { importCv, saveProfile, setOnboardingStep } from "@/lib/client/mutations";
import { countryName } from "@/lib/geo/countries";
import { normalizeProfileDates } from "@/lib/profile/dates";
import type { ProfileInput } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";

/** profile.onboarding_step when the guide is finished or skipped (lib/profile/queries.ts). */
const DONE = 100;
const LAST = 5;
const STEP_NAMES = ["About you", "What you want", "Your CV", "AI", "Ready"];

type Status = { tone: "error" | "info" | "success"; text: string } | null;

export type OnboardingData = {
  profile: ProfileInput;
  cvFileName: string | null;
  aiEnabled: boolean;
  /** Where the user left off (0-5), or 0 when revisiting a finished guide. */
  startStep: number;
  /** The guide was finished or skipped before: this is a revisit. */
  done: boolean;
  /** Lite edition: say where data lives. */
  inBrowser: boolean;
};

/** The welcome guide: just enough profile to start searching, then pointers to everything else. */
export function OnboardingFlow({ profile: initial, cvFileName: initialCv, aiEnabled, startStep, done, inBrowser }: OnboardingData) {
  const router = useRouter();
  const [step, setStep] = useState(startStep);
  const [profile, setProfile] = useState(() => normalizeProfileDates(initial));
  const [cvFileName, setCvFileName] = useState(initialCv);
  const [status, setStatus] = useState<Status>(null);
  const [pending, start] = useTransition();
  const [importing, startImport] = useTransition();

  const update = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => setProfile((p) => ({ ...p, [key]: value }));

  function go(next: number) {
    setStatus(null);
    setStep(next);
    // Remember progress, so leaving (e.g. for Settings) resumes here. A finished guide stays finished.
    if (!done) void setOnboardingStep(Math.min(next, LAST));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Validate this step, save the profile, then move on. */
  function next() {
    if (step === 1 && !profile.name.trim()) return setStatus({ tone: "error", text: "Add your name to continue." });
    if (step === 2 && profile.desiredRoles.length === 0) {
      return setStatus({ tone: "error", text: "Add at least one role, so we know what to search for." });
    }
    if (step < 1 || step > 3) return go(step + 1);
    start(async () => {
      const result = await saveProfile(profile);
      if (!result.ok) return setStatus({ tone: "error", text: result.error });
      go(step + 1);
    });
  }

  /** Finish (or skip) the guide and leave for `href`. */
  function finish(href: string) {
    start(async () => {
      await setOnboardingStep(DONE);
      router.push(href);
    });
  }

  function onImport(file: File) {
    setStatus(null);
    const data = new FormData();
    data.set("cv", file);
    startImport(async () => {
      const result = await importCv(data);
      if (!result.ok) return setStatus({ tone: "error", text: result.error });
      setCvFileName(result.data.fileName);
      setProfile((p) => normalizeProfileDates(mergeDraft(p, result.data.draft)));
      const found = result.data.draft.skills?.length ?? 0;
      setStatus({
        tone: "success",
        text: result.data.usedAi
          ? "Read your CV and filled in your profile. Check your skills below."
          : `${result.data.aiError ? `AI couldn't read it (${result.data.aiError}). ` : ""}Found ${found} skill${found === 1 ? "" : "s"} in your CV.`,
      });
    });
  }

  const role = profile.desiredRoles[0];
  const searchHref = role ? `/jobs?q=${encodeURIComponent(role)}&country=${profile.country}` : "/jobs";

  return (
    <div className="flex flex-col gap-6">
      {step > 0 && <Progress step={step} />}

      <Card className="p-6 sm:p-10">
        {step === 0 && (
          <Intro done={done} inBrowser={inBrowser} onStart={() => go(1)} onSkip={() => finish("/home")} pending={pending} />
        )}

        {step === 1 && (
          <Step title="First, a little about you" description="This is how your profile starts. You can change anything later in Profile.">
            <Field label="Your name" htmlFor="ob-name">
              <Input id="ob-name" autoFocus value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Maria Santos" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country you live in" htmlFor="ob-country">
                <Select
                  id="ob-country"
                  value={profile.country}
                  options={SORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                  onValueChange={(code) =>
                    setProfile((p) => ({
                      ...p,
                      country: code,
                      region: code === "PH" ? p.region : null,
                      salaryCurrency: SORTED_COUNTRIES.find((c) => c.code === code)?.currency ?? p.salaryCurrency,
                      targetCountries: p.targetCountries.filter((c) => c !== code),
                    }))
                  }
                />
              </Field>
              <Field label="City (optional)" htmlFor="ob-city">
                <Input id="ob-city" value={profile.city ?? ""} onChange={(e) => update("city", e.target.value || null)} placeholder="e.g. Cebu City" />
              </Field>
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="What are you looking for?" description="We search for these roles and rank every job by how well it fits.">
            <Field label="Roles you want" htmlFor="ob-roles" hint="Press Enter after each one. Add a few, from most to least wanted.">
              <TagInput id="ob-roles" value={profile.desiredRoles} onChange={(v) => update("desiredRoles", v)} placeholder="e.g. Registered Nurse" max={10} />
            </Field>
            <Field label="Work setup">
              <ToggleGroup
                options={[
                  { value: "onsite", label: "Onsite" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "remote", label: "Remote" },
                ]}
                value={profile.workSetups}
                onChange={(v) => update("workSetups", v)}
              />
            </Field>
            <Field label="Other countries you'd work in (optional)" htmlFor="ob-countries" hint="Jobs there are flagged for visa sponsorship instead of ruled out.">
              <CountryPicker id="ob-countries" value={profile.targetCountries} onChange={(v) => update("targetCountries", v)} exclude={profile.country} />
            </Field>
          </Step>
        )}

        {step === 3 && (
          <Step
            title="Add your CV or skills"
            description="Optional, but it's what makes match scores useful. Upload your CV, or type your strongest skills."
          >
            <Dropzone importing={importing} cvFileName={cvFileName} aiEnabled={aiEnabled} onFile={onImport} />
            <Field label="Your strongest skills" htmlFor="ob-skills" hint="What you'd be hired for. Press Enter after each one.">
              <TagInput
                id="ob-skills"
                value={profile.skills.filter((s) => s.level === "primary").map((s) => s.name)}
                onChange={(names) =>
                  update("skills", [
                    ...profile.skills.filter((s) => s.level !== "primary" && !names.some((n) => n.toLowerCase() === s.name.toLowerCase())),
                    ...names.map((name) => ({ name, level: "primary" as const })),
                  ])
                }
                placeholder="e.g. Patient care, IV therapy"
                max={30}
              />
            </Field>
            {profile.skills.some((s) => s.level !== "primary") && (
              <p className="text-sm text-muted">
                Also found:{" "}
                {profile.skills
                  .filter((s) => s.level !== "primary")
                  .map((s) => s.name)
                  .join(", ")}
                . You can sort these in Profile.
              </p>
            )}
          </Step>
        )}

        {step === 4 && <AiStep aiEnabled={aiEnabled} inBrowser={inBrowser} />}

        {step === LAST && (
          <Ready
            role={role}
            country={profile.country}
            aiEnabled={aiEnabled}
            inBrowser={inBrowser}
            pending={pending}
            onSearch={() => finish(searchHref)}
            onHome={() => finish("/home")}
          />
        )}

        {status && (
          <p
            role="status"
            className={cn(
              "mt-6 rounded-2xl px-4 py-3 text-sm font-medium",
              status.tone === "error" && "bg-danger-soft text-danger",
              status.tone === "success" && "bg-success-soft text-success",
              status.tone === "info" && "bg-brand-soft text-brand-ink",
            )}
          >
            {status.text}
          </p>
        )}

        {step > 0 && step < LAST && (
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={pending}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex items-center gap-2">
              {(step === 3 || step === 4) && (
                <Button variant="ghost" onClick={() => go(step + 1)} disabled={pending || importing}>
                  Skip
                </Button>
              )}
              <Button onClick={next} disabled={pending || importing}>
                {pending ? <Loader2 className="animate-spin" /> : null} Continue <ArrowRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {step > 0 && step < LAST && (
        <p className="text-center text-sm text-subtle">
          <button type="button" onClick={() => finish("/home")} className="font-medium hover:text-fg hover:underline" disabled={pending}>
            Skip the rest and go to the dashboard
          </button>
        </p>
      )}
    </div>
  );
}

/* Pieces ------------------------------------------------------------------- */

function Progress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label={`Step ${step} of ${LAST}: ${STEP_NAMES[step - 1]}`}>
      <div className="flex gap-1.5">
        {STEP_NAMES.map((name, i) => (
          <span key={name} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < step ? "bg-brand" : "bg-surface-3")} />
        ))}
      </div>
      <p className="text-xs font-semibold text-muted">
        Step {step} of {LAST} · {STEP_NAMES[step - 1]}
      </p>
    </div>
  );
}

function Step({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="mt-2 text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Intro({ done, inBrowser, onStart, onSkip, pending }: { done: boolean; inBrowser: boolean; onStart: () => void; onSkip: () => void; pending: boolean }) {
  const points: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Target, title: "Tell us what you want", body: "Your roles, where you'd work, and your skills." },
    { icon: Search, title: "Search and score", body: "Jobs at home or abroad, ranked by how well they fit you." },
    { icon: KanbanSquare, title: "Track every application", body: "From saved to applied to offer, all in one board." },
  ];
  return (
    <div className="flex flex-col items-start gap-6">
      <LogoMark className="size-14 rounded-2xl [&_svg]:size-[60%]" />
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {done ? "Your setup guide" : "Welcome to HireMe"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {done
            ? "Go through it again to update what you're looking for, or to set up more tools."
            : "Let's get you ready to search. It takes about two minutes, and you can skip anything."}
        </p>
      </div>
      <ul className="flex w-full flex-col gap-3">
        {points.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-center gap-4 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      {inBrowser && (
        <p className="flex gap-3 text-sm text-muted">
          <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
          Everything you add stays in this browser, on this device. No account, and nothing is kept on HireMe&apos;s servers.
        </p>
      )}
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={onStart} disabled={pending}>
          {done ? "Start" : "Let's start"} <ArrowRight />
        </Button>
        <Button size="lg" variant="ghost" onClick={onSkip} disabled={pending}>
          {done ? "Back to the dashboard" : "Skip, I'll explore on my own"}
        </Button>
      </div>
    </div>
  );
}

function Dropzone({ importing, cvFileName, aiEnabled, onFile }: { importing: boolean; cvFileName: string | null; aiEnabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      disabled={importing}
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragging ? "border-brand bg-brand-soft/50" : "border-border-strong hover:border-brand hover:bg-surface-2",
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
        {importing ? <Loader2 className="size-6 animate-spin" /> : cvFileName ? <Check className="size-6" /> : <FileUp className="size-6" />}
      </span>
      <span className="font-semibold">
        {importing ? "Reading your CV…" : cvFileName ? `Imported ${cvFileName}. Drop another to replace it.` : "Drop your CV here, or click to choose"}
      </span>
      <span className="text-sm text-muted">
        PDF or .txt, up to 5 MB.{" "}
        {aiEnabled ? (
          <span className="inline-flex items-center gap-1 font-medium text-brand-ink">
            <Sparkles className="size-3.5" /> AI fills in your profile.
          </span>
        ) : (
          "We'll pick out your skills. Turn on AI later to fill in everything."
        )}
      </span>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf,text/plain,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function AiStep({ aiEnabled, inBrowser }: { aiEnabled: boolean; inBrowser: boolean }) {
  if (aiEnabled) {
    return (
      <Step title="AI is ready" description="HireMe can read your CV and explain how well each job fits you.">
        <p className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3 font-medium text-success">
          <Check className="size-5" /> Your AI provider is set up. You can change it any time in Settings.
        </p>
      </Step>
    );
  }
  return (
    <Step
      title="Want AI to do the reading?"
      description="Optional. With AI, HireMe fills in your profile from your CV and explains how well each job fits. Everything else works without it."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          icon={Bot}
          title="Free, on your computer"
          body={
            inBrowser
              ? "Run a model with Ollama. Settings shows the one command that lets this site use it."
              : "Run a model with Ollama. Nothing leaves your machine."
          }
        />
        <OptionCard
          icon={KeyRound}
          title="Your own API key"
          body={`Claude, OpenAI, OpenRouter or Groq. You pay the provider directly.${inBrowser ? " The key stays in this browser." : ""}`}
        />
      </div>
      <Link href="/settings?from=welcome" className="inline-flex items-center gap-2 self-start font-semibold text-brand hover:underline">
        Set up AI in Settings <ArrowRight className="size-4" />
      </Link>
      <p className="text-sm text-subtle">You&apos;ll come back here when you&apos;re done.</p>
    </Step>
  );
}

function OptionCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
        <Icon className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

function Ready({
  role,
  country,
  aiEnabled,
  inBrowser,
  pending,
  onSearch,
  onHome,
}: {
  role: string | undefined;
  country: string;
  aiEnabled: boolean;
  inBrowser: boolean;
  pending: boolean;
  onSearch: () => void;
  onHome: () => void;
}) {
  const extras: { icon: LucideIcon; title: string; body: string; show: boolean }[] = [
    { icon: Sparkles, title: "AI provider", body: "Read your CV and explain every match.", show: !aiEnabled },
    { icon: Workflow, title: "LinkedIn, Indeed and more", body: "Add JobSpy on your computer for more boards.", show: true },
    { icon: Briefcase, title: "JobStreet, Kalibrr via JSearch", body: "A free RapidAPI key adds Google for Jobs listings.", show: true },
    { icon: HardDriveDownload, title: "Backups", body: "Download a copy of your data now and then.", show: inBrowser },
  ];
  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
        <Check className="size-7" strokeWidth={3} />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance">You&apos;re ready to search</h1>
        <p className="mt-2 text-lg text-muted">
          {role ? (
            <>
              We&apos;ll start with <span className="font-semibold text-fg">{role}</span> jobs in{" "}
              <span className="font-semibold text-fg">{countryName(country)}</span>, ranked by how well they fit you.
            </>
          ) : (
            "Search for any role, at home or abroad."
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={onSearch} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Search />} {role ? `Search ${role} jobs` : "Search jobs"}
        </Button>
        <Button size="lg" variant="secondary" onClick={onHome} disabled={pending}>
          Go to your dashboard
        </Button>
      </div>
      <div className="border-t border-border pt-6">
        <p className="font-semibold">Add these whenever you like</p>
        <p className="text-sm text-muted">All in Settings. This guide stays on your dashboard if you want it again.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {extras
            .filter((x) => x.show)
            .map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Link href="/settings" className="flex h-full gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-border-strong hover:bg-surface-2">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand" />
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-sm text-muted">{body}</span>
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
