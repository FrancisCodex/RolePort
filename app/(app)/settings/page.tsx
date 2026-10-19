import { Database, Lock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeAiConfig, getAiConfig, getMySettingsRow } from "@/lib/ai/config";
import { AI_PRESETS, type AiPresetId } from "@/lib/ai/presets";
import { isLocalMode } from "@/lib/env";
import { decryptSecret, maskSecret } from "@/lib/secrets";
import { AiSettingsForm, type AiSettingsView } from "./ai-settings-form";
import { JobSourceForm } from "./job-source-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Bring your own AI and job-source keys. Everything stays on your server." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const [row, active] = await Promise.all([getMySettingsRow(), getAiConfig()]);

  const preset = row?.aiPreset && row.aiPreset in AI_PRESETS ? (row.aiPreset as AiPresetId) : null;
  const ai: AiSettingsView = {
    preset: row?.aiProvider ? preset : null,
    baseUrl: row?.aiBaseUrl ?? null,
    model: row?.aiModel ?? null,
    reasoningEffort: row?.aiReasoningEffort ?? null,
    apiKeyHint: maskSecret(decryptSecret(row?.aiApiKeyEnc)),
    activeLabel: active ? describeAiConfig(active) : null,
    activeSource: active?.source ?? null,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            Used to read your CV, evaluate fit and tailor applications. Use your own API key, or run a model locally with Ollama for free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsForm initial={ai} localMode={isLocalMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job sources</CardTitle>
          <CardDescription>
            freehire and Jobicy work without a key. Add JSearch to include Google for Jobs listings from JobStreet, Indeed, LinkedIn and Kalibrr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobSourceForm rapidApiKeyHint={maskSecret(decryptSecret(row?.rapidApiKeyEnc))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted">
          <p className="flex gap-3">
            <Database className="mt-0.5 size-4 shrink-0 text-brand" />
            {process.env.DATABASE_URL
              ? "Your profile, jobs and applications are stored in the Postgres database set in DATABASE_URL."
              : "Your profile, jobs and applications are stored on this computer in the .data folder. Delete it to start over."}
          </p>
          <p className="flex gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
            API keys are encrypted before they&apos;re saved and are never sent back to your browser. Your CV is only sent to the AI provider you choose.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
