"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { saveFollowUpRules } from "@/lib/client/mutations";
import { DEFAULT_RULES, type FollowUpRules } from "@/lib/outreach/rules";
import { cn } from "@/lib/utils";

const RULES: { key: keyof FollowUpRules; label: string; unit: string; max: number; hint: string }[] = [
  { key: "nudge1Days", label: "First follow-up", unit: "days after you apply", max: 90, hint: "When there's been no reply." },
  { key: "nudge2Days", label: "Second follow-up", unit: "days after you apply", max: 120, hint: "The last one. After it, move on." },
  { key: "thankYouHours", label: "Thank-you", unit: "hours after the interview", max: 168, hint: "Send it by then." },
  {
    key: "checkInWorkingDays",
    label: "Check-in after the interview",
    unit: "working days after the date they gave you",
    max: 60,
    hint: "Or after the interview, if they didn't give a date.",
  },
  { key: "offerReplyDaysBefore", label: "Reply to an offer", unit: "days before their deadline", max: 30, hint: "Accept, ask for time or negotiate." },
];

/**
 * When follow-ups come due: each rule's number, or off. Home's "Follow up" list, the
 * application page and the emails page all use these. "Got a reply" pauses them per application.
 */
export function FollowUpRulesForm({ saved: initial }: { saved: FollowUpRules }) {
  const [saved, setSaved] = useState(initial);
  const [rules, setRules] = useState(saved);
  // What's typed, so a field can be empty for a moment while the user edits it.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const changed = JSON.stringify(rules) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(rules) === JSON.stringify(DEFAULT_RULES);

  function save(next: FollowUpRules | null) {
    setStatus(null);
    startTransition(async () => {
      const result = await saveFollowUpRules(next);
      if (!result.ok) return setStatus({ ok: false, text: result.error });
      setSaved(next ?? DEFAULT_RULES);
      if (next === null) {
        setRules(DEFAULT_RULES);
        setTyped({});
      }
      setStatus({ ok: true, text: next === null ? "Back to the defaults." : "Saved." });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {RULES.map((r) => {
          const on = rules[r.key] !== null;
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-[13px]">
              <label className="flex min-w-48 flex-1 items-center gap-2.5">
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => {
                    setRules((x) => ({ ...x, [r.key]: v ? (saved[r.key] ?? DEFAULT_RULES[r.key]) : null }));
                    setStatus(null);
                  }}
                />
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-muted">{r.hint}</span>
                </span>
              </label>
              <span className={cn("flex items-center gap-2 text-xs text-muted", !on && "opacity-50")}>
                <Input
                  type="number"
                  min={0}
                  max={r.max}
                  step={1}
                  disabled={!on}
                  aria-label={`${r.label}: ${r.unit}`}
                  className="h-8 w-16 text-[13px] tabular-nums"
                  value={typed[r.key] ?? (rules[r.key] ?? DEFAULT_RULES[r.key])?.toString() ?? ""}
                  onChange={(e) => {
                    setTyped((t) => ({ ...t, [r.key]: e.target.value }));
                    const n = Number(e.target.value);
                    if (e.target.value !== "" && Number.isInteger(n) && n >= 0 && n <= r.max) setRules((x) => ({ ...x, [r.key]: n }));
                    setStatus(null);
                  }}
                  onBlur={() => setTyped((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== r.key)))}
                />
                {r.unit}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save(isDefault ? null : rules)} disabled={pending || !changed}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={() => save(null)} disabled={pending || (isDefault && !changed)}>
          <RotateCcw /> Reset to defaults
        </Button>
        {status && <span className={cn("text-xs", status.ok ? "text-success" : "text-danger")}>{status.text}</span>}
      </div>
    </div>
  );
}
