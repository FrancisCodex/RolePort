/**
 * The credit line and link each job source's terms require on job pages, by source id.
 * Plain data so pages can show it in both editions (the sources themselves are server code).
 */
export const SOURCE_CREDITS: Record<string, { name: string; url: string }> = {
  jsearch: { name: "Google for Jobs via JSearch", url: "https://rapidapi.com/letscrunch/api/jsearch" },
  freehire: { name: "freehire.me", url: "https://freehire.me" },
  jobicy: { name: "Jobicy", url: "https://jobicy.com" },
  // JobSpy boards (lib/jobs/sources/jobspy.ts): the credit is the board itself.
  linkedin: { name: "LinkedIn", url: "https://www.linkedin.com/jobs" },
  indeed: { name: "Indeed", url: "https://www.indeed.com" },
  google: { name: "Google Jobs", url: "https://www.google.com/search?udm=8" },
  glassdoor: { name: "Glassdoor", url: "https://www.glassdoor.com" },
  bayt: { name: "Bayt", url: "https://www.bayt.com" },
  naukri: { name: "Naukri", url: "https://www.naukri.com" },
  bdjobs: { name: "BDJobs", url: "https://bdjobs.com" },
  zip_recruiter: { name: "ZipRecruiter", url: "https://www.ziprecruiter.com" },
  hellowork: { name: "HelloWork", url: "https://www.hellowork.com" },
};

/** The credit line a source's terms require, for job pages. */
export function sourceCredit(id: string): { name: string; url: string } | null {
  return SOURCE_CREDITS[id] ?? null;
}
