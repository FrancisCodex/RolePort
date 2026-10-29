import type { Metadata } from "next";
import { Suspense } from "react";
import { BackToGuide } from "@/components/app/back-to-guide";
import { PageHeader } from "@/components/app/page-header";
import { getAiConfig, getMySettingsRow } from "@/lib/ai/config";
import { followedCompanyView, readFollowedCompanies } from "@/lib/companies/queries";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { jobSpyUrl } from "@/lib/env";
import { isLite } from "@/lib/mode";
import { maskSecret } from "@/lib/secret-hint";
import { decryptSecret } from "@/lib/secrets";
import { LiteSettings } from "./lite-settings";
import { SettingsView } from "./settings-view";
import { aiSettingsView } from "./view";

export const metadata: Metadata = { title: "Settings" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function SettingsPage() {
  return (
    <>
      {/* Reads the URL in the browser, so the page shell still prerenders. */}
      <Suspense>
        <BackToGuide />
      </Suspense>
      <PageHeader
        title="Settings"
        description={`Bring your own AI and job-source keys. Everything stays ${isLite ? "in this browser" : "on your server"}.`}
      />
      {isLite ? (
        <LiteSettings />
      ) : (
        <Suspense fallback={skeleton}>
          <SettingsContent />
        </Suspense>
      )}
    </>
  );
}

/** Whether the JobSpy sidecar answers, so Settings can say when it isn't running. */
async function jobSpyReachable(): Promise<boolean> {
  if (!jobSpyUrl) return false;
  try {
    const res = await fetch(`${jobSpyUrl}/health`, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function SettingsContent() {
  const showJobSpy = Boolean(jobSpyUrl);
  const user = await getCurrentUser();
  const [row, active, reachable, companies] = await Promise.all([
    getMySettingsRow(),
    getAiConfig(),
    showJobSpy ? jobSpyReachable() : false,
    getDb().then((db) => readFollowedCompanies(db, user.id)),
  ]);

  return (
    <SettingsView
      ai={aiSettingsView(row, decryptSecret, active)}
      rapidApiKeyHint={maskSecret(decryptSecret(row?.rapidApiKeyEnc))}
      companies={companies.map(followedCompanyView)}
      jobSpy={showJobSpy ? { enabled: Boolean(row?.jobspyEnabled), reachable } : null}
      cvPrompt={row?.cvPrompt ?? null}
      coverLetterPrompt={row?.coverLetterPrompt ?? null}
      answerPrompt={row?.answerPrompt ?? null}
      interviewPrompt={row?.interviewPrompt ?? null}
      dataNote={
        process.env.DATABASE_URL
          ? "Your profile, jobs and applications are stored in the Postgres database set in DATABASE_URL."
          : "Your profile, jobs and applications are stored on this computer in the .data folder. Delete it to start over."
      }
      keyNote="API keys are encrypted before they're saved and are never sent back to your browser. Your CV is only sent to the AI provider you choose."
    />
  );
}
