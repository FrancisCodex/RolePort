"use client";

import { useEffect } from "react";

/**
 * Lite edition: start opening the browser database as soon as any app page loads,
 * so it's ready (or closer to ready) by the time the page asks for data.
 */
export function OpenBrowserDb() {
  useEffect(() => {
    import("@/lib/db/browser")
      .then((m) => m.getBrowserDb())
      // The page that needs the data shows the error; this is only a head start.
      .catch(() => {});
  }, []);
  return null;
}
