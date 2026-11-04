// electron-builder afterPack hook: copies RolePort's server (desktop/server) into the app's
// resources folder. extraResources can't do it: it always leaves out node_modules folders,
// and the standalone server needs its own.
import { cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default async function afterPack({ appOutDir, electronPlatformName, packager }) {
  const resources =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");
  cpSync(path.join(desktop, "server"), path.join(resources, "server"), { recursive: true });
}
