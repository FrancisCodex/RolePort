"use client";

import { Building2, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { followCompany, unfollowCompany } from "@/lib/client/mutations";
import type { FollowedCompanyView } from "@/lib/companies/queries";

/** Add a company by its careers link; its jobs then show up in every search. */
export function FollowedCompanies({ companies }: { companies: FollowedCompanyView[] }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await followCompany({ url, name: name || undefined });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      const { name: added, openJobs } = result.data;
      setMessage({
        ok: true,
        text: `Following ${added}: ${openJobs} open job${openJobs === 1 ? "" : "s"} right now. Matching ones now show up in your searches.`,
      });
      setUrl("");
      setName("");
    });
  }

  function remove(id: string) {
    setRemoving(id);
    start(async () => {
      const result = await unfollowCompany({ id });
      if (!result.ok) setMessage({ ok: false, text: result.error });
      setRemoving(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {companies.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {companies.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <Building2 className="size-4 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                <p className="text-xs text-subtle">via {c.boardLabel}</p>
              </div>
              {c.careersUrl && (
                <a
                  href={c.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${c.name}'s careers page`}
                  className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-fg"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={pending} aria-label={`Stop following ${c.name}`}>
                {removing === c.id ? <Loader2 className="animate-spin" /> : <X />}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">You don&apos;t follow any companies yet.</p>
      )}

      <form onSubmit={add} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="careers-url">Careers page link</Label>
          <Input
            id="careers-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://jobs.lever.co/company or the company's own careers page"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company-name">Company name (optional)</Label>
          <Input id="company-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Filled in for you when left empty" />
        </div>
        {message && (
          <p
            role="status"
            className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}
          >
            {message.text}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending && !removing ? <Loader2 className="animate-spin" /> : <Plus />} Follow company
          </Button>
        </div>
      </form>
    </div>
  );
}
