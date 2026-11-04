/*
 * The JobSpy program files the desktop app may download (lib/desktop/jobspy.ts), one per system,
 * built by .github/workflows/jobspy-binary.yml. The SHA-256 is pinned here, in the app's own code,
 * so a file changed after release is refused. A system without an entry can't download JobSpy yet.
 */

export type JobSpyFile = { url: string; size: number; sha256: string };
export type JobSpyRelease = { version: string; files: Partial<Record<string, JobSpyFile>> };

export const JOBSPY_RELEASE: JobSpyRelease = {
  // python-jobspy's version (services/jobspy/requirements.txt).
  version: "1.4.0",
  // Keys are `${process.platform}-${process.arch}`, filled in from the workflow's summary, e.g.
  // "win32-x64": {
  //   url: "https://github.com/FrancisCodex/RolePort/releases/download/jobspy-1.4.0/jobspy-server-win32-x64.exe",
  //   size: 37641787,
  //   sha256: "…",
  // },
  files: {},
};
