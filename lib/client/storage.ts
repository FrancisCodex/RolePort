/*
 * Browser storage helpers for the lite edition, where the browser holds the only copy of the
 * user's data. Every call is guarded: these APIs are missing in some browsers and contexts.
 */

export type StorageStatus = { usedBytes: number | null; quotaBytes: number | null; persisted: boolean | null };

export async function storageStatus(): Promise<StorageStatus> {
  try {
    const [estimate, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted()]);
    return { usedBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null, persisted };
  } catch {
    return { usedBytes: null, quotaBytes: null, persisted: null };
  }
}

/**
 * Ask the browser not to clear this site's data under storage pressure. Chrome decides on its
 * own (installed, bookmarked or often-used sites get it); Firefox may ask the user.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/* When the user last downloaded a backup, for the reminder. Per browser, like the data itself. */

const LAST_BACKUP = "roleport:last-backup";
const REMINDER_SNOOZED_UNTIL = "roleport:backup-reminder-snoozed-until";

export function recordBackup(at = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP, at.toISOString());
  } catch {}
}

export function lastBackup(): Date | null {
  try {
    const value = localStorage.getItem(LAST_BACKUP);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

export function snoozeBackupReminder(days: number): void {
  try {
    localStorage.setItem(REMINDER_SNOOZED_UNTIL, new Date(Date.now() + days * 86_400_000).toISOString());
  } catch {}
}

export function backupReminderSnoozed(): boolean {
  try {
    const until = localStorage.getItem(REMINDER_SNOOZED_UNTIL);
    return until ? new Date(until).getTime() > Date.now() : false;
  } catch {
    return false;
  }
}

/** Save text as a file through the browser's download. */
export function downloadText(fileName: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
