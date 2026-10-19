import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Data Access Layer entry point: the only place that reads the session.
 * Call it from components rendered inside a <Suspense> boundary, and again in
 * every server action / route handler rather than trusting the client.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});
