import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleEnabled } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Let&apos;s get you hired</h1>
      <p className="mt-1 mb-6 text-[13px] text-muted">Set up your profile in about 3 minutes.</p>
      <Suspense>
        <AuthForm mode="sign-up" googleEnabled={isGoogleEnabled} />
      </Suspense>
    </>
  );
}
