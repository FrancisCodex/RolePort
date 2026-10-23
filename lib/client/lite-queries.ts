import { eq } from "drizzle-orm";
import { getBrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import * as schema from "@/lib/db/schema";
import { readProfile, type ProfileView } from "@/lib/profile/queries";

/* Reads for the lite edition's pages, against the browser database. Load with import(). */

export async function loadProfile(): Promise<ProfileView> {
  const db = await getBrowserDb();
  const [user] = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, LOCAL_USER.id));
  return readProfile(db, user ?? LOCAL_USER);
}
