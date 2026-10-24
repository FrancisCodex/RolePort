"use client";

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveJobSpyEnabled, saveRapidApiKey } from "@/lib/client/mutations";

export function JobSourceForm({ rapidApiKeyHint }: { rapidApiKeyHint: string | null }) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(clear: boolean) {
    setMessage(null);
    start(async () => {
      const result = await saveRapidApiKey({ apiKey: key || null, clear });
      setMessage(result.ok ? { ok: true, text: clear ? "Key removed." : "Saved. JSearch is now part of every search." } : { ok: false, text: result.error });
      if (result.ok) setKey("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rapidapi">RapidAPI key for JSearch</Label>
        <Input
          id="rapidapi"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={rapidApiKeyHint ? `Saved: ${rapidApiKeyHint}` : "Paste your RapidAPI key"}
        />
        <a
          href="https://rapidapi.com/letscrunch/api/jsearch"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline"
        >
          Subscribe to JSearch (free tier available) <ExternalLink className="size-3" />
        </a>
      </div>
      {message && (
        <p className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => save(false)} disabled={pending || !key}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Save key
        </Button>
        {rapidApiKeyHint && (
          <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

/** Opt-in switch for the JobSpy boards, with the terms notice shown before turning them on. */
export function JobSpyToggle({ enabled, reachable }: { enabled: boolean; reachable: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function save(next: boolean) {
    setMessage(null);
    start(async () => {
      const result = await saveJobSpyEnabled({ enabled: next });
      setMessage(
        result.ok
          ? { ok: true, text: next ? "On. LinkedIn, Indeed and other boards are now part of every search." : "Off." }
          : { ok: false, text: result.error },
      );
      if (result.ok) setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">LinkedIn, Indeed and more via JobSpy</p>
        <p className="text-[13px] text-muted">
          Free and no key needed. Searches LinkedIn, Indeed, Google Jobs, Glassdoor and regional boards such as Bayt (Gulf) and Naukri
          (India) through the JobSpy service on your own computer. Powered by{" "}
          <a
            href="https://github.com/speedyapply/JobSpy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
          >
            JobSpy <ExternalLink className="size-3" />
          </a>
          , an open-source project by Cullen Watson and contributors.
        </p>
        {!reachable && (
          <p className="text-sm font-medium text-danger">The JobSpy service isn&apos;t responding. Is it running?</p>
        )}
      </div>
      {confirming && (
        <p className="rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[13px] text-warning">
          This reads public job pages from your own network. These sites&apos; terms don&apos;t allow automated access, and they may
          rate-limit or block your connection for a while. Use it for your own job search only. Results are cached for a few hours to
          keep requests low.
        </p>
      )}
      {message && (
        <p className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        {enabled ? (
          <Button variant="ghost" onClick={() => save(false)} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Turn off
          </Button>
        ) : confirming ? (
          <>
            <Button onClick={() => save(true)} disabled={pending || !reachable}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />} I understand, turn it on
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={!reachable}>
            Turn on
          </Button>
        )}
      </div>
    </div>
  );
}
