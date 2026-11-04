"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appUpdate } from "@/lib/client/mutations";
import type { AppUpdate } from "@/lib/desktop/updates";

type Request = "check" | "download" | "later" | "skip" | "install";

/**
 * The desktop app's update state, kept fresh: every second while downloading, every minute
 * otherwise, and whenever the window comes back into focus. Shared by Settings → About & updates
 * and the in-app notice, so an action in one shows in the other.
 */
export function useAppUpdate(initial: AppUpdate | null = null) {
  const [update, setUpdate] = useState<AppUpdate | null>(initial);
  const [busy, setBusy] = useState<Request | "auto-check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const live = useRef(true);

  const refresh = useCallback(async () => {
    const result = await appUpdate({ request: "state" }).catch(() => null);
    if (live.current && result?.ok) setUpdate(result.data);
  }, []);

  useEffect(() => {
    live.current = true;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(UPDATE_CHANGED, onFocus);
    return () => {
      live.current = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(UPDATE_CHANGED, onFocus);
    };
  }, [refresh]);

  const downloading = update?.status === "downloading";
  useEffect(() => {
    if (installing) return;
    const timer = setInterval(() => void refresh(), downloading ? 1_000 : 60_000);
    return () => clearInterval(timer);
  }, [downloading, installing, refresh]);

  async function run(request: Request | "auto-check", on?: boolean) {
    setError(null);
    setBusy(request);
    const result = await appUpdate({ request, on }).catch(() => ({ ok: false as const, error: "RolePort didn't answer. Try again." }));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    if (request === "install") {
      // The app closes and the installer runs; this page goes with it.
      setInstalling(true);
      return;
    }
    setUpdate(result.data);
    window.dispatchEvent(new Event(UPDATE_CHANGED));
  }

  return {
    update,
    busy,
    error: error ?? update?.error ?? null,
    installing,
    check: () => run("check"),
    download: () => run("download"),
    install: () => run("install"),
    later: () => run("later"),
    skip: () => run("skip"),
    setAutoCheck: (on: boolean) => run("auto-check", on),
  };
}

/** Fired after an update action, so the notice and Settings agree without waiting for a poll. */
const UPDATE_CHANGED = "roleport:update-changed";

export const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
