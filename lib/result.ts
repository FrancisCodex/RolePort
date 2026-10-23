/** What every mutation returns to the UI, whether it ran as a server action or in the browser. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
