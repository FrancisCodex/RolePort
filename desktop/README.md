# RolePort desktop

RolePort as a normal program: an installer, a window, no hosting, Docker or Python. The app runs
RolePort's own server inside it, on this computer only (`127.0.0.1`), and keeps your data in the
system's app-data folder. Plan and status: `docs/ROADMAP-NEXT.md`, phase 5.

## Run it from the repo

Once, install Electron (it lives here so the web version's `npm install` doesn't download it):

```bash
npm --prefix desktop install
```

Then, from the repo root:

```bash
npm run desktop
```

This builds the server (`desktop/scripts/prepare-server.mjs`: a Next.js standalone build plus
`public`, `.next/static` and `drizzle`, copied to `desktop/server`) and opens the app.

## Make the installer

```bash
npm run desktop:dist
```

The installer lands in `desktop/dist` (`RolePort-Setup-x64.exe` on Windows). It isn't code
signed yet, so Windows shows "Windows protected your PC" on first run: **More info → Run anyway**.

## Release it

Push a version tag. `.github/workflows/desktop-release.yml` builds the Windows installer on GitHub,
sets the app's version from the tag, and publishes it as the latest release (two commands, so they also
work in Windows PowerShell):

```bash
git tag v0.1.1
git push origin v0.1.1
```

The landing page's **Download for Windows** button links to
`https://github.com/FrancisCodex/RolePort/releases/latest/download/RolePort-Setup-x64.exe`, which
always serves the newest release's installer because the file name never changes. Other releases
(JobSpy's) are published with `--latest=false` so they don't take that place.

## Updates

The installed app updates itself, from inside RolePort (`updates.mjs` with electron-updater, reached
from the server through `lib/desktop/updates.ts`). The release also carries `latest.yml` (the newest
version and the installer's SHA-512) and the installer's `.blockmap`.

- **Checking:** about 15 seconds after starting and every 6 hours (unless turned off in Settings → About
  & updates), the app reads `latest.yml` from the latest GitHub release. **Check for updates** in
  Settings checks any time.
- **Telling the user:** a newer version shows as a notice inside RolePort (`components/app/update-notice.tsx`)
  with **Update**, **Later** (again in a day) and **Skip this version** (until a newer one), and in
  Settings with its release notes. There's no Windows dialog.
- **Downloading:** only when the user clicks Update. Only the changed parts are downloaded when it can,
  and the file is checked against the SHA-512.
- **Installing:** **Restart to update** stops JobSpy and the server and waits for them to exit, then runs
  the installer silently and opens RolePort again. A downloaded update also installs when RolePort
  closes. An update first moves every file of the old version out of the install folder; one file that
  can't be moved stops it with "Failed to uninstall old application files". So the installer
  (`build/installer.nsh`) first closes any leftover JobSpy and deletes the page cache that versions up
  to 0.1.4 saved there (its paths were too long for Windows once moved). The server now keeps that
  cache in memory (`isrFlushToDisk: false` in `next.config.ts`) so the install folder never changes
  while the app runs. If an update doesn't finish, the next launch says so in Settings.

Updates are off when running from the repo, on macOS (they need a signed app) and with
`ROLEPORT_NO_UPDATES=1`. The user's choices are in `update-settings.json` and the log in
`logs/update.log`, both in the data folder. Copies installed before updates existed (v0.1.0) need one
manual download of a newer installer.

## Where things are

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Data (database, encryption key) | `%APPDATA%\RolePort\data` | `~/Library/Application Support/RolePort/data` | `~/.config/RolePort/data` |
| Logs (server, JobSpy, updates) | `%APPDATA%\RolePort\logs` | `…/RolePort/logs` | `…/RolePort/logs` |

Uninstall from **Settings → Apps → Installed apps → RolePort**. Uninstalling keeps your data. To try the app without touching it, point it at another folder:
`ROLEPORT_DESKTOP_DATA=/some/folder npm --prefix desktop start`.

The app uses port 47100 (or the next free one up to 47105) so the address stays the same between
launches.

## JobSpy (LinkedIn, Indeed and more)

The desktop app downloads JobSpy as one program file only when the user turns the boards on in
Settings, checks it against the SHA-256 in `lib/desktop/jobspy-release.ts`, and runs it itself on
a private port (`desktop/main.mjs`), stopping it on quit. No Python on the user's computer.

To publish a JobSpy build:

1. On GitHub: **Actions → JobSpy binaries → Run workflow** (tag `jobspy-<python-jobspy version>`).
   It builds Windows, macOS and Linux files, checks each starts, and attaches them to that release.
2. Copy each file's size and SHA-256 from the run's summary into `lib/desktop/jobspy-release.ts`.

To build one on your own computer (Python 3.10+): `node services/jobspy/build-binary.mjs`. To try a
local build in the app, put its address, size and SHA-256 in a JSON file shaped like
`JOBSPY_RELEASE` and start the app with `ROLEPORT_JOBSPY_RELEASE=/path/to/that.json` (a
`http://127.0.0.1` address is allowed only then).
