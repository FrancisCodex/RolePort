import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { isAiEnabled } from "@/lib/env";
import { getMyProfile } from "@/lib/profile/data";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="The better we know you, the better your matches." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const { profile, cvFileName } = await getMyProfile();
  return <ProfileEditor initial={profile} initialCvFileName={cvFileName} aiEnabled={isAiEnabled} />;
}
