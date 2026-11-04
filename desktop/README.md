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

The installer lands in `desktop/dist` (`RolePort Setup <version>.exe` on Windows). It isn't code
signed yet, so Windows shows "Windows protected your PC" on first run: **More info → Run anyway**.

## Where things are

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Data (database, encryption key) | `%APPDATA%\RolePort\data` | `~/Library/Application Support/RolePort/data` | `~/.config/RolePort/data` |
| Server log | `%APPDATA%\RolePort\logs\server.log` | `…/RolePort/logs/server.log` | `…/RolePort/logs/server.log` |

Uninstalling keeps your data. To try the app without touching it, point it at another folder:
`ROLEPORT_DESKTOP_DATA=/some/folder npm --prefix desktop start`.

The app uses port 47100 (or the next free one up to 47105) so the address stays the same between
launches.
