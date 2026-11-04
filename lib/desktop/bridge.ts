import "server-only";

/*
 * In the desktop app (desktop/main.mjs), RolePort's server runs in an Electron utility process
 * and can ask the app for things only the app should do, such as starting and stopping the JobSpy
 * program so it never outlives the app. Messages go over the process's parentPort.
 */

type ParentPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
};
type Reply = { id: number; ok: boolean; data?: unknown; error?: string };
type Waiting = Map<number, { resolve: (data: unknown) => void; reject: (error: Error) => void }>;

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

/** Running inside the desktop app. */
export const isDesktop = process.env.ROLEPORT_DESKTOP === "1" && parentPort !== undefined;

// Kept on globalThis: the server may load this module more than once, but there's one port.
const state = ((globalThis as { __roleportBridge?: { nextId: number; waiting: Waiting } }).__roleportBridge ??= (() => {
  const waiting: Waiting = new Map();
  parentPort?.on("message", ({ data }) => {
    const reply = data as Reply;
    const pending = waiting.get(reply?.id);
    if (!pending) return;
    waiting.delete(reply.id);
    if (reply.ok) pending.resolve(reply.data);
    else pending.reject(new Error(reply.error ?? "The desktop app couldn't do that."));
  });
  return { nextId: 1, waiting };
})());

/** Asks the desktop app to do something and waits for its answer. */
export function askDesktop<T>(type: string, payload: Record<string, unknown> = {}, timeoutMs = 120_000): Promise<T> {
  if (!isDesktop || !parentPort) return Promise.reject(new Error("Only the desktop app can do this."));
  const id = state.nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.waiting.delete(id);
      reject(new Error("The desktop app didn't answer in time."));
    }, timeoutMs);
    state.waiting.set(id, {
      resolve: (data) => (clearTimeout(timer), resolve(data as T)),
      reject: (error) => (clearTimeout(timer), reject(error)),
    });
    parentPort.postMessage({ id, type, ...payload });
  });
}
