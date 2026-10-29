"use client";

import { Check, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { followStarterCompanies } from "@/lib/client/mutations";
import { companyJobsHref } from "@/lib/companies/links";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { companyKey, STARTER_LISTS, starterListOrder } from "@/lib/companies/starters";
import { cn } from "@/lib/utils";

/**
 * One-click following for people who don't have a company in mind yet: well-known employers with
 * open jobs in the user's countries (or hiring remotely). `countries` puts the user's own first.
 */
export function StarterCompanies({
  companies,
  countries,
  onNavigate,
}: {
  companies: FollowedCompanyView[];
  countries: string[];
  onNavigate?: () => void;
}) {
  const lists = starterListOrder(countries);
  const [listId, setListId] = useState(lists[0].id);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const followed = new Set(companies.map((c) => c.key));
  const list = STARTER_LISTS[listId] ?? [];
  const notYet = list.filter((c) => !followed.has(companyKey(c)));

  function follow(keys: string[], which: string) {
    setMessage(null);
    setBusy(which);
    start(async () => {
      const result = await followStarterCompanies({ keys });
      setBusy(null);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      const { added, full } = result.data;
      if (full) return setMessage({ ok: false, text: "You've reached the most companies you can follow. Remove one to add another." });
      if (added.length) {
        setMessage({
          ok: true,
          text: added.length === 1 ? `You're following ${added[0]}.` : `You're following ${added.length} more companies.`,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium text-fg">Popular employers hiring in</p>
        <Select
          size="sm"
          value={listId}
          onValueChange={(id) => {
            setListId(id);
            setMessage(null);
          }}
          aria-label="Country"
          options={lists.map((l) => ({ value: l.id, label: l.label }))}
        />
      </div>
      <p className="text-xs text-subtle">Click a company to follow it. These are companies that had open jobs there when the list was made.</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => {
          const key = companyKey(c);
          const on = followed.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={on || pending}
              onClick={() => follow([key], key)}
              aria-label={on ? `Following ${c.name}` : `Follow ${c.name}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-default",
                on ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {busy === key ? <Loader2 className="size-3 animate-spin" /> : on ? <Check className="size-3" /> : <Plus className="size-3" />}
              {c.name}
            </button>
          );
        })}
      </div>
      {notYet.length > 1 && (
        <div>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => follow(notYet.map(companyKey), "all")}>
            {busy === "all" ? <Loader2 className="animate-spin" /> : <Plus />}
            Follow all {notYet.length}
          </Button>
        </div>
      )}
      {message && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}
        >
          {message.text}{" "}
          {message.ok && (
            <Link href={companyJobsHref()} onClick={onNavigate} className="underline underline-offset-2 hover:no-underline">
              See their jobs
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
