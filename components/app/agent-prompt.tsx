"use client";

import { Bot, Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { getAgentPromptsMode } from "@/app/(app)/settings/actions";
import { LearnMore } from "@/components/app/learn-more";
import { isLite } from "@/lib/mode";
import { cn } from "@/lib/utils";

// Asked once per page load; every card on the page shares the answer.
let mode: Promise<boolean> | null = null;

/** Whether to show agent requests: the MCP server is on and the agent writes (lite has no MCP server). */
function useAgentPrompts(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (isLite) return;
    mode ??= getAgentPromptsMode().catch(() => false);
    let live = true;
    void mode.then((value) => {
      if (live) setOn(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/**
 * Where a feature needs AI and RolePort has none, a ready-made request to paste into the AI agent
 * the user connected over MCP (Claude, ChatGPT…), filled in for this job, application or interview.
 * Renders nothing unless the MCP server is on and the agent writes.
 */
export function AgentPrompt({ prompt, what, className }: { prompt: string; what: string; className?: string }) {
  const on = useAgentPrompts();
  const [copied, setCopied] = useState(false);
  if (!on) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the text is still selectable.
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-brand/20 bg-brand-soft/40 p-3 text-[13px]", className)}>
      <div className="flex items-start gap-2.5">
        <Bot className="mt-0.5 size-4 shrink-0 text-brand-ink" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">Or ask your AI agent</p>
          <p className="text-muted">
            Paste this into Claude, ChatGPT or another agent connected to RolePort, and it {what}. <LearnMore doc="ai/agents" />
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:border-border-strong"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-36 overflow-auto rounded-md bg-surface px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">{prompt}</pre>
    </div>
  );
}
