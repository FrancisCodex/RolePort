"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { backupFileName } from "@/lib/backup/format";
import { exportData } from "@/lib/client/mutations";
import { backupReminderSnoozed, downloadText, lastBackup, recordBackup, snoozeBackupReminder } from "@/lib/client/storage";

const REMIND_AFTER_DAYS = 14;
const SNOOZE_DAYS = 3;

/**
 * Lite edition: the browser holds the only copy of the user's data, so nudge for a backup
 * when the last one (or, if none, the first saved data) is more than two weeks old.
 */
export function BackupReminder() {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (backupReminderSnoozed()) return;
    let live = true;
    import("@/lib/client/lite-queries")
      .then((q) => q.loadDataSince())
      .then((since) => {
        const from = lastBackup() ?? since;
        if (live && since && from && Date.now() - from.getTime() > REMIND_AFTER_DAYS * 86_400_000) setShow(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;

  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center">
      <p className="flex-1 text-fg">
        <span className="font-semibold">Time for a backup.</span> Your data lives only in this browser. Download a copy in case it&apos;s
        cleared or you switch devices.
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await exportData();
              if (!result.ok) return;
              downloadText(backupFileName(), result.data);
              recordBackup();
              setShow(false);
            })
          }
        >
          <Download /> Download backup
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Remind me later"
          onClick={() => {
            snoozeBackupReminder(SNOOZE_DAYS);
            setShow(false);
          }}
        >
          <X /> Later
        </Button>
      </div>
    </div>
  );
}
