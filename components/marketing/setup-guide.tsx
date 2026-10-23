"use client";

import { Check, Code, Container, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const REPO_URL = "https://github.com/FrancisCodex/HireMe";

const options = [
  {
    id: "docker",
    icon: Container,
    label: "Docker",
    tagline: "Everything included",
    needs: (
      <>
        <a href="https://www.docker.com/products/docker-desktop/" className="font-semibold text-fg underline-offset-4 hover:underline">
          Docker Desktop
        </a>{" "}
        and Git
      </>
    ),
    commands: ["git clone https://github.com/FrancisCodex/HireMe.git", "cd HireMe", "docker compose up -d --build"],
    note: "The first build takes a few minutes. JobSpy (LinkedIn, Indeed and more) is included.",
  },
  {
    id: "node",
    icon: Code,
    label: "Node.js",
    tagline: "For working on the code",
    needs: (
      <>
        <a href="https://nodejs.org" className="font-semibold text-fg underline-offset-4 hover:underline">
          Node.js
        </a>{" "}
        20.9+ (22 recommended) and Git
      </>
    ),
    commands: [
      "git clone https://github.com/FrancisCodex/HireMe.git",
      "cd HireMe",
      "npm install",
      "cp .env.example .env.local",
      "npm run dev",
    ],
    note: "Data is saved in the .data folder. JobSpy is one extra command, see the README.",
  },
] as const;

export function SetupGuide() {
  const [active, setActive] = useState<(typeof options)[number]["id"]>("docker");
  const option = options.find((o) => o.id === active)!;

  return (
    <div className="min-w-0 rounded-3xl border border-border bg-surface p-2 shadow-[var(--shadow-soft)]">
      <div role="tablist" aria-label="Install method" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={o.id === active}
            onClick={() => setActive(o.id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              o.id === active ? "bg-surface text-fg shadow-[var(--shadow-soft)]" : "text-muted hover:text-fg",
            )}
          >
            <o.icon className="size-4 shrink-0" />
            <span className="truncate">{o.label}</span>
            <span className="hidden truncate font-normal text-subtle sm:inline">· {o.tagline}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="p-4 sm:p-5">
        <p className="text-sm text-muted">You need {option.needs}.</p>
        <CodeBlock lines={option.commands} />
        <p className="mt-3 text-sm text-subtle">{option.note}</p>
      </div>
    </div>
  );
}

function CodeBlock({ lines }: { lines: readonly string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the commands are still selectable.
    }
  }

  return (
    <div className="relative mt-3 rounded-2xl bg-[#141416] text-[13px] ring-1 ring-white/5 text-white/90">
      <button
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy commands"}
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
      <pre className="overflow-x-auto px-4 py-3.5 pr-12 font-mono leading-relaxed">
        {lines.map((line) => (
          <div key={line}>
            <span className="text-white/40 select-none">$ </span>
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}

/** GitHub's mark, for links to the repository. lucide-react no longer ships brand icons. */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.3-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.75.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
