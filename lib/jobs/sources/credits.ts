/**
 * The credit line and link each job source's terms require on job pages, by source id.
 * Plain data so pages can show it in both editions (the sources themselves are server code).
 */
export const SOURCE_CREDITS: Record<string, { name: string; url: string }> = {
  jsearch: { name: "Google for Jobs via JSearch", url: "https://rapidapi.com/letscrunch/api/jsearch" },
  freehire: { name: "freehire.me", url: "https://freehire.me" },
  jobicy: { name: "Jobicy", url: "https://jobicy.com" },
  remotive: { name: "Remotive", url: "https://remotive.com" },
  remoteok: { name: "Remote OK", url: "https://remoteok.com" },
  himalayas: { name: "Himalayas", url: "https://himalayas.app" },
  arbeitnow: { name: "Arbeitnow", url: "https://www.arbeitnow.com" },
  platsbanken: { name: "Platsbanken (Arbetsförmedlingen), via JobTech", url: "https://arbetsformedlingen.se/platsbanken" },
  // Company job-board feeds (lib/jobs/sources/companies): postings straight from the employer.
  greenhouse: { name: "Greenhouse (the company's careers page)", url: "https://www.greenhouse.com" },
  lever: { name: "Lever (the company's careers page)", url: "https://www.lever.co" },
  ashby: { name: "Ashby (the company's careers page)", url: "https://www.ashbyhq.com" },
  smartrecruiters: { name: "SmartRecruiters (the company's careers page)", url: "https://www.smartrecruiters.com" },
  workable: { name: "Workable (the company's careers page)", url: "https://www.workable.com" },
  recruitee: { name: "Recruitee (the company's careers page)", url: "https://recruitee.com" },
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
