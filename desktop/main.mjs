// RolePort desktop (docs/ROADMAP-NEXT.md, 5A): runs RolePort's own server inside the app, on this
// computer only, and shows it in a window. The server is the Next.js standalone build that
// scripts/prepare-server.mjs puts in ./server (in the installed app: resources/server).
import { app, BrowserWindow, dialog, shell, utilityProcess } from "electron";
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  remindLater,
  setAutoCheck,
  skipVersion,
  startUpdates,
  updateState,
} from "./updates.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// Another data folder, for trying the app without touching your own data (or a portable copy).
if (process.env.ROLEPORT_DESKTOP_DATA) app.setPath("userData", path.resolve(process.env.ROLEPORT_DESKTOP_DATA));
const serverDir = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(here, "server");

// A fixed port keeps the address the same between launches, so what the pages keep in browser
// storage (voice settings, open tabs) survives a restart. The next free one if it's taken.
const PREFERRED_PORTS = [47100, 47101, 47102, 47103, 47104, 47105];
const STARTUP_TIMEOUT_MS = 90_000;

/** @type {import("electron").UtilityProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;
let origin = "";
let quitting = false;

// Two copies can't share the database: a second launch brings the open window forward instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(start);
}

function portFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => probe.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (const port of PREFERRED_PORTS) if (await portFree(port)) return port;
  // All taken: let the system choose one.
  return new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = /** @type {import("node:net").AddressInfo} */ (probe.address());
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilUp(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!server) throw new Error("RolePort's server stopped while starting.");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("RolePort's server took too long to start.");
}

/** Everything RolePort keeps: the database, its encryption key and the server's log. */
function dataPaths() {
  const data = path.join(app.getPath("userData"), "data");
  const logs = path.join(app.getPath("userData"), "logs");
  mkdirSync(data, { recursive: true });
  mkdirSync(logs, { recursive: true });
  // lib/secrets.ts keeps the encryption key next to the database folder: data/secret.key.
  return { pglite: path.join(data, "pglite"), log: path.join(logs, "server.log") };
}

function startServer(port) {
  const { pglite, log } = dataPaths();
  const logFile = createWriteStream(log, { flags: "a" });
  logFile.write(`\n--- ${new Date().toISOString()} RolePort ${app.getVersion()} on port ${port}\n`);
  server = utilityProcess.fork(path.join(serverDir, "server.js"), [], {
    cwd: serverDir,
    serviceName: "RolePort server",
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      PGLITE_DIR: pglite,
      ROLEPORT_DESKTOP: "1",
      // Where downloads such as JobSpy go (lib/desktop/jobspy.ts).
      ROLEPORT_APP_DATA: app.getPath("userData"),
    },
  });
  server.stdout?.pipe(logFile);
  server.stderr?.pipe(logFile);
  server.on("message", (message) => handleServerMessage(message));
  server.on("exit", (code) => {
    server = null;
    if (!quitting) {
      dialog.showErrorBox("RolePort stopped", `RolePort's server stopped unexpectedly (code ${code}). Details are in ${log}. Open RolePort again to restart it.`);
      app.quit();
    }
  });
}

/* JobSpy (lib/desktop/jobspy.ts) ------------------------------------------- */

/** @type {{ child: import("node:child_process").ChildProcess, url: string } | null} */
let jobspy = null;

/** Stops JobSpy and anything it started (a one-file build runs as two processes). */
function stopJobSpy() {
  const child = jobspy?.child;
  jobspy = null;
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill();
}

/** Starts the downloaded JobSpy on a private port and waits until it answers. */
async function startJobSpy(file) {
  // Only ever a file RolePort downloaded into its own folder.
  const folder = path.join(app.getPath("userData"), "jobspy") + path.sep;
  const resolved = path.resolve(file);
  if (!resolved.startsWith(folder) || !existsSync(resolved)) throw new Error("JobSpy isn't downloaded.");
  if (jobspy) {
    const alive = await fetch(`${jobspy.url}/health`, { signal: AbortSignal.timeout(3_000) }).then((r) => r.ok).catch(() => false);
    if (alive) return jobspy.url;
    stopJobSpy();
  }
  const port = await new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = /** @type {import("node:net").AddressInfo} */ (probe.address());
      probe.close(() => resolve(port));
    });
  });
  const log = createWriteStream(path.join(app.getPath("userData"), "logs", "jobspy.log"), { flags: "a" });
  const child = spawn(resolved, [], {
    // Its own folder, never the install folder it would otherwise inherit from the shortcut.
    cwd: path.dirname(resolved),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const url = `http://127.0.0.1:${port}`;
  jobspy = { child, url };
  child.on("exit", () => {
    if (jobspy?.child === child) jobspy = null;
  });
  // A one-file build unpacks itself first, and antivirus may scan it on the first run.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (jobspy?.child !== child) throw new Error("JobSpy stopped while starting. Details are in logs/jobspy.log.");
    const up = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) }).then((r) => r.ok).catch(() => false);
    if (up) return url;
    await new Promise((r) => setTimeout(r, 500));
  }
  stopJobSpy();
  throw new Error("JobSpy took too long to start.");
}

/** Requests from RolePort's server (lib/desktop/bridge.ts); each gets one reply with the same id. */
async function handleServerMessage(message) {
  const { id, type } = message ?? {};
  if (typeof id !== "number") return;
  const reply = (body) => server?.postMessage({ id, ...body });
  try {
    if (type === "jobspy:start") reply({ ok: true, data: { url: await startJobSpy(String(message.file)) } });
    else if (type === "jobspy:stop") reply({ ok: true, data: stopJobSpy() ?? null });
    else if (type === "update:state") reply({ ok: true, data: updateState() });
    else if (type === "update:check") reply({ ok: true, data: await checkForUpdate() });
    else if (type === "update:download") reply({ ok: true, data: downloadUpdate() });
    else if (type === "update:later") reply({ ok: true, data: remindLater() });
    else if (type === "update:skip") reply({ ok: true, data: skipVersion() });
    else if (type === "update:auto-check") reply({ ok: true, data: setAutoCheck(Boolean(message.on)) });
    else if (type === "update:install") {
      if (updateState().status !== "ready") throw new Error("There's no downloaded update to install yet.");
      // Answer first: installing stops the server that's waiting for this reply.
      reply({ ok: true, data: null });
      setTimeout(() => void installUpdate(shutDownForUpdate).catch((error) => dialog.showErrorBox("RolePort couldn't update", String(error))), 300);
    }
    else reply({ ok: false, error: `Unknown request: ${type}` });
  } catch (error) {
    reply({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: "RolePort",
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));

  // Pages from other sites (job postings, OpenAI's sign-in, docs links) open in the normal browser.
  const isApp = (url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  };
  const openOutside = (url) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isApp(url)) openOutside(url);
    else win?.loadURL(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isApp(url) || url.startsWith("file:")) return;
    event.preventDefault();
    openOutside(url);
  });
  // The page asks for the microphone (dictation) itself, with its own explanation first.
  win.webContents.session.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isApp(contents.getURL()) && ["media", "clipboard-sanitized-write", "notifications"].includes(permission));
  });
}

async function start() {
  if (!existsSync(path.join(serverDir, "server.js"))) {
    dialog.showErrorBox("RolePort can't start", `RolePort's server is missing from ${serverDir}. Build it with: npm run desktop`);
    app.quit();
    return;
  }
  createWindow();
  await win.loadFile(path.join(here, "starting.html"));

  const port = await pickPort();
  origin = `http://127.0.0.1:${port}`;
  startServer(port);
  try {
    await waitUntilUp(`${origin}/`);
    // Straight into the app (or the welcome guide on a first run), not the website's landing page.
    await win?.loadURL(`${origin}/home`);
    startUpdates();
  } catch (error) {
    dialog.showErrorBox("RolePort can't start", `${error instanceof Error ? error.message : error} Details are in ${dataPaths().log}.`);
    app.quit();
  }
}

app.on("activate", () => {
  // macOS: clicking the dock icon with no window open shows it again.
  if (!win && origin) {
    createWindow();
    win.loadURL(`${origin}/home`);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/** Waits for the server process to exit (or gives up after a few seconds). */
function stopServer(timeoutMs = 8_000) {
  const running = server;
  if (!running) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    running.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    running.kill();
  });
}

/**
 * Before the installer runs: stop JobSpy and the server and wait until they've exited, so no file
 * in the install folder is still open when the old version is removed.
 */
async function shutDownForUpdate() {
  quitting = true;
  stopJobSpy();
  await stopServer();
  // Let Windows release the files the processes had open.
  await new Promise((r) => setTimeout(r, 500));
}

app.on("before-quit", () => {
  quitting = true;
  stopJobSpy();
  server?.kill();
});
