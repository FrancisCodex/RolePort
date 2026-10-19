import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { isLocalMode } from "@/lib/env";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

// Empty name until the user sets one on their profile.
const LOCAL_USER = { id: "local-user", name: "", email: "me@hireme.local" };

/** In local mode there is no sign-in: one built-in user owns all the data. */
async function getLocalUser(): Promise<CurrentUser> {
  // Request-time only: never touch the local database while prerendering at build time.
  await connection();
  const db = await getDb();
  await db.insert(schema.user).values(LOCAL_USER).onConflictDoNothing();
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, LOCAL_USER.id));
  return { id: row.id, name: row.name, email: row.email, image: row.image ?? null };
}

/**
 * Data Access Layer entry point: the only place that resolves the current user.
 * Call it from components rendered inside a <Suspense> boundary, and again in
 * every server action / route handler rather than trusting the client.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  if (isLocalMode) return getLocalUser();

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});
