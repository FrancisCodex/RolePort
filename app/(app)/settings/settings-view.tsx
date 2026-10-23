import { Database, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsForm, type AiSettingsView } from "./ai-settings-form";
import { BackupControls } from "./backup-controls";
import { JobSourceForm, JobSpyToggle } from "./job-source-form";
import { LocalJobSpy } from "./local-jobspy";

export type SettingsData = {
  ai: AiSettingsView;
  /** Whether to suggest a local model (Ollama) first. */
  localMode: boolean;
  /** AI calls run from this browser and data lives in it (the lite edition). */
  aiInBrowser?: boolean;
  rapidApiKeyHint: string | null;
  /** The JobSpy switch, when this install can use it. */
  jobSpy: { enabled: boolean; reachable: boolean } | null;
  /** Lite: JobSpy on the user's computer, called from the browser. */
  localJobSpy?: { enabled: boolean };
  /** Where the user's data and keys are kept, for the "Your data" card. */
  dataNote: string;
  keyNote: string;
};

/** The Settings cards, shared by the server page and the lite edition. */
export function SettingsView({ ai, localMode, aiInBrowser, rapidApiKeyHint, jobSpy, localJobSpy, dataNote, keyNote }: SettingsData) {
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
          <AiSettingsForm initial={ai} localMode={localMode} aiInBrowser={aiInBrowser} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job sources</CardTitle>
          <CardDescription>
            freehire and Jobicy work without a key, in every country. Add JSearch to include Google for Jobs listings from JobStreet,
            Indeed, LinkedIn and Kalibrr.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <JobSourceForm rapidApiKeyHint={rapidApiKeyHint} />
          {jobSpy && <JobSpyToggle enabled={jobSpy.enabled} reachable={jobSpy.reachable} />}
          {localJobSpy && <LocalJobSpy enabled={localJobSpy.enabled} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted">
          <p className="flex gap-3">
            <Database className="mt-0.5 size-4 shrink-0 text-brand" />
            {dataNote}
          </p>
          <p className="flex gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
            {keyNote}
          </p>
          <BackupControls browserStorage={aiInBrowser} />
        </CardContent>
      </Card>
    </div>
  );
}
