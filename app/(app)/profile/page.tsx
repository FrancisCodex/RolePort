import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { isAiConfigured } from "@/lib/ai/config";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { LiteProfile } from "./lite-profile";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="The better we know you, the better your matches." />
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
  const [{ profile, cvFileName }, aiEnabled] = await Promise.all([getMyProfile(), isAiConfigured()]);
  return <ProfileEditor initial={profile} initialCvFileName={cvFileName} aiEnabled={aiEnabled} />;
}
