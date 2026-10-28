import type { Result } from "@/lib/result";
import { parseBackup, type Backup } from "./format";
import type { ImportMode } from "./import";

/** A restore request from the Settings form: the backup file and how to apply it. Shared by both editions. */
export async function readBackupForm(formData: FormData, maxBytes: number): Promise<Result<{ backup: Backup; mode: ImportMode }>> {
  const file = formData.get("backup");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a backup file." };
  if (file.size > maxBytes) return { ok: false, error: `That file is over ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  const mode = formData.get("mode") === "replace" ? "replace" : "merge";

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't a RolePort backup." };
  }
  try {
    return { ok: true, data: { backup: parseBackup(json), mode } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That file isn't a RolePort backup." };
  }
}

/** A failed restore, for the user. Nothing was changed: the import runs in one transaction. */
export function importErrorMessage(error: unknown): string {
  console.error("[backup] import failed", error);
  return "The backup couldn't be imported, so nothing was changed. Is it from a RolePort install?";
}
