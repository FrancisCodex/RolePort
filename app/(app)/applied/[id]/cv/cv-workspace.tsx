"use client";

import { Check, Download, FileSearch, Loader2, RotateCcw, Save, Sparkles, TriangleAlert, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { PromptDetails } from "@/components/app/prompt-details";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput, Textarea } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { discardCv, saveCv, tailorCv } from "@/lib/client/mutations";
import { checkCvPdf, cvFileName, renderCvPdf, type AtsCheck } from "@/lib/cv/pdf";
import type { CvPageData } from "@/lib/cv/tailor";
import { cvDates, MAX_CV_SKILLS, type CvContent, type CvTailoring } from "@/lib/cv/types";
import { cn } from "@/lib/utils";

/** Blank lines are kept while typing (so Enter works) and dropped when the CV is saved or printed. */
function cleaned(cv: CvContent): CvContent {
  const lines = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  return {
    ...cv,
    skills: lines(cv.skills),
    contact: { ...cv.contact, links: lines(cv.contact.links) },
    experience: cv.experience.map((e) => ({ ...e, bullets: lines(e.bullets) })),
    sections: cv.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, details: lines(i.details) })) })),
  };
}

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One application's CV: tailor it to the posting with AI (or start from the profile without),
 * edit every line, see the exact prompt, and download an ATS-friendly PDF that's read back and
 * checked. Shared by the server page and the lite edition.
 */
export function CvWorkspace({ data }: { data: CvPageData }) {
  const [cv, setCv] = useState(data.content);
  const [tailoring, setTailoring] = useState<CvTailoring | null>(data.tailoring);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(cleaned(data.content)));
  const [stored, setStored] = useState(data.saved);
  const edited = JSON.stringify(cleaned(cv)) !== savedJson;
  const dirty = edited || !stored;
  const skillCount = cleaned(cv).skills.length;

  const [tailoringNow, startTailoring] = useTransition();
  const [aiError, setAiError] = useState<{ text: string; needsSetup?: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const [pdfBusy, setPdfBusy] = useState<"download" | "check" | null>(null);
  const [ats, setAts] = useState<{ checks: AtsCheck[]; text: string } | { error: string } | null>(null);

  const update = (patch: Partial<CvContent>) => {
    setCv((c) => ({ ...c, ...patch }));
    setSaveState("idle");
    setAts(null);
  };

  async function save(): Promise<boolean> {
    setSaveState("saving");
    const next = cleaned(cv);
    const result = await saveCv(data.applicationId, next);
    if (!result.ok) {
      setSaveState({ error: result.error });
      return false;
    }
    setSavedJson(JSON.stringify(next));
    setCv(next);
    setStored(true);
    setSaveState("saved");
    return true;
  }

  function tailor() {
    if (edited && !window.confirm("Tailoring rewrites the summary, skills and bullets, so your unsaved edits will be replaced. Continue?")) return;
    setAiError(null);
    startTailoring(async () => {
      const result = await tailorCv(data.applicationId);
      if (!result.ok) {
        setAiError({ text: result.error, needsSetup: result.needsSetup });
        return;
      }
      setSavedJson(JSON.stringify(cleaned(result.data.content)));
      setCv(result.data.content);
      setTailoring(result.data.tailoring);
      setStored(true);
      setSaveState("saved");
      setAts(null);
    });
  }

  async function makePdf(mode: "download" | "check") {
    setPdfBusy(mode);
    setAts(null);
    try {
      if (dirty && !(await save())) return;
      const final = cleaned(cv);
      const blob = await renderCvPdf(final);
      if (mode === "download") {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: cvFileName(final, data.company) });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      setAts(await checkCvPdf(blob, final));
    } catch (error) {
      console.error("[cv] PDF failed", error);
      setAts({ error: "Couldn't make the PDF. Please try again." });
    } finally {
      setPdfBusy(null);
    }
  }

  async function startOver() {
    if (!window.confirm("Throw this CV away and start again from your profile? Edits and the last tailoring are lost.")) return;
    const result = await discardCv(data.applicationId);
    if (!result.ok) return setSaveState({ error: result.error });
    setCv(result.data);
    setSavedJson(JSON.stringify(cleaned(result.data)));
    setTailoring(null);
    setStored(false);
    setSaveState("idle");
    setAts(null);
  }

  if (data.profileEmpty) {
    return (
      <EmptyState
        icon={UserRound}
        title="Your profile is empty"
        body="A CV is built from your profile: experience, skills and education. Import your CV or fill in your profile first."
        action={
          <Link href="/profile" className={buttonVariants()}>
            Go to your profile
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Toolbar */}
        <Card className="sticky top-2 z-10 shadow-[var(--shadow-soft)] lg:top-4">
          <CardContent className="flex flex-wrap items-center gap-1.5 p-3">
            <Button onClick={() => makePdf("download")} disabled={pdfBusy !== null || tailoringNow}>
              {pdfBusy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
            </Button>
            <Button variant="secondary" onClick={() => void save()} disabled={!dirty || saveState === "saving" || tailoringNow}>
              <Save /> {saveState === "saving" ? "Saving…" : "Save"}
            </Button>
            <span aria-live="polite" className={cn("px-1 text-xs", typeof saveState === "object" ? "text-danger" : "text-subtle")}>
              {typeof saveState === "object" ? saveState.error : edited ? "Unsaved changes" : !stored ? "Not saved yet" : saveState === "saved" ? "Saved" : null}
            </span>
            {stored && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void startOver()} disabled={tailoringNow}>
                <RotateCcw /> Start over from profile
              </Button>
            )}
          </CardContent>
        </Card>

        <Section title="Header" description="Contact lines are remembered for your next CV.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={cv.name} maxLength={120} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Headline">
              <Input value={cv.headline} maxLength={160} onChange={(e) => update({ headline: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={cv.contact.email} maxLength={160} onChange={(e) => update({ contact: { ...cv.contact, email: e.target.value } })} />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={cv.contact.phone} maxLength={60} onChange={(e) => update({ contact: { ...cv.contact, phone: e.target.value } })} />
            </Field>
            <Field label="Location">
              <Input value={cv.contact.location} maxLength={160} onChange={(e) => update({ contact: { ...cv.contact, location: e.target.value } })} />
            </Field>
            <Field label="Paper size">
              <Select
                value={cv.pageSize}
                options={[
                  { value: "LETTER", label: "Letter (short bond)" },
                  { value: "A4", label: "A4" },
                ]}
                onValueChange={(v) => update({ pageSize: v as CvContent["pageSize"] })}
                aria-label="Paper size"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Links (LinkedIn, portfolio, GitHub)">
                <TagInput value={cv.contact.links} max={4} placeholder="Paste a link, then Enter" onChange={(links) => update({ contact: { ...cv.contact, links } })} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Summary">
          <Textarea value={cv.summary} maxLength={1200} className="min-h-28" onChange={(e) => update({ summary: e.target.value })} />
        </Section>

        <Section title="Skills" description="Most relevant first. ATS software matches these against the posting." aside={<SkillCount count={skillCount} />}>
          <TagInput value={cv.skills} max={MAX_CV_SKILLS} placeholder="Add a skill, then Enter" onChange={(skills) => update({ skills })} />
          {skillCount > MAX_CV_SKILLS ? (
            <p className="mt-2 text-xs font-medium text-danger">
              Remove {skillCount - MAX_CV_SKILLS} skill{skillCount - MAX_CV_SKILLS === 1 ? "" : "s"} to save: a CV holds up to {MAX_CV_SKILLS}. Keep the ones this
              posting asks for.
            </p>
          ) : (
            <p className="mt-2 text-xs text-subtle">
              {skillCount === MAX_CV_SKILLS
                ? "That's the most a CV holds. Remove one to add another."
                : `Room for ${MAX_CV_SKILLS - skillCount} more. 10 to 20 well-chosen skills usually read best.`}
            </p>
          )}
        </Section>

        <Section title="Experience" description="One bullet per line. Employers, titles and dates come from your profile.">
          <div className="flex flex-col gap-4">
            {cv.experience.map((role, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13px] font-medium">
                    {role.role} <span className="font-normal text-muted">at {role.company}</span>
                  </p>
                  <span className="text-xs text-subtle tabular-nums">
                    {cvDates(role.start, role.end)}
                  </span>
                </div>
                <Textarea
                  aria-label={`Bullets for ${role.role} at ${role.company}`}
                  value={role.bullets.join("\n")}
                  className="min-h-24 text-[13px]"
                  onChange={(e) =>
                    update({ experience: cv.experience.map((r, j) => (j === i ? { ...r, bullets: e.target.value.split("\n").slice(0, 10) } : r)) })
                  }
                />
              </div>
            ))}
            {cv.experience.length === 0 && <p className="text-[13px] text-muted">No experience in your profile yet.</p>}
          </div>
        </Section>

        {cv.sections.map((section, i) => {
          const setItems = (items: CvContent["sections"][number]["items"]) =>
            update({ sections: cv.sections.map((s, j) => (j === i ? { ...s, items } : s)).filter((s) => s.items.length > 0) });
          return (
            <Section
              key={section.title}
              title={section.title}
              description="One detail per line. Tailoring again or starting over brings back anything you remove."
              aside={
                <Button variant="ghost" size="sm" onClick={() => update({ sections: cv.sections.filter((_, j) => j !== i) })}>
                  Leave out
                </Button>
              }
            >
              <div className="flex flex-col gap-4">
                {section.items.map((item, j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="min-w-0 text-[13px] font-medium">
                        {item.title} {item.subtitle && <span className="font-normal text-muted">· {item.subtitle}</span>}
                      </p>
                      <span className="flex items-center gap-2 text-xs text-subtle tabular-nums">
                        {item.date}
                        <button
                          type="button"
                          aria-label={`Leave out ${item.title}`}
                          className="grid size-4 place-items-center rounded-sm hover:text-danger"
                          onClick={() => setItems(section.items.filter((_, k) => k !== j))}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </div>
                    {item.details.length > 0 && (
                      <Textarea
                        aria-label={`Details for ${item.title}`}
                        value={item.details.join("\n")}
                        className="min-h-16 text-[13px]"
                        onChange={(e) => setItems(section.items.map((it, k) => (k === j ? { ...it, details: e.target.value.split("\n").slice(0, 8) } : it)))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Section>
          );
        })}

        <Section title="Education and languages" description="From your profile.">
          <ul className="flex flex-col gap-1 text-[13px]">
            {cv.education.map((e, i) => (
              <li key={i}>
                {[e.degree, e.field].filter(Boolean).join(", ")} <span className="text-muted">· {e.school}</span>
                {e.year && <span className="text-subtle"> · {e.year}</span>}
              </li>
            ))}
            {cv.languages.length > 0 && <li className="text-muted">Languages: {cv.languages.join(", ")}</li>}
          </ul>
          <Link href="/profile" className="mt-2 inline-block text-xs font-medium text-brand-ink hover:underline">
            Edit in your profile
          </Link>
        </Section>
      </div>

      <aside className="flex flex-col gap-3 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <TailorCard data={data} tailoring={tailoring} pending={tailoringNow} error={aiError} onTailor={tailor} />
        {tailoring && <ResultCard tailoring={tailoring} />}
        <AtsCard ats={ats} busy={pdfBusy === "check"} onCheck={() => void makePdf("check")} disabled={pdfBusy !== null || tailoringNow} />
      </aside>
    </div>
  );
}

function Section({ title, description, aside, children }: { title: string; description?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {aside}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** "18 / 40": red past the limit, amber at it. */
function SkillCount({ count }: { count: number }) {
  return (
    <Badge tone={count > MAX_CV_SKILLS ? "danger" : count === MAX_CV_SKILLS ? "warning" : "neutral"} className="tabular-nums">
      {count} / {MAX_CV_SKILLS}
    </Badge>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TailorCard({
  data,
  tailoring,
  pending,
  error,
  onTailor,
}: {
  data: CvPageData;
  tailoring: CvTailoring | null;
  pending: boolean;
  error: { text: string; needsSetup?: boolean } | null;
  onTailor: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tailor with AI</CardTitle>
        <CardDescription>
          Rewrites your headline, summary, skill order and bullets for this posting, using only what&apos;s in your profile and CV.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!data.hasPosting ? (
          <p className="text-[13px] text-muted">The posting for this application isn&apos;t stored anymore, so there&apos;s nothing to tailor to.</p>
        ) : !data.aiEnabled ? (
          <p className="text-[13px] text-muted">
            <Link href="/settings" className="font-medium text-brand-ink hover:underline">
              Choose an AI provider
            </Link>{" "}
            to tailor. You can still edit and download the CV from your profile.
          </p>
        ) : (
          <Button onClick={onTailor} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Tailoring…" : tailoring ? "Tailor again" : "Tailor to this job"}
          </Button>
        )}
        {pending && <p className="text-xs text-muted">Local models can take a few minutes. Keep this page open.</p>}
        {error && (
          <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error.text}{" "}
            {error.needsSetup && (
              <Link href="/settings" className="font-medium underline">
                Open Settings
              </Link>
            )}
          </p>
        )}
        {tailoring && (
          <p className="text-xs text-subtle">
            Last tailored {formatWhen(tailoring.at)} with {tailoring.model}
            {tailoring.customPrompt ? " using your own prompt" : ""}.
          </p>
        )}

        {data.prompt && <PromptDetails prompt={data.prompt} settingsAnchor="cv-prompt" />}
      </CardContent>
    </Card>
  );
}

function ResultCard({ tailoring }: { tailoring: CvTailoring }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What changed</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-[13px]">
        {tailoring.notes && <p className="text-muted">{tailoring.notes}</p>}
        {tailoring.warnings.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/20 bg-warning-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <TriangleAlert className="size-3.5" /> Check before you send
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {tailoring.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {tailoring.keywordsCovered.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Posting keywords in your CV</p>
            <div className="flex flex-wrap gap-1">
              {tailoring.keywordsCovered.map((k) => (
                <Badge key={k} tone="success">
                  <Check /> {k}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {tailoring.keywordsMissing.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Asked for, but not in your profile</p>
            <div className="flex flex-wrap gap-1">
              {tailoring.keywordsMissing.map((k) => (
                <Badge key={k}>{k}</Badge>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-subtle">If you do have any of these, add them to your profile and tailor again.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AtsCard({
  ats,
  busy,
  disabled,
  onCheck,
}: {
  ats: { checks: AtsCheck[]; text: string } | { error: string } | null;
  busy: boolean;
  disabled: boolean;
  onCheck: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS check</CardTitle>
        <CardDescription>Reads the text back out of the PDF the way applicant tracking systems do.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ats && "checks" in ats ? (
          <>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {ats.checks.map((c) => (
                <li key={c.label} className="flex gap-2">
                  {c.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <X className="mt-0.5 size-3.5 shrink-0 text-danger" />}
                  <span className={c.ok ? "" : "text-danger"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-muted select-none hover:text-fg">Show the text a parser sees</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-surface-2 p-2 leading-relaxed whitespace-pre-wrap">{ats.text}</pre>
            </details>
          </>
        ) : ats ? (
          <p className="text-xs text-danger">{ats.error}</p>
        ) : (
          <p className="text-xs text-muted">Runs on its own after every download, or check now without downloading.</p>
        )}
        <Button variant="secondary" onClick={onCheck} disabled={disabled}>
          {busy ? <Loader2 className="animate-spin" /> : <FileSearch />} {ats ? "Check again" : "Check the PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}
