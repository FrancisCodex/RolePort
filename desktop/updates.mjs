// Updates for the installed app, driven from inside RolePort (Settings → About & updates, and the
// in-app notice) through the server bridge (main.mjs → lib/desktop/updates.ts). Checks RolePort's
// GitHub releases (the `publish` setting in package.json), downloads only when the user chooses
// to, checks the download against the SHA-512 in the release's latest.yml, and installs it when
// the user restarts (or, once downloaded, when RolePort closes).
import { app } from "electron";
import updaterPackage from "electron-updater";
import { createWriteStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const { autoUpdater } = updaterPackage;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{ version: string; html: string }} ReleaseNote
 * @typedef {{
 *   supported: boolean;
 *   current: string;
 *   status: "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";
 *   latest: { version: string; date: string | null; notes: ReleaseNote[] } | null;
 *   progress: { percent: number; transferred: number; total: number } | null;
 *   error: string | null;
 *   lastChecked: string | null;
 *   autoCheck: boolean;
 *   skipped: string | null;
 *   remindAfter: string | null;
 *   notify: boolean;
 * }} UpdateState
 */

/** @type {Omit<UpdateState, "notify" | "autoCheck" | "skipped" | "remindAfter">} */
const state = {
  // Updates need the installed app, and on macOS a signed one (download from the website there for now).
  supported: app.isPackaged && process.platform !== "darwin" && process.env.ROLEPORT_NO_UPDATES !== "1",
  current: app.getVersion(),
  status: "idle",
  latest: null,
  progress: null,
  error: null,
  lastChecked: null,
};

/* The user's choices, kept next to their data so they survive updates. */
const prefsFile = () => path.join(app.getPath("userData"), "update-settings.json");
/** @type {{ autoCheck: boolean; skipped: string | null; remindAfter: string | null; installing?: string | null }} */
let prefs = { autoCheck: true, skipped: null, remindAfter: null, installing: null };
function loadPrefs() {
  try {
    if (existsSync(prefsFile())) prefs = { ...prefs, ...JSON.parse(readFileSync(prefsFile(), "utf8").replace(/^\uFEFF/, "")) };
  } catch {
    // A damaged file: start from the defaults.
  }
}
function savePrefs() {
  try {
    writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2));
  } catch {
    // Not saved: the choice lasts until RolePort closes.
  }
}

/** @returns {UpdateState} */
export function updateState() {
  const choices = { autoCheck: prefs.autoCheck, skipped: prefs.skipped, remindAfter: prefs.remindAfter };
  const hasNew = state.latest !== null && ["available", "downloading", "ready"].includes(state.status);
  const snoozed = prefs.remindAfter !== null && Date.now() < Date.parse(prefs.remindAfter);
  return {
    ...state,
    ...choices,
    // The in-app notice: a newer version the user hasn't skipped or put off. A finished download
    // always shows, so "Restart to update" stays in reach.
    notify: hasNew && (state.status === "ready" || (prefs.skipped !== state.latest?.version && !snoozed)),
  };
}

/** "1.2.10" > "1.2.9". */
function newer(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/** Plain words for what went wrong, instead of the updater's internals. */
function explain(error) {
  const text = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::ERR_|getaddrinfo|socket hang up/i.test(text))
    return "Couldn't reach GitHub to check for updates. Check your internet connection and try again.";
  if (/sha512|checksum/i.test(text)) return "The download didn't match the release's checksum, so it wasn't installed. Try again.";
  if (/latest\.yml|404/i.test(text)) return "No update information was found for this version yet. Try again later.";
  return `The update couldn't finish: ${text.split("\n")[0].slice(0, 200)}`;
}

/** electron-updater's release notes (one or several releases) as a list, newest first. */
function notesOf(info) {
  const notes = info.releaseNotes;
  if (!notes) return [];
  if (typeof notes === "string") return [{ version: info.version, html: notes }];
  return notes.map((n) => ({ version: n.version, html: n.note ?? "" }));
}

let started = false;

/** Sets the updater up and starts the background checks (if the user hasn't turned them off). */
export function startUpdates() {
  if (!state.supported || started) return;
  started = true;
  loadPrefs();
  // An update was started last time: did it finish? (Still the old version means the installer stopped.)
  if (prefs.installing) {
    if (newer(prefs.installing, state.current))
      state.error = `The update to ${prefs.installing} didn't finish, so you still have ${state.current}. Check for updates to try again, or download the installer from the RolePort website.`;
    prefs.installing = null;
    savePrefs();
  }

  const logFile = createWriteStream(path.join(app.getPath("userData"), "logs", "update.log"), { flags: "a" });
  const write = (level) => (...parts) => logFile.write(`${new Date().toISOString()} ${level} ${parts.join(" ")}\n`);
  autoUpdater.logger = { info: write("info"), warn: write("warn"), error: write("error"), debug: () => {} };
  // Nothing downloads until the user chooses Update.
  autoUpdater.autoDownload = false;
  // Once downloaded, closing RolePort installs it too.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;
  // Notes for every release since this one, not just the newest.
  autoUpdater.fullChangelog = true;

  autoUpdater.on("update-available", (info) => {
    state.latest = { version: info.version, date: info.releaseDate ?? null, notes: notesOf(info) };
    if (state.status !== "downloading" && state.status !== "ready") state.status = "available";
  });
  autoUpdater.on("update-not-available", () => {
    if (state.status !== "ready") state.status = "up-to-date";
  });
  autoUpdater.on("download-progress", (p) => {
    state.status = "downloading";
    state.progress = { percent: p.percent, transferred: p.transferred, total: p.total };
  });
  autoUpdater.on("update-downloaded", () => {
    state.status = "ready";
    state.progress = null;
  });
  autoUpdater.on("error", (error) => {
    write("error")(error instanceof Error ? error.stack ?? error.message : String(error));
    state.error = explain(error);
    state.status = state.status === "downloading" ? (state.latest ? "available" : "error") : "error";
    state.progress = null;
  });

  // Not during startup: the server comes first.
  setTimeout(() => prefs.autoCheck && void checkForUpdate(), 15_000);
  setInterval(() => prefs.autoCheck && void checkForUpdate(), CHECK_EVERY_MS).unref();
}

/** Asks GitHub for a newer version. Resolves with the new state once the check is done. */
export async function checkForUpdate() {
  if (!state.supported) return updateState();
  if (state.status === "checking" || state.status === "downloading" || state.status === "ready") return updateState();
  state.status = "checking";
  state.error = null;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable && state.status === "checking") state.status = "up-to-date";
  } catch (error) {
    state.error = explain(error);
    state.status = "error";
  }
  state.lastChecked = new Date().toISOString();
  return updateState();
}

/** Starts downloading the newer version (progress shows in updateState()). */
export function downloadUpdate() {
  if (state.status !== "available") return updateState();
  state.status = "downloading";
  state.error = null;
  state.progress = { percent: 0, transferred: 0, total: 0 };
  autoUpdater.downloadUpdate().catch((error) => {
    state.error = explain(error);
    state.status = "available";
    state.progress = null;
  });
  return updateState();
}

/**
 * Installs the downloaded version: `prepare` stops everything RolePort started (the server,
 * JobSpy), so no file in the install folder is still in use, then the installer runs silently and
 * opens RolePort again.
 * @param {() => Promise<void>} prepare
 */
export async function installUpdate(prepare) {
  if (state.status !== "ready") throw new Error("There's no downloaded update to install yet.");
  // Remembered so the next launch can tell whether it worked.
  prefs.installing = state.latest?.version ?? null;
  savePrefs();
  await prepare();
  autoUpdater.quitAndInstall(true, true);
}

/** "Later": hide the notice for a day. */
export function remindLater() {
  prefs.remindAfter = new Date(Date.now() + REMIND_AFTER_MS).toISOString();
  savePrefs();
  return updateState();
}

/** "Skip this version": no notice for it; a newer one shows again. */
export function skipVersion() {
  if (state.latest) prefs.skipped = state.latest.version;
  savePrefs();
  return updateState();
}

/** Turns the background checks on or off (checking by hand in Settings always works). */
export function setAutoCheck(on) {
  prefs.autoCheck = Boolean(on);
  savePrefs();
  return updateState();
}
