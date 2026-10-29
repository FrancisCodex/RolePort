"use client";

import { LiteData } from "@/components/app/lite-data";
import { SettingsView } from "./settings-view";

/** Settings in the lite edition: loaded from the browser database. */
export function LiteSettings() {
  return (
    <LiteData
      load={(q) => q.loadSettings()}
      tables={["user_settings", "followed_company"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {({ jobspyEnabled, ...data }) => (
        <SettingsView
          {...data}
          aiInBrowser
          // JobSpy runs on the user's computer; the browser calls it (lib/client/lite-jobspy.ts).
          jobSpy={null}
          localJobSpy={{ enabled: jobspyEnabled }}
          dataNote="Your profile, jobs and applications are stored in this browser, on this device. Nothing is kept on RolePort's servers. Clearing this site's data deletes them."
          keyNote="Your key is stored in this browser and sent only to the provider. AI requests, your CV included, go straight from this browser to the provider you choose."
        />
      )}
    </LiteData>
  );
}
