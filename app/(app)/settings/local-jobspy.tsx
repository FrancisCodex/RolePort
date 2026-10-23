"use client";

import { Check, ExternalLink, Loader2, PlugZap } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { checkJobSpy, DEFAULT_JOBSPY_URL, jobSpyUrl, setJobSpyUrl } from "@/lib/client/lite-jobspy";
import { saveJobSpyEnabled } from "@/lib/client/mutations";
import { CopyBlock } from "./ollama-setup";

type Message = { ok: boolean; text: string } | null;

// Built straight from the repository, so users don't need a copy of it.
const IMAGE_SOURCE = "https://github.com/FrancisCodex/HireMe.git#main:services/jobspy";

/**
 * Lite edition: connect the JobSpy service on this computer. The browser calls it directly;
 * it only answers sites listed in JOBSPY_ALLOWED_ORIGINS.
 */
export function LocalJobSpy({ enabled }: { enabled: boolean }) {
  const [url, setUrl] = useState(jobSpyUrl);
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [, start] = useTransition();
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  function test() {
    setMessage(null);
    setBusy("test");
    setJobSpyUrl(url || DEFAULT_JOBSPY_URL);
    start(async () => {
      const result = await checkJobSpy(url || DEFAULT_JOBSPY_URL);
      setMessage(result.ok ? { ok: true, text: "Connected to JobSpy on this computer." } : { ok: false, text: result.error });
      setBusy(null);
    });
  }

  function save(next: boolean) {
    setMessage(null);
    setBusy("save");
    setJobSpyUrl(url || DEFAULT_JOBSPY_URL);
    start(async () => {
      // Only turn it on when the service answers, so searches don't silently miss the boards.
      if (next) {
        const check = await checkJobSpy(url || DEFAULT_JOBSPY_URL);
        if (!check.ok) {
          setMessage({ ok: false, text: check.error });
          setBusy(null);
          return;
        }
      }
      const result = await saveJobSpyEnabled({ enabled: next });
      setMessage(
        result.ok
          ? { ok: true, text: next ? "On. LinkedIn, Indeed and other boards are now part of every search." : "Off." }
          : { ok: false, text: result.error },
      );
      if (result.ok) setConfirming(false);
      setBusy(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">LinkedIn, Indeed and more via JobSpy</p>
        <p className="text-sm text-muted">
          Free and no key needed. Searches LinkedIn, Indeed, Google Jobs, Glassdoor and regional boards through the JobSpy service on your
          own computer. Results go straight from it to this browser. Powered by{" "}
          <a
            href="https://github.com/speedyapply/JobSpy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            JobSpy <ExternalLink className="size-3" />
          </a>
          , an open-source project by Cullen Watson and contributors.
        </p>
      </div>

      <details className="rounded-2xl border border-border p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-fg">How to run JobSpy on this computer</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p>
              With <span className="font-medium text-fg">Docker</span>, build it once, then start it:
            </p>
            <CopyBlock code={`docker build -t hireme-jobspy ${IMAGE_SOURCE}`} />
            <CopyBlock code={`docker run -d --name hireme-jobspy -p 127.0.0.1:8765:8000 -e JOBSPY_ALLOWED_ORIGINS=${origin} hireme-jobspy`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p>
              Or with <span className="font-medium text-fg">Python 3.10+</span>, from the{" "}
              <code className="font-mono text-xs">services/jobspy</code> folder of HireMe:
            </p>
            <CopyBlock code="pip install -r requirements.txt" />
            <p>Then start it (PowerShell, or macOS and Linux):</p>
            <CopyBlock code={`$env:JOBSPY_ALLOWED_ORIGINS="${origin}"; python server.py`} />
            <CopyBlock code={`JOBSPY_ALLOWED_ORIGINS=${origin} python3 server.py`} />
          </div>
          <p className="text-xs text-subtle">
            JobSpy only answers the sites listed in JOBSPY_ALLOWED_ORIGINS, and only listens on this computer. If your browser asks to let
            this site access devices on your local network, allow it.
          </p>
        </div>
      </details>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jobspy-url">JobSpy address</Label>
        <div className="flex gap-2">
          <Input id="jobspy-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_JOBSPY_URL} />
          <Button type="button" variant="secondary" onClick={test} disabled={busy !== null} className="shrink-0">
            {busy === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />} Test
          </Button>
        </div>
      </div>

      {confirming && (
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          This reads public job pages from your own network. These sites&apos; terms don&apos;t allow automated access, and they may
          rate-limit or block your connection for a while. Use it for your own job search only.
        </p>
      )}
      {message && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        {enabled ? (
          <Button variant="ghost" onClick={() => save(false)} disabled={busy !== null}>
            {busy === "save" && <Loader2 className="animate-spin" />} Turn off
          </Button>
        ) : confirming ? (
          <>
            <Button onClick={() => save(true)} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />} I understand, turn it on
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={busy !== null}>
            Turn on
          </Button>
        )}
      </div>
    </div>
  );
}
