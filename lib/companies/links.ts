/** The Jobs page's view of every job at the followed companies, or at one of them. */
export function companyJobsHref(companyId?: string): string {
  return `/jobs?view=companies${companyId ? `&company=${encodeURIComponent(companyId)}` : ""}`;
}
