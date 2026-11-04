// Updates for the installed app: checks RolePort's GitHub releases (the `publish` setting in
// package.json), downloads a newer version in the background and installs it on restart. The
// release workflow (.github/workflows/desktop-release.yml) uploads latest.yml, which names the
// newest version and its checksum; the download is checked against it before it installs.
import { app, dialog } from "electron";
import updaterPackage from "electron-updater";
import { createWriteStream } from "node:fs";
import path from "node:path";

const { autoUpdater } = updaterPackage;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Starts checking for updates. Only in the installed app, and not on macOS, where updates need a
 * signed app (download the new version from the website there for now).
 * @param {() => import("electron").BrowserWindow | null} getWindow
 */
export function startUpdates(getWindow) {
  if (!app.isPackaged || process.platform === "darwin" || process.env.ROLEPORT_NO_UPDATES === "1") return;

  const logFile = createWriteStream(path.join(app.getPath("userData"), "logs", "update.log"), { flags: "a" });
  const write = (level) => (...parts) => logFile.write(`${new Date().toISOString()} ${level} ${parts.join(" ")}\n`);
  autoUpdater.logger = { info: write("info"), warn: write("warn"), error: write("error"), debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.disableWebInstaller = true;
  // "Later" still installs it, the next time RolePort closes.
  autoUpdater.autoInstallOnAppQuit = true;

  let asked = false;
  autoUpdater.on("update-downloaded", async (info) => {
    if (asked) return;
    asked = true;
    const win = getWindow();
    const options = {
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: `RolePort ${info.version} is ready to install.`,
      detail:
        "Restart RolePort to finish updating. Your jobs, CVs and settings stay as they are.\n\nChoose Later to keep working: it installs the next time you close RolePort.",
    };
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    // Silent install, then open RolePort again.
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });
  // Offline, GitHub down, no release yet: try again at the next check.
  autoUpdater.on("error", (error) => write("error")(error instanceof Error ? error.message : String(error)));

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  // Not during startup: the server comes first.
  setTimeout(check, 15_000);
  setInterval(check, CHECK_EVERY_MS).unref();
}
