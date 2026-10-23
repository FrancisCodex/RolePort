import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { UserSettingsRow } from "@/lib/ai/settings";

/* Settings storage, shared by the server and the lite edition's browser database. */

export async function readSettings(db: AnyDb, userId: string): Promise<UserSettingsRow | null> {
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return row ?? null;
}

/** Create or update the user's settings row with these columns. */
export async function writeSettings(
  db: AnyDb,
  userId: string,
  values: Partial<Omit<typeof schema.userSettings.$inferInsert, "userId">>,
): Promise<void> {
  await db
    .insert(schema.userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: values });
}
