import { and, asc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { ATS_IDS, ATS_LABELS, MAX_FOLLOWED, type AtsId, type CompanyRef } from "@/lib/jobs/sources/companies/types";

export const TOO_MANY_COMPANIES = `You can follow up to ${MAX_FOLLOWED} companies. Remove one to add another.`;

/*
 * Followed companies, shared by the server and the lite edition's browser database.
 * No auth here: callers pass the user.
 */

export type FollowedCompany = typeof schema.followedCompany.$inferSelect;

export async function readFollowedCompanies(db: AnyDb, userId: string): Promise<FollowedCompany[]> {
  return db
    .select()
    .from(schema.followedCompany)
    .where(eq(schema.followedCompany.userId, userId))
    .orderBy(asc(schema.followedCompany.name));
}

/** A followed company as Settings shows it. */
export type FollowedCompanyView = { id: string; name: string; boardLabel: string; careersUrl: string | null };

export function followedCompanyView(row: FollowedCompany): FollowedCompanyView {
  return { id: row.id, name: row.name, boardLabel: ATS_LABELS[row.ats as AtsId] ?? row.ats, careersUrl: row.careersUrl };
}

/** What a search needs: the user's companies on the hiring software RolePort reads. */
export function companyRefs(rows: FollowedCompany[]): CompanyRef[] {
  return rows.flatMap((r) => (ATS_IDS.includes(r.ats as AtsId) ? [{ ats: r.ats as AtsId, slug: r.slug, name: r.name }] : []));
}

/** Adds (or renames) a followed company. Returns null when the user already follows MAX_FOLLOWED others. */
export async function insertFollowedCompany(
  db: AnyDb,
  userId: string,
  company: { ats: AtsId; slug: string; name: string; careersUrl: string | null },
): Promise<FollowedCompany | null> {
  const existing = await readFollowedCompanies(db, userId);
  const known = existing.some((c) => c.ats === company.ats && c.slug === company.slug);
  if (!known && existing.length >= MAX_FOLLOWED) return null;
  const [row] = await db
    .insert(schema.followedCompany)
    .values({ userId, ...company })
    .onConflictDoUpdate({
      target: [schema.followedCompany.userId, schema.followedCompany.ats, schema.followedCompany.slug],
      set: { name: company.name, careersUrl: company.careersUrl },
    })
    .returning();
  return row;
}

export async function deleteFollowedCompany(db: AnyDb, userId: string, id: string): Promise<void> {
  await db.delete(schema.followedCompany).where(and(eq(schema.followedCompany.id, id), eq(schema.followedCompany.userId, userId)));
}
