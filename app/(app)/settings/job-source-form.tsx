"use client";

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveRapidApiKey } from "./actions";

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
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Subscribe to JSearch (free tier available) <ExternalLink className="size-3" />
        </a>
      </div>
      {message && (
        <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
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
