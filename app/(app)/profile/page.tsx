import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnMore } from "@/components/app/learn-more";
import { PageHeader } from "@/components/app/page-header";
import { getMySettingsRow, isAiConfigured } from "@/lib/ai/config";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { LiteProfile } from "./lite-profile";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description={
          <>
            The better we know you, the better your matches. <LearnMore doc="guides/profile" />
          </>
        }
      />
      {isLite ? (
        <LiteProfile />
      ) : (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}>
          <Editor />
        </Suspense>
      )}
    </>
  );
}

async function Editor() {
  const [{ profile, cvFileName }, aiEnabled, settings] = await Promise.all([getMyProfile(), isAiConfigured(), getMySettingsRow()]);
  return <ProfileEditor initial={profile} initialCvFileName={cvFileName} aiEnabled={aiEnabled} prompt={settings?.profilePrompt ?? null} />;
}
