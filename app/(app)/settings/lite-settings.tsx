"use client";

import { LiteData } from "@/components/app/lite-data";
import { SettingsView } from "./settings-view";

/** Settings in the lite edition: loaded from the browser database. */
export function LiteSettings() {
  return (
    <LiteData
      load={(q) => q.loadSettings()}
      tables={["user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}
    >
      {(data) => (
        <SettingsView
          {...data}
          // Lite's story is a model on the user's own machine, so suggest Ollama first.
          localMode
          // Connecting JobSpy on this computer arrives with phase 6 (docs/LITE-IMPLEMENTATION.md).
          jobSpy={null}
          dataNote="Your profile, jobs and applications are stored in this browser, on this device. Nothing is kept on HireMe's servers. Clearing this site's data deletes them."
          keyNote="API keys are stored in this browser and sent only to the provider you choose. Your CV is only sent to the AI provider you choose."
        />
      )}
    </LiteData>
  );
}
