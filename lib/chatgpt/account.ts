import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { readSettings, writeSettings } from "@/lib/settings/queries";
import { newHostId, OAuthError, PLAN_SCOPE, refreshTokens, revoke, TERMINAL_REFRESH_ERRORS, type PendingSignIn, type TokenSet } from "./oauth";

/* The signed-in ChatGPT account (schema.chatgptAccount): storage, and an access token that's always fresh. */

export type ChatGptAccountRow = typeof schema.chatgptAccount.$inferSelect;

/** Shown when the sign-in has ended (refresh refused, or disconnected in ChatGPT). */
export const SIGNED_OUT_MESSAGE = "Your ChatGPT sign-in has ended. Sign in again in Settings → AI provider.";
export const NO_PLAN_SCOPE_MESSAGE = "ChatGPT plan use isn't turned on for RolePort. Sign in again and allow it, or use an API key instead.";

export async function readAccount(userId: string): Promise<ChatGptAccountRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.chatgptAccount).where(eq(schema.chatgptAccount.userId, userId));
  return row ?? null;
}

async function writeAccount(userId: string, values: Partial<Omit<typeof schema.chatgptAccount.$inferInsert, "userId">>) {
  const db = await getDb();
  await db
    .insert(schema.chatgptAccount)
    .values({ userId, hostId: values.hostId ?? newHostId(), ...values })
    .onConflictDoUpdate({ target: schema.chatgptAccount.userId, set: values });
}

/** The row, made with this install's host ID if there's none yet. */
export async function ensureAccount(userId: string): Promise<ChatGptAccountRow> {
  const row = await readAccount(userId);
  if (row) return row;
  await writeAccount(userId, { hostId: newHostId() });
  return (await readAccount(userId))!;
}

export async function savePending(userId: string, pending: PendingSignIn) {
  await writeAccount(userId, { pendingEnc: encryptSecret(JSON.stringify(pending)) });
}

/** The sign-in in progress, if it's younger than 15 minutes. */
export function readPending(row: ChatGptAccountRow | null): PendingSignIn | null {
  const plain = decryptSecret(row?.pendingEnc);
  if (!plain) return null;
  const pending = JSON.parse(plain) as PendingSignIn;
  return Date.now() - pending.startedAt < 15 * 60_000 ? pending : null;
}

export async function clearPending(userId: string) {
  await writeAccount(userId, { pendingEnc: null });
}

export async function saveSignIn(userId: string, values: { clientId: string; subject: string; email: string | null; tokens: TokenSet }) {
  const { tokens } = values;
  await writeAccount(userId, {
    clientId: values.clientId,
    subject: values.subject,
    email: values.email,
    idTokenEnc: tokens.idToken ? encryptSecret(tokens.idToken) : null,
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    pendingEnc: null,
    problem: tokens.scopes.split(/\s+/).includes(PLAN_SCOPE) ? null : NO_PLAN_SCOPE_MESSAGE,
  });
}

export async function markProblem(userId: string, problem: string) {
  await writeAccount(userId, { problem });
}

/** Clears the tokens but keeps the client and host IDs for the next sign-in. */
async function clearTokens(userId: string, problem: string | null) {
  await writeAccount(userId, { accessTokenEnc: null, refreshTokenEnc: null, expiresAt: null, scopes: null, problem });
}

export const hasPlanScope = (row: ChatGptAccountRow | null) => Boolean(row?.scopes?.split(/\s+/).includes(PLAN_SCOPE));
export const isSignedIn = (row: ChatGptAccountRow | null) => Boolean(row?.accessTokenEnc && row.clientId);

// One refresh at a time per user: the refresh token rotates, so two at once would race.
const refreshing = new Map<string, Promise<string>>();

/** A valid access token, refreshed when it's within five minutes of expiring. */
export async function chatGptAccessToken(userId: string): Promise<string> {
  const row = await readAccount(userId);
  if (!isSignedIn(row)) throw new Error(row?.problem ?? SIGNED_OUT_MESSAGE);
  if (!hasPlanScope(row)) throw new Error(NO_PLAN_SCOPE_MESSAGE);
  const access = decryptSecret(row!.accessTokenEnc);
  if (access && row!.expiresAt && row!.expiresAt.getTime() - Date.now() > 5 * 60_000) return access;

  let pending = refreshing.get(userId);
  if (!pending) {
    pending = refreshNow(userId, row!).finally(() => refreshing.delete(userId));
    refreshing.set(userId, pending);
  }
  return pending;
}

async function refreshNow(userId: string, row: ChatGptAccountRow): Promise<string> {
  const refreshToken = decryptSecret(row.refreshTokenEnc);
  if (!refreshToken) {
    await clearTokens(userId, SIGNED_OUT_MESSAGE);
    throw new Error(SIGNED_OUT_MESSAGE);
  }
  try {
    const tokens = await refreshTokens(row.clientId!, refreshToken);
    // The access token, expiry, scopes and rotating refresh token are replaced together.
    await writeAccount(userId, {
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : row.refreshTokenEnc,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes || row.scopes,
      ...(tokens.idToken ? { idTokenEnc: encryptSecret(tokens.idToken) } : {}),
    });
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof OAuthError && TERMINAL_REFRESH_ERRORS.has(error.code)) {
      await clearTokens(userId, SIGNED_OUT_MESSAGE);
      throw new Error(SIGNED_OUT_MESSAGE);
    }
    // Network trouble or a server error: keep the sign-in and let the user try again.
    throw new Error("Couldn't renew your ChatGPT sign-in just now. Try again in a moment.");
  }
}

/** Signs out: revokes the refresh token, clears the tokens, and turns AI off if it was ChatGPT. Returns whether revocation was confirmed. */
export async function signOut(userId: string): Promise<boolean> {
  const row = await readAccount(userId);
  const refreshToken = decryptSecret(row?.refreshTokenEnc);
  const confirmed = row?.clientId && refreshToken ? await revoke(row.clientId, refreshToken) : true;
  if (row) await clearTokens(userId, null);
  const db = await getDb();
  if ((await readSettings(db, userId))?.aiProvider === "chatgpt") await writeSettings(db, userId, { aiProvider: null });
  return confirmed;
}
