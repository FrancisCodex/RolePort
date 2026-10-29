/*
 * Lite edition: the browser's stand-in for the server's refresh(). Writes call
 * invalidate() with the tables they changed; pages showing those tables reload.
 * Other open tabs hear about it over a BroadcastChannel.
 */

export type Table = "profile" | "job" | "application" | "job_match" | "user_settings" | "document" | "interview_session" | "followed_company";

type Listener = { tables: Table[]; reload: () => Promise<void> };

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null | undefined;

async function notify(tables: Table[]): Promise<void> {
  const affected = [...listeners].filter((l) => l.tables.some((t) => tables.includes(t)));
  await Promise.all(affected.map((l) => l.reload().catch(() => {})));
}

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("roleport:invalidate");
    channel?.addEventListener("message", (e: MessageEvent<Table[]>) => void notify(e.data));
  }
  return channel;
}

/** Reload what shows these tables, here and in other tabs. Resolves once this tab has reloaded. */
export async function invalidate(...tables: Table[]): Promise<void> {
  getChannel()?.postMessage(tables);
  await notify(tables);
}

/** Run `reload` whenever one of `tables` changes. Returns the unsubscribe function. */
export function subscribe(tables: Table[], reload: () => Promise<void>): () => void {
  getChannel();
  const listener = { tables, reload };
  listeners.add(listener);
  return () => listeners.delete(listener);
}
