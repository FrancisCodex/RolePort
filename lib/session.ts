import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { LOCAL_USER } from "@/lib/db/local-user";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Data Access Layer entry point: the only place that resolves the current user.
 * RolePort has no sign-in: one built-in user owns all the data on this install.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Request-time only: never touch the local database while prerendering at build time.
  await connection();
  const db = await getDb();
  await db.insert(schema.user).values(LOCAL_USER).onConflictDoNothing();
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, LOCAL_USER.id));
  return { id: row.id, name: row.name, email: row.email, image: row.image ?? null };
});
