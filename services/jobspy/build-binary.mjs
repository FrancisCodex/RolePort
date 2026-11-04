// Builds the JobSpy service as one program file with PyInstaller, for the desktop app (no Python
// needed on the user's computer). Runs on Windows, macOS and Linux, here and in CI
// (.github/workflows/jobspy-binary.yml):
//   node services/jobspy/build-binary.mjs
// Needs Python 3.10+ (set PYTHON to choose one; CI sets the one actions/setup-python installed).
// Package versions are pinned in build-constraints.txt. Writes services/jobspy/dist/jobspy-server-<platform>
// (.exe on Windows) and prints its size and SHA-256 for lib/desktop/jobspy-release.ts.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PYINSTALLER = "pyinstaller==6.22.3";
const here = path.dirname(fileURLToPath(import.meta.url));
const venv = path.join(here, ".venv-build");
const win = process.platform === "win32";
const venvPython = path.join(venv, win ? "Scripts/python.exe" : "bin/python");
// Same names as lib/desktop/jobspy-release.ts.
const platform = `${process.platform}-${process.arch}`;
const name = `jobspy-server-${platform}`;

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: here, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(venvPython)) {
  const python = process.env.PYTHON ?? (win ? "py" : "python3");
  run(python, ["-m", "venv", venv]);
}
run(venvPython, ["-m", "pip", "install", "--quiet", "--upgrade", "pip"]);
run(venvPython, ["-m", "pip", "install", "--quiet", "-r", "requirements.txt", PYINSTALLER, "-c", "build-constraints.txt"]);
run(venvPython, ["--version"]);

// curl_cffi (JobSpy's HTTP client) loads libcurl from a curl_cffi.libs folder beside the package on
// Windows. Bundle that folder by name instead of relying on PyInstaller to find it, or the program
// fails at start with "DLL load failed while importing _wrapper".
const sitePackages = spawnSync(venvPython, ["-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"], {
  encoding: "utf8",
}).stdout.trim();
const curlLibs = path.join(sitePackages, "curl_cffi.libs");
const extra = existsSync(curlLibs) ? ["--add-binary", `${curlLibs}${path.delimiter}curl_cffi.libs`] : [];
run(venvPython, [
  "-m",
  "PyInstaller",
  "--onefile",
  "--noconfirm",
  "--clean",
  "--name",
  name,
  // JobSpy reads data files at runtime; take the whole package.
  "--collect-all",
  "jobspy",
  "--collect-all",
  "curl_cffi",
  ...extra,
  "--distpath",
  "dist",
  "--workpath",
  path.join("build", platform),
  "--specpath",
  path.join("build", platform),
  "server.py",
]);

const file = path.join(here, "dist", win ? `${name}.exe` : name);
const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
const size = statSync(file).size;
writeFileSync(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);
console.log(JSON.stringify({ platform, file: path.basename(file), size, sha256 }, null, 2));
