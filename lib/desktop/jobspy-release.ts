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
  // Keys are `${process.platform}-${process.arch}`, from the summary of the workflow run that built
  // and smoke-tested them (JobSpy binaries #2).
  files: {
    "win32-x64": {
      url: "https://github.com/FrancisCodex/RolePort/releases/download/jobspy-1.4.0/jobspy-server-win32-x64.exe",
      size: 38886621,
      sha256: "4b7ab5ffca9e3d236588c4608f26c750f7fa7a6fcc748fe675564d4579a78a3b",
    },
    "darwin-arm64": {
      url: "https://github.com/FrancisCodex/RolePort/releases/download/jobspy-1.4.0/jobspy-server-darwin-arm64",
      size: 31575584,
      sha256: "bd8d9cd0f6376c8626f7a7eccadcde9a5855e398b9257198561e1d557be4d394",
    },
    "linux-x64": {
      url: "https://github.com/FrancisCodex/RolePort/releases/download/jobspy-1.4.0/jobspy-server-linux-x64",
      size: 70213976,
      sha256: "ea0032710fe842585cc59f4690f4da08e99a22a19e85e04c0cac8701cc8908b2",
    },
  },
};
