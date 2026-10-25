import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";

/*
 * The documents prepared for an application (a tailored CV, a cover letter): one row per
 * application and kind in the document table, replaced in place with its version going up.
 * Shared by the server and the lite edition's browser database. No auth here: callers pass the user.
 */

export type DocumentKind = (typeof schema.documentKind.enumValues)[number];

const mine = (userId: string, applicationId: string, kind: DocumentKind) =>
  and(eq(schema.document.userId, userId), eq(schema.document.applicationId, applicationId), eq(schema.document.kind, kind));

/** The saved document of this kind for the application, or null if there isn't one yet. */
export async function readAppDocument<T>(
  db: AnyDb,
  userId: string,
  applicationId: string,
  kind: DocumentKind,
): Promise<{ data: T; updatedAt: Date; version: number } | null> {
  const [row] = await db.select().from(schema.document).where(mine(userId, applicationId, kind)).orderBy(desc(schema.document.updatedAt)).limit(1);
  if (!row?.content) return null;
  return { data: row.content as T, updatedAt: row.updatedAt, version: row.version };
}

export async function writeAppDocument(db: AnyDb, userId: string, applicationId: string, kind: DocumentKind, title: string, data: unknown): Promise<void> {
  const [existing] = await db
    .select({ id: schema.document.id, version: schema.document.version })
    .from(schema.document)
    .where(mine(userId, applicationId, kind));
  if (existing) {
    await db.update(schema.document).set({ title, content: data, version: existing.version + 1 }).where(eq(schema.document.id, existing.id));
  } else {
    await db.insert(schema.document).values({ userId, applicationId, kind, title, content: data });
  }
}

export async function deleteAppDocument(db: AnyDb, userId: string, applicationId: string, kind: DocumentKind): Promise<void> {
  await db.delete(schema.document).where(mine(userId, applicationId, kind));
}
