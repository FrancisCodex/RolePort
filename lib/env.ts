/** Feature switches derived from environment variables. Safe to import anywhere on the server. */
export const isLocalMode = process.env.HIREME_LOCAL_MODE === "true";

/** Base URL of the JobSpy sidecar (services/jobspy), when one is running. */
export const jobSpyUrl = process.env.JOBSPY_URL?.replace(/\/+$/, "") || null;
