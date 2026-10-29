import "server-only";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { followedCompanyView, readFollowedCompanies, type FollowedCompanyView } from "./queries";

export async function getMyFollowedCompanies(): Promise<FollowedCompanyView[]> {
  const user = await getCurrentUser();
  return (await readFollowedCompanies(await getDb(), user.id)).map(followedCompanyView);
}
