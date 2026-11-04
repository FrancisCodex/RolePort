import "server-only";
import { createHash } from "node:crypto";
import { chmodSync, createWriteStream, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import path from "node:path";
import { jobSpyUrl } from "@/lib/env";
import { askDesktop, isDesktop } from "./bridge";
import { JOBSPY_RELEASE, type JobSpyFile, type JobSpyRelease } from "./jobspy-release";

/*
 * Desktop app: JobSpy (LinkedIn, Indeed and more) as one program file, downloaded only when the
 * user agrees, checked against the SHA-256 pinned in ./jobspy-release.ts, stored in the app's
 * data folder and run by the app itself (desktop/main.mjs) on a private 127.0.0.1 port.
 */

const platform = `${process.platform}-${process.arch}`;

/** The pinned release, or a test one from ROLEPORT_JOBSPY_RELEASE (a JSON file) when trying a local build. */
function release(): JobSpyRelease {
  const override = process.env.ROLEPORT_JOBSPY_RELEASE;
  return override ? (JSON.parse(readFileSync(override, "utf8")) as JobSpyRelease) : JOBSPY_RELEASE;
}

function target(): { file: JobSpyFile; dir: string; path: string; version: string } | null {
  const appData = process.env.ROLEPORT_APP_DATA;
  const { version, files } = release();
  const file = files[platform];
  if (!isDesktop || !appData || !file) return null;
  const dir = path.join(appData, "jobspy");
  return { file, dir, version, path: path.join(dir, version, path.basename(new URL(file.url).pathname)) };
}

export type DesktopJobSpy = {
  /** This system has a JobSpy file to download. */
  available: boolean;
  downloaded: boolean;
  version: string;
  size: number | null;
  source: string | null;
  /** Where it's (or would be) stored. */
  folder: string | null;
};

/** What Settings shows about JobSpy in the desktop app, or null outside it. */
export function desktopJobSpy(): DesktopJobSpy | null {
  if (!isDesktop) return null;
  const t = target();
  return {
    available: t !== null,
    downloaded: t !== null && existsSync(t.path),
    version: release().version,
    size: t?.file.size ?? null,
    source: t?.file.url ?? null,
    folder: t ? path.dirname(t.path) : null,
  };
}

/** GET with redirects (GitHub release files redirect to their storage), https only after the first hop. */
function get(url: URL, redirects = 5): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(url, { timeout: 60_000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url);
        if (next.protocol !== "https:") return reject(new Error("JobSpy can only be downloaded over https."));
        return resolve(get(next, redirects - 1));
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error(`Couldn't download JobSpy (${status}).`));
      }
      resolve(res);
    });
    request.on("timeout", () => request.destroy(new Error("The JobSpy download stalled. Check your connection and try again.")));
    request.on("error", reject);
  });
}

/** Downloads the file, checking its size and SHA-256 before it's kept. */
export async function downloadJobSpy(): Promise<void> {
  const t = target();
  if (!t) throw new Error("JobSpy isn't available for this computer yet.");
  if (existsSync(t.path)) return;
  const url = new URL(t.file.url);
  // https only, except a local test build named by ROLEPORT_JOBSPY_RELEASE.
  if (url.protocol !== "https:" && !(process.env.ROLEPORT_JOBSPY_RELEASE && url.hostname === "127.0.0.1")) {
    throw new Error("JobSpy can only be downloaded over https.");
  }
  await mkdir(path.dirname(t.path), { recursive: true });
  const partial = `${t.path}.part`;
  const hash = createHash("sha256");
  const out = createWriteStream(partial);
  let received = 0;
  try {
    const res = await get(url);
    // Node's own http rather than fetch: fetch threw an uncaught error when a server closed the connection mid-stream.
    for await (const chunk of res as AsyncIterable<Buffer>) {
      received += chunk.byteLength;
      if (received > t.file.size) {
        res.destroy();
        throw new Error("The JobSpy download is bigger than expected, so it was stopped.");
      }
      hash.update(chunk);
      if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
    if (received !== t.file.size || hash.digest("hex") !== t.file.sha256) {
      throw new Error("The JobSpy download didn't match the expected file, so it wasn't kept. Try again later.");
    }
    renameSync(partial, t.path);
    if (process.platform !== "win32") chmodSync(t.path, 0o755);
  } catch (error) {
    out.destroy();
    rmSync(partial, { force: true });
    throw error;
  }
}

/** Stops JobSpy and deletes every downloaded version. */
export async function removeJobSpy(): Promise<void> {
  const t = target();
  if (!t) return;
  await askDesktop("jobspy:stop").catch(() => {});
  forgetRunning();
  // Windows keeps a just-stopped program's file locked for a moment.
  rmSync(t.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

type Running = { promise: Promise<string> | null };
const running = ((globalThis as { __roleportJobSpy?: Running }).__roleportJobSpy ??= { promise: null });
const forgetRunning = () => (running.promise = null);

/** JobSpy's address in the desktop app, starting it the first time; null when it isn't downloaded or won't start. */
async function desktopJobSpyUrl(): Promise<string | null> {
  const t = target();
  if (!t || !existsSync(t.path)) return null;
  running.promise ??= askDesktop<{ url: string }>("jobspy:start", { file: t.path }).then((r) => r.url);
  try {
    const url = await running.promise;
    // Still answering? It may have been stopped or crashed since.
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
    if (res?.ok) return url;
    forgetRunning();
    running.promise = askDesktop<{ url: string }>("jobspy:start", { file: t.path }).then((r) => r.url);
    return await running.promise;
  } catch {
    forgetRunning();
    return null;
  }
}

/** Where the server reaches JobSpy: JOBSPY_URL when set, else the desktop app's own copy, else nowhere. */
export async function jobSpyAddress(): Promise<string | null> {
  return jobSpyUrl ?? (isDesktop ? desktopJobSpyUrl() : null);
}
