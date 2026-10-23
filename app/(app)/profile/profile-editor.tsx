"use client";

import { Check, FileUp, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput, Textarea, ToggleGroup } from "@/components/ui/fields";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { COUNTRIES, countryName, findCountry } from "@/lib/geo/countries";
import { currencySymbol } from "@/lib/jobs/format";
import { PH_REGIONS } from "@/lib/ph-locations";
import type { ProfileInput } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";
import { importCv, saveProfile } from "./actions";

type Level = ProfileInput["skills"][number]["level"];

const SKILL_GROUPS: { level: Level; label: string; hint: string }[] = [
  { level: "primary", label: "Strong skills", hint: "What you use every day and would be hired for." },
  { level: "secondary", label: "Also comfortable with", hint: "Used before, could pick up again quickly." },
  { level: "learning", label: "Currently learning", hint: "Courses, certificates in progress, self-study." },
];

const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const CURRENCIES = [...new Set(COUNTRIES.map((c) => c.currency))].sort();

/** Pick several countries: chips for the chosen ones, a select to add more. */
function CountryPicker({ id, value, onChange, exclude }: { id: string; value: string[]; onChange: (next: string[]) => void; exclude?: string }) {
  const options = SORTED_COUNTRIES.filter((c) => c.code !== exclude && !value.includes(c.code));
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1.5 pl-3 text-sm font-medium text-brand-ink">
              {countryName(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="grid size-5 place-items-center rounded-full hover:bg-brand/15"
                aria-label={`Remove ${countryName(code)}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select
        id={id}
        value=""
        placeholder="Add a country…"
        options={options.map((c) => ({ value: c.code, label: c.name }))}
        onValueChange={(code) => onChange([...value, code])}
      />
    </div>
  );
}

/** Overlay an import draft onto the form: fill what the draft has, keep what the user already typed otherwise. */
function mergeDraft(current: ProfileInput, draft: Partial<ProfileInput>): ProfileInput {
  const next = { ...current };
  for (const [key, value] of Object.entries(draft) as [keyof ProfileInput, unknown][]) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (key === "skills") {
      const known = new Set(current.skills.map((s) => s.name.toLowerCase()));
      next.skills = [...current.skills, ...(value as ProfileInput["skills"]).filter((s) => !known.has(s.name.toLowerCase()))];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function ProfileEditor({
  initial,
  initialCvFileName,
  aiEnabled,
}: {
  initial: ProfileInput;
  initialCvFileName: string | null;
  aiEnabled: boolean;
}) {
  const [profile, setProfile] = useState(initial);
  const [cvFileName, setCvFileName] = useState(initialCvFileName);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [importing, startImport] = useTransition();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  function changeCountry(code: string) {
    setProfile((p) => {
      const was = findCountry(p.country);
      const next = findCountry(code);
      return {
        ...p,
        country: code,
        // PH regions don't apply elsewhere, and the salary currency follows the country unless the user changed it.
        region: code === "PH" || p.country !== "PH" ? p.region : null,
        salaryCurrency: next && (!was || p.salaryCurrency === was.currency) ? next.currency : p.salaryCurrency,
        targetCountries: p.targetCountries.filter((c) => c !== code),
      };
    });
    setDirty(true);
  }

  function onImport(file: File) {
    setStatus(null);
    const data = new FormData();
    data.set("cv", file);
    startImport(async () => {
      const result = await importCv(data);
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setCvFileName(result.data.fileName);
      setProfile((p) => mergeDraft(p, result.data.draft));
      setDirty(true);
      const found = result.data.draft.skills?.length ?? 0;
      setStatus({
        tone: "info",
        text: result.data.usedAi
          ? "Your profile was filled in from your CV. Review it, then save."
          : `${result.data.aiError ? `AI couldn't read your CV (${result.data.aiError}). ` : ""}Found ${found} skill${found === 1 ? "" : "s"} in your CV. Fill in the rest below, then save.`,
      });
    });
  }

  function onSave() {
    setStatus(null);
    startSaving(async () => {
      const result = await saveProfile(profile);
      if (result.ok) {
        setDirty(false);
        setStatus({ tone: "success", text: "Profile saved. Your job matches now use it." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  }

  const skillsFor = (level: Level) => profile.skills.filter((s) => s.level === level).map((s) => s.name);
  const setSkillsFor = (level: Level, names: string[]) =>
    update("skills", [
      ...profile.skills.filter((s) => s.level !== level && !names.some((n) => n.toLowerCase() === s.name.toLowerCase())),
      ...names.map((name) => ({ name, level })),
    ]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* CV import */}
      <Card
        className={cn("transition-colors", dragging && "border-brand bg-brand-soft/40")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onImport(file);
        }}
      >
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
            {importing ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">
              {importing ? "Reading your CV…" : cvFileName ? "Import a newer CV" : "Start from your CV"}
            </p>
            <p className="text-sm text-muted">
              {cvFileName ? (
                <>
                  Last imported: <span className="font-medium text-fg">{cvFileName}</span>.{" "}
                </>
              ) : (
                "Drop a PDF here or choose a file. "
              )}
              {aiEnabled ? (
                <span className="inline-flex items-center gap-1 font-medium text-brand-ink">
                  <Sparkles className="size-3.5" /> AI fills in your whole profile.
                </span>
              ) : (
                "We'll detect your skills. Choose an AI provider in Settings to fill in everything."
              )}
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf,text/plain,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
            Choose file
          </Button>
        </CardContent>
      </Card>

      {status && (
        <p
          role="status"
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            status.tone === "success" && "bg-success-soft text-success",
            status.tone === "error" && "bg-danger-soft text-danger",
            status.tone === "info" && "bg-brand-soft text-brand-ink",
          )}
        >
          {status.text}
        </p>
      )}

      <Section title="The basics" description="How employers will see you.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <Input id="name" value={profile.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Headline" htmlFor="headline">
            <Input
              id="headline"
              placeholder="e.g. Customer Support Team Lead"
              value={profile.headline ?? ""}
              onChange={(e) => update("headline", e.target.value || null)}
            />
          </Field>
          <Field label="Country you live in" htmlFor="country">
            <Select
              id="country"
              value={profile.country}
              options={SORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
              onValueChange={changeCountry}
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              placeholder={profile.country === "PH" ? "e.g. Quezon City" : "Your city"}
              value={profile.city ?? ""}
              onChange={(e) => update("city", e.target.value || null)}
            />
          </Field>
          {profile.country === "PH" ? (
            <Field label="Region" htmlFor="region">
              <Select
                id="region"
                value={profile.region ?? ""}
                placeholder="Select a region"
                options={PH_REGIONS.map((r) => ({ value: r, label: r }))}
                onValueChange={(r) => update("region", r || null)}
              />
            </Field>
          ) : (
            <Field label="State or province" htmlFor="region">
              <Input id="region" value={profile.region ?? ""} onChange={(e) => update("region", e.target.value || null)} />
            </Field>
          )}
          <Field label="Years of experience" htmlFor="years">
            <Input
              id="years"
              type="number"
              min={0}
              max={60}
              value={profile.yearsExperience ?? ""}
              onChange={(e) => update("yearsExperience", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Summary" htmlFor="summary">
          <Textarea
            id="summary"
            placeholder="Two or three sentences about what you do best."
            value={profile.summary ?? ""}
            onChange={(e) => update("summary", e.target.value || null)}
          />
        </Field>
      </Section>

      <Section title="What you're looking for" description="This drives your job search and match scores.">
        <Field label="Roles you want" htmlFor="roles" hint="Press Enter after each one.">
          <TagInput
            id="roles"
            value={profile.desiredRoles}
            onChange={(v) => update("desiredRoles", v)}
            placeholder="e.g. Frontend Developer"
            max={10}
          />
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
        <Field
          label="Countries you'd work in besides your own"
          htmlFor="targets"
          hint="Add these to search jobs overseas. Jobs there are flagged for visa sponsorship instead of ruled out."
        >
          <CountryPicker
            id="targets"
            value={profile.targetCountries}
            onChange={(v) => update("targetCountries", v)}
            exclude={profile.country}
          />
        </Field>
        <Field
          label="Countries you can already work in without a visa"
          htmlFor="auth"
          hint={`Besides ${countryName(profile.country)}. For example a second citizenship or a work permit you hold.`}
        >
          <CountryPicker
            id="auth"
            value={profile.workAuthorizations}
            onChange={(v) => update("workAuthorizations", v)}
            exclude={profile.country}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
          <Field label="Currency" htmlFor="salcur">
            <Select
              id="salcur"
              value={profile.salaryCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onValueChange={(c) => update("salaryCurrency", c)}
            />
          </Field>
          <Field label={`Expected salary from (${currencySymbol(profile.salaryCurrency).trim()} / month)`} htmlFor="salmin">
            <Input
              id="salmin"
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 40000"
              value={profile.salaryMinMonthly ?? ""}
              onChange={(e) => update("salaryMinMonthly", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <Field label={`Up to (${currencySymbol(profile.salaryCurrency).trim()} / month)`} htmlFor="salmax">
            <Input
              id="salmax"
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 60000"
              value={profile.salaryMaxMonthly ?? ""}
              onChange={(e) => update("salaryMaxMonthly", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </div>
      </Section>

      <Section title="Skills" description="Your match score compares these with each job's requirements.">
        {SKILL_GROUPS.map((group) => (
          <Field key={group.level} label={group.label} hint={group.hint}>
            <TagInput value={skillsFor(group.level)} onChange={(v) => setSkillsFor(group.level, v)} max={40} placeholder="Add a skill" />
          </Field>
        ))}
      </Section>

      <Section
        title="Experience"
        description="Most recent first."
        action={
          <Button
            variant="soft"
            size="sm"
            onClick={() =>
              update("experience", [
                ...profile.experience,
                { company: "", role: "", start: "", end: null, location: null, highlights: [] },
              ])
            }
          >
            <Plus /> Add role
          </Button>
        }
      >
        {profile.experience.length === 0 && <Empty>No roles yet. Import your CV or add one.</Empty>}
        {profile.experience.map((exp, i) => {
          const set = (patch: Partial<typeof exp>) =>
            update("experience", profile.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)));
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Job title" value={exp.role} onChange={(e) => set({ role: e.target.value })} />
                <Input placeholder="Company" value={exp.company} onChange={(e) => set({ company: e.target.value })} />
                <Input placeholder="Start (e.g. 2022-03)" value={exp.start} onChange={(e) => set({ start: e.target.value })} />
                <Input
                  placeholder="End (blank if current)"
                  value={exp.end ?? ""}
                  onChange={(e) => set({ end: e.target.value || null })}
                />
              </div>
              <Textarea
                placeholder="Key achievements, one per line"
                value={exp.highlights.join("\n")}
                onChange={(e) => set({ highlights: e.target.value.split("\n").filter((l, k, all) => l.trim() || k === all.length - 1) })}
                onBlur={(e) => set({ highlights: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
              />
              <RemoveButton onClick={() => update("experience", profile.experience.filter((_, j) => j !== i))} />
            </div>
          );
        })}
      </Section>

      <Section
        title="Education"
        action={
          <Button
            variant="soft"
            size="sm"
            onClick={() => update("education", [...profile.education, { school: "", degree: "", field: null, year: null }])}
          >
            <Plus /> Add
          </Button>
        }
      >
        {profile.education.length === 0 && <Empty>No education added yet.</Empty>}
        {profile.education.map((edu, i) => {
          const set = (patch: Partial<typeof edu>) =>
            update("education", profile.education.map((e, j) => (j === i ? { ...e, ...patch } : e)));
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="School" value={edu.school} onChange={(e) => set({ school: e.target.value })} />
                <Input placeholder="Degree (e.g. BS)" value={edu.degree} onChange={(e) => set({ degree: e.target.value })} />
                <Input placeholder="Field of study" value={edu.field ?? ""} onChange={(e) => set({ field: e.target.value || null })} />
                <Input placeholder="Year" value={edu.year ?? ""} onChange={(e) => set({ year: e.target.value || null })} />
              </div>
              <RemoveButton onClick={() => update("education", profile.education.filter((_, j) => j !== i))} />
            </div>
          );
        })}
      </Section>

      <Section
        title="Languages"
        description="Some postings require a specific language. We check this before scoring."
        action={
          <Button variant="soft" size="sm" onClick={() => update("languages", [...profile.languages, { name: "", level: "" }])}>
            <Plus /> Add
          </Button>
        }
      >
        {profile.languages.length === 0 && <Empty>e.g. English (Fluent), Filipino (Native)</Empty>}
        {profile.languages.map((lang, i) => {
          const set = (patch: Partial<typeof lang>) =>
            update("languages", profile.languages.map((l, j) => (j === i ? { ...l, ...patch } : l)));
          return (
            <div key={i} className="flex items-center gap-3">
              <Input placeholder="Language" value={lang.name} onChange={(e) => set({ name: e.target.value })} />
              <Input placeholder="Level (e.g. Fluent)" value={lang.level} onChange={(e) => set({ level: e.target.value })} />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove language"
                onClick={() => update("languages", profile.languages.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </Section>

      <Section title="Goals & deal-breakers" description="Used to judge career fit and to filter out jobs you'd never take.">
        <Field label="Career goals">
          <TagInput
            value={profile.careerGoals}
            onChange={(v) => update("careerGoals", v)}
            placeholder="e.g. Move into a team lead role"
            max={8}
          />
        </Field>
        <Field label="Deal-breakers">
          <TagInput
            value={profile.dealBreakers}
            onChange={(v) => update("dealBreakers", v)}
            placeholder="e.g. Graveyard shift, relocation"
            max={8}
          />
        </Field>
      </Section>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-3xl border border-border bg-surface/95 px-5 py-3 shadow-[var(--shadow-lift)] backdrop-blur sm:px-8 lg:mx-8 xl:mx-auto">
          <p className="text-sm text-muted">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Save profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
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

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-subtle">{children}</p>;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-end text-sm font-medium text-subtle hover:text-danger">
      Remove
    </button>
  );
}
