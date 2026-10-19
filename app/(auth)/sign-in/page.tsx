import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleEnabled } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back 👋</h1>
      <p className="mt-2 mb-8 text-muted">Pick up where you left off. Your matches are waiting.</p>
      <Suspense>
        <AuthForm mode="sign-in" googleEnabled={isGoogleEnabled} />
      </Suspense>
    </>
  );
}
