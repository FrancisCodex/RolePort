/** Base URL of the JobSpy sidecar (services/jobspy), when one is running. Safe to import anywhere on the server. */
export const jobSpyUrl = process.env.JOBSPY_URL?.replace(/\/+$/, "") || null;
