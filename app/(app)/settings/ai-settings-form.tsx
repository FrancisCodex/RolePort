"use client";

import { Check, ExternalLink, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AI_PRESET_IDS, AI_PRESETS, type AiPresetId } from "@/lib/ai/presets";
import { cn } from "@/lib/utils";
import { fetchModels, saveAiSettings, testAiConnection, turnOffAi, type AiSettingsInput } from "./actions";

export type AiSettingsView = {
  preset: AiPresetId | null;
  baseUrl: string | null;
  model: string | null;
  reasoningEffort: string | null;
  apiKeyHint: string | null;
  /** What's active right now (from Settings or environment), e.g. "Ollama · gemma4:12b". */
  activeLabel: string | null;
  activeSource: "settings" | "env" | null;
};

type Status = { tone: "success" | "error" | "info"; text: string } | null;

export function AiSettingsForm({ initial, localMode }: { initial: AiSettingsView; localMode: boolean }) {
  const [preset, setPreset] = useState<AiPresetId>(initial.preset ?? (localMode ? "ollama" : "anthropic"));
  const config = AI_PRESETS[preset];
  const samePreset = preset === initial.preset;

  const [baseUrl, setBaseUrl] = useState(samePreset ? (initial.baseUrl ?? config.baseUrl ?? "") : (config.baseUrl ?? ""));
  const [model, setModel] = useState(samePreset ? (initial.model ?? config.defaultModel) : config.defaultModel);
  const [reasoning, setReasoning] = useState<string>(
    samePreset ? (initial.reasoningEffort ?? "") : (config.reasoningEffort ?? ""),
  );
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"save" | "test" | "models" | "off" | null>(null);

  const keyHint = samePreset ? initial.apiKeyHint : null;

  function choosePreset(id: AiPresetId) {
    const next = AI_PRESETS[id];
    const isSaved = id === initial.preset;
    setPreset(id);
    setBaseUrl(isSaved ? (initial.baseUrl ?? next.baseUrl ?? "") : (next.baseUrl ?? ""));
    setModel(isSaved ? (initial.model ?? next.defaultModel) : next.defaultModel);
    setReasoning(isSaved ? (initial.reasoningEffort ?? "") : (next.reasoningEffort ?? ""));
    setApiKey("");
    setModels([]);
    setStatus(null);
    if (!next.needsKey && next.provider === "openai_compatible") loadModels(id, next.baseUrl ?? "", "");
  }

  function input(overrides: Partial<AiSettingsInput> = {}): AiSettingsInput {
    return {
      preset,
      baseUrl: config.provider === "openai_compatible" ? baseUrl || null : null,
      model,
      apiKey: apiKey || null,
      clearApiKey: false,
      reasoningEffort: config.provider === "openai_compatible" && reasoning ? (reasoning as AiSettingsInput["reasoningEffort"]) : null,
      ...overrides,
    };
  }

  function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    setStatus(null);
    start(async () => {
      await task();
      setBusy(null);
    });
  }

  function loadModels(id = preset, url = baseUrl, key = apiKey) {
    run("models", async () => {
      const result = await fetchModels({ ...input(), preset: id, baseUrl: url || null, apiKey: key || null });
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setModels(result.data);
      if (result.data.length === 0) setStatus({ tone: "info", text: "No models found. Pull one first, e.g. `ollama pull gemma4:12b`." });
      else setModel((m) => (m && result.data.includes(m) ? m : result.data[0]));
    });
  }

  const showKey = config.needsKey || preset === "custom";

  return (
    <div className="flex flex-col gap-5">
      {initial.activeLabel ? (
        <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <Check className="size-4" /> AI is on: {initial.activeLabel}
          {initial.activeSource === "env" && <span className="font-normal opacity-80">(from environment variables)</span>}
        </p>
      ) : (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
          AI is off. Job search, quick match and the pipeline still work. Pick a provider to turn on CV import, fit evaluation and tailored applications.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {AI_PRESET_IDS.map((id) => {
          const p = AI_PRESETS[id];
          const active = id === preset;
          return (
            <button
              key={id}
              type="button"
              onClick={() => choosePreset(id)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                active ? "border-brand bg-brand-soft" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <span className={cn("font-semibold", active && "text-brand-ink")}>{p.label}</span>
              <span className="text-xs text-muted">{p.description}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {config.provider === "openai_compatible" && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input id="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" />
            {preset === "ollama" && (
              <p className="text-xs text-subtle">
                Running HireMe in Docker? Use http://host.docker.internal:11434/v1.
              </p>
            )}
          </div>
        )}

        {showKey && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="apiKey">API key{!config.needsKey && " (optional)"}</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyHint ? `Saved: ${keyHint}. Leave blank to keep it.` : "Paste your key"}
            />
            {config.keyUrl && (
              <a href={config.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Get a {config.label} key <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model">Model</Label>
          <div className="flex gap-2">
            {models.length > 0 ? (
              <Select
                id="model"
                value={model}
                placeholder="Choose a model"
                options={models.map((m) => ({ value: m, label: m }))}
                onValueChange={setModel}
              />
            ) : (
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model name" />
            )}
            <Button type="button" variant="secondary" size="icon" className="size-12 shrink-0" aria-label="Load models" onClick={() => loadModels()} disabled={pending}>
              {busy === "models" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </Button>
          </div>
          {preset === "ollama" && (
            <p className="text-xs text-subtle">Use a 12B+ model for reliable results, e.g. gemma4:12b or a Qwen 14B–32B.</p>
          )}
        </div>

        {config.provider === "openai_compatible" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reasoning">Thinking</Label>
            <Select
              id="reasoning"
              value={reasoning}
              onValueChange={setReasoning}
              options={[
                { value: "", label: "Provider default" },
                { value: "none", label: "Off (fastest)" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High (slowest, most careful)" },
              ]}
            />
            <p className="text-xs text-subtle">Only for models that think before answering.</p>
          </div>
        )}
      </div>

      {status && (
        <p
          role="status"
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            status.tone === "success" && "bg-success-soft text-success",
            status.tone === "error" && "bg-danger-soft text-danger",
            status.tone === "info" && "bg-brand-soft text-brand-ink",
          )}
        >
          {status.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() =>
            run("save", async () => {
              const result = await saveAiSettings(input());
              setStatus(result.ok ? { tone: "success", text: "Saved. AI features now use this provider." } : { tone: "error", text: result.error });
              if (result.ok) setApiKey("");
            })
          }
          disabled={pending}
        >
          {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />} Save
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            run("test", async () => {
              setStatus({ tone: "info", text: "Testing… local models can take a minute the first time." });
              const result = await testAiConnection(input());
              setStatus(
                result.ok
                  ? { tone: "success", text: `It works (${(result.data.ms / 1000).toFixed(1)}s): “${result.data.reply}”` }
                  : { tone: "error", text: result.error },
              );
            })
          }
          disabled={pending}
        >
          {busy === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
        </Button>
        {initial.activeSource === "settings" && (
          <Button
            variant="ghost"
            onClick={() =>
              run("off", async () => {
                await turnOffAi();
                setStatus({ tone: "info", text: "AI turned off and the saved key removed." });
              })
            }
            disabled={pending}
          >
            Turn off AI
          </Button>
        )}
      </div>
    </div>
  );
}
