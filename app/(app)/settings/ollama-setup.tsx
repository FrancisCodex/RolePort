"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { isLocalUrl } from "@/lib/ai/local-server";
import { cn } from "@/lib/utils";

type Os = "windows" | "mac" | "linux";

const OS_LABEL: Record<Os, string> = { windows: "Windows", mac: "macOS", linux: "Linux" };

function guessOs(): Os {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  return "linux";
}

function steps(os: Os, origin: string): { text: string; code?: string }[] {
  switch (os) {
    case "windows":
      return [
        { text: "In PowerShell, run:", code: `setx OLLAMA_ORIGINS "${origin}"` },
        { text: "Quit Ollama from the system tray, then open it again." },
      ];
    case "mac":
      return [
        { text: "In Terminal, run:", code: `launchctl setenv OLLAMA_ORIGINS "${origin}"` },
        { text: "Quit Ollama from the menu bar, then open it again." },
      ];
    case "linux":
      return [
        { text: "Open the service settings:", code: "sudo systemctl edit ollama.service" },
        { text: "Add these lines, then save:", code: `[Service]\nEnvironment="OLLAMA_ORIGINS=${origin}"` },
        { text: "Restart Ollama:", code: "sudo systemctl restart ollama" },
      ];
  }
}

/** A command with a copy button. */
export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2">
      <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre text-fg">{code}</pre>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        aria-label={copied ? "Copied" : "Copy command"}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg"
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

/**
 * Lite edition: how to let this site use Ollama on the user's computer. Ollama only
 * answers web pages from origins it allows (OLLAMA_ORIGINS); localhost is allowed by default.
 */
export function OllamaSetup({ model }: { model: string }) {
  const [os, setOs] = useState<Os>(guessOs);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const allowedByDefault = isLocalUrl(origin);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 text-sm sm:col-span-2">
      <div>
        <p className="font-semibold">Let this site use Ollama</p>
        <p className="mt-1 text-muted">
          HireMe Lite runs in your browser and talks to Ollama on this computer directly. Nothing goes through HireMe&apos;s servers.
        </p>
      </div>

      {allowedByDefault ? (
        <p className="text-muted">Ollama already allows {origin}, so there&apos;s nothing to set up. Make sure Ollama is running.</p>
      ) : (
        <>
          <p className="text-muted">Ollama only answers sites you allow. Allow {origin} once:</p>
          <div className="flex gap-1.5" role="group" aria-label="Your operating system">
            {(Object.keys(OS_LABEL) as Os[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setOs(id)}
                aria-pressed={os === id}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  os === id ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong",
                )}
              >
                {OS_LABEL[id]}
              </button>
            ))}
          </div>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted">
            {steps(os, origin).map((step) => (
              <li key={step.text} className="flex flex-col gap-1.5">
                {step.text}
                {step.code && <CopyBlock code={step.code} />}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="flex flex-col gap-1.5 text-muted">
        <p>Don&apos;t have the model yet? Download it with:</p>
        <CopyBlock code={`ollama pull ${model || "gemma4:12b"}`} />
      </div>
      <p className="text-xs text-subtle">
        If your browser asks to let this site access devices on your local network, choose Allow. Safari can&apos;t always reach Ollama: use
        Chrome, Edge or Firefox, or the self-hosted install.
      </p>
    </div>
  );
}
