"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { BrowserDbSetup } from "@/components/app/browser-db-setup";
import { subscribe, type Table } from "@/lib/client/bus";
import { hasBrowserDb } from "@/lib/db/browser/storage";

type LiteQueries = typeof import("@/lib/client/lite-queries");

/**
 * Lite edition: loads a page's data from the browser database and renders it, reloading
 * when one of `tables` changes. Shows the first-visit setup message, `fallback` while
 * loading, and an error card if the database can't be opened.
 */
export function LiteData<T>({
  load,
  tables,
  fallback,
  children,
}: {
  load: (q: LiteQueries) => Promise<T>;
  tables: Table[];
  fallback: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const [state, setState] = useState<{ data: T } | { error: string } | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);

  // The latest `load` without re-running the effect when the caller passes a new function.
  const loadData = useEffectEvent((q: LiteQueries) => load(q));

  const tableKey = tables.join(",");
  useEffect(() => {
    let live = true;
    const run = () =>
      import("@/lib/client/lite-queries")
        .then((q) => loadData(q))
        .then(
          (data) => {
            if (live) setState({ data });
          },
          (e: unknown) => {
            console.error("[lite] couldn't load data from the browser database", e);
            if (live) setState({ error: e instanceof Error ? e.message : "Couldn't open the database in this browser." });
          },
        );

    hasBrowserDb().then((exists) => live && setFirstVisit(!exists));
    void run();
    const unsubscribe = subscribe(tableKey.split(",") as Table[], run);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [tableKey]);

  if (state && "error" in state) {
    return (
      <div className="rounded-lg border border-danger/25 bg-danger-soft p-4 text-[13px]">
        <p className="font-medium">Couldn&apos;t open your data in this browser.</p>
        <p className="mt-1 text-muted">{state.error}</p>
      </div>
    );
  }
  if (!state) return firstVisit ? <BrowserDbSetup /> : fallback;
  return children(state.data);
}
