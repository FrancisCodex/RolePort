"use client";

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { McpAccess } from "@/lib/mcp/access";
import { agentSetups } from "@/lib/mcp/setup";
import { regenerateMcpToken, saveMcpAccess, saveMcpPreferences } from "./actions";

export type McpSettingsView = {
  access: McpAccess | null;
  writer: "auto" | "roleport" | "agent";
  usage: "low" | "balanced" | "best";
  /** Whether RolePort has an AI of its own set up. */
  hasAi: boolean;
  /** Where agents reach this install's MCP server. */
  url: string;
  /** The stdio bridge for agents that can't connect over HTTP (Claude Desktop). */
  bridgePath: string;
};

const ACCESS_OPTIONS = [
  { value: "write", label: "Read and change" },
  { value: "read", label: "Read only" },
];

const WRITER_OPTIONS = [
  { value: "auto", label: "RolePort's AI, else the agent" },
  { value: "agent", label: "Always the agent" },
  { value: "roleport", label: "Only RolePort's AI" },
];

const USAGE_OPTIONS = [
  { value: "low", label: "Keep usage low" },
  { value: "balanced", label: "Balanced" },
  { value: "best", label: "Best quality" },
];

function writerNote(writer: McpSettingsView["writer"], hasAi: boolean): string {
  if (writer === "roleport") {
    return hasAi
      ? "Evaluations, CVs, letters and emails always use the AI set up above, never the agent's."
      : "No AI is set up above, so agents can't evaluate jobs or write CVs, letters or emails.";
  }
  if (writer === "agent" || !hasAi) {
    return "The agent's own model writes evaluations, CVs, letters, emails and CV imports, from the facts and instructions RolePort gives it. RolePort checks every answer the same way it checks its own AI's, then saves it. This uses your Claude or ChatGPT plan, not an API key.";
  }
  return "The AI set up above writes them. Without it, the agent writes them instead.";
}

/** Settings → Connect an AI agent: the switch, the token (shown once) and each agent's setup. */
export function McpForm({ initial }: { initial: McpSettingsView }) {
  const [access, setAccess] = useState<McpAccess>(initial.access ?? "write");
  const [writer, setWriter] = useState(initial.writer);
  const [usage, setUsage] = useState(initial.usage);
  const [token, setToken] = useState<string | null>(null);
  const [agent, setAgent] = useState("claude-code");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const on = initial.access !== null;

  function run(task: () => Promise<{ ok: boolean; text: string } | null>) {
    setMessage(null);
    start(async () => setMessage(await task()));
  }

  const save = (next: McpAccess | null) =>
    run(async () => {
      const result = await saveMcpAccess({ access: next });
      if (!result.ok) return { ok: false, text: result.error };
      if (result.data.token) setToken(result.data.token);
      if (!next) setToken(null);
      return next ? null : { ok: true, text: "Off. Agents can no longer reach RolePort, and the token is forgotten." };
    });

  const regenerate = () =>
    run(async () => {
      const result = await regenerateMcpToken();
      if (!result.ok) return { ok: false, text: result.error };
      setToken(result.data.token);
      return { ok: true, text: "New token made. Agents set up with the old one stop working until you update them." };
    });

  const savePreferences = (next: { writer: McpSettingsView["writer"]; usage: McpSettingsView["usage"] }) =>
    run(async () => {
      setWriter(next.writer);
      setUsage(next.usage);
      const result = await saveMcpPreferences(next);
      return result.ok ? null : { ok: false, text: result.error };
    });

  const setups = agentSetups({ url: initial.url, token, bridgePath: initial.bridgePath });
  const setup = setups.find((s) => s.id === agent) ?? setups[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mcp-access">What agents may do</Label>
          <Select
            id="mcp-access"
            options={ACCESS_OPTIONS}
            value={access}
            onValueChange={(value) => {
              setAccess(value as McpAccess);
              if (on) save(value as McpAccess);
            }}
            disabled={pending}
            className="w-48"
          />
        </div>
        {on ? (
          <>
            <Button variant="secondary" onClick={regenerate} disabled={pending}>
              <KeyRound /> New token
            </Button>
            <Button variant="ghost" onClick={() => save(null)} disabled={pending}>
              Turn off
            </Button>
          </>
        ) : (
          <Button onClick={() => save(access)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Turn on
          </Button>
        )}
        {pending && on && <Loader2 className="mb-2 size-4 animate-spin text-subtle" />}
      </div>
      <p className="text-[13px] text-muted">
        {access === "read"
          ? "Agents can read your profile, search jobs and read your applications. They can't save, evaluate or change anything."
          : "Agents can also save jobs, run evaluations, tailor CVs, draft emails and update your tracker. They never apply or send email for you, and most agents ask you before each change."}
      </p>

      {message && (
        <p className={`rounded-md px-3 py-2 text-[13px] font-medium ${message.ok ? "border border-success/20 bg-success-soft text-success" : "border border-danger/20 bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}

      {on && access === "write" && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcp-writer">Who writes evaluations, CVs and emails</Label>
              <Select
                id="mcp-writer"
                options={WRITER_OPTIONS}
                value={writer}
                onValueChange={(value) => savePreferences({ writer: value as McpSettingsView["writer"], usage })}
                disabled={pending}
                className="w-64"
              />
            </div>
            {writer !== "roleport" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-usage">When the agent writes</Label>
                <Select
                  id="mcp-usage"
                  options={USAGE_OPTIONS}
                  value={usage}
                  onValueChange={(value) => savePreferences({ writer, usage: value as McpSettingsView["usage"] })}
                  disabled={pending}
                  className="w-48"
                />
              </div>
            )}
          </div>
          <p className="text-[13px] text-muted">{writerNote(writer, initial.hasAi)}</p>
          {writer !== "roleport" && (
            <p className="text-[13px] text-muted">
              RolePort can&apos;t choose the agent&apos;s model; your agent app does. These are routine tasks, so a fast or mid-size model at low
              or medium effort is enough, and uses much less of your plan than the largest one. RolePort tells the agent what you chose here
              and how much effort each task needs.
            </p>
          )}
        </div>
      )}

      {on && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {token ? (
            <p className="rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[13px] text-warning">
              This is the only time the token is shown. Copy the setup for your agent now. Anyone with the token can use RolePort as you.
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              The token was shown when you turned this on. If you didn&apos;t copy it, make a new one; the setup below then fills it in.
            </p>
          )}
          <div role="tablist" aria-label="Agent" className="flex flex-wrap gap-1.5">
            {setups.map((s) => (
              <Button key={s.id} role="tab" aria-selected={s.id === agent} size="sm" variant={s.id === agent ? "soft" : "ghost"} onClick={() => setAgent(s.id)}>
                {s.label}
              </Button>
            ))}
          </div>
          <div role="tabpanel" className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">{setup.where}</p>
            <CodeBlock code={setup.code} />
            {access === "write" && writer !== "roleport" && <p className="text-[13px] text-muted">Keep usage down: {setup.usage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the text is still selectable.
    }
  }

  return (
    <div className="relative rounded-lg bg-surface-3 text-[12.5px] ring-1 ring-border">
      <button
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="overflow-x-auto px-4 py-3.5 pr-12 font-mono leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}
