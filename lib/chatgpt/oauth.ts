import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/*
 * Sign in with ChatGPT for open-source, locally hosted apps (developers.openai.com/siwc,
 * "Open-source plan usage"): OAuth with PKCE and a loopback callback, no client secret. The
 * first sign-in registers RolePort with `dynamic_agent_client` and OpenAI issues a client ID
 * for that account; later sign-ins reuse it. It's a preview, so the details here may change.
 */

export const ISSUER = "https://auth.openai.com";
const AUTHORIZE_URL = `${ISSUER}/api/accounts/authorize`;
const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
export const API_BASE = "https://api.openai.com/v1";
const REGISTRATION_CLIENT = "dynamic_agent_client";
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
/** The scope that lets RolePort's requests count against the user's plan. */
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
/** Only the port may change between sign-ins; the path must stay exactly this. */
export const CALLBACK_PATH = "/api/chatgpt/callback";

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

/** What a sign-in in progress keeps until the callback. */
export type PendingSignIn = {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  /** The issued client ID on a sign-in after the first, else null (registration). */
  clientId: string | null;
  /** Where to send the browser afterwards: the address RolePort was opened at. */
  returnTo: string;
  startedAt: number;
};

export const newHostId = () => `urn:uuid:${randomUUID()}`;

const random = () => randomBytes(32).toString("base64url");

export function startSignIn(opts: {
  hostId: string;
  port: string;
  returnTo: string;
  clientId: string | null;
  idTokenHint?: string | null;
  email?: string | null;
  /** Ask again for plan use after the user declined it. */
  consent?: boolean;
}): { url: string; pending: PendingSignIn } {
  const pending: PendingSignIn = {
    state: random(),
    nonce: random(),
    verifier: random(),
    // 127.0.0.1, never localhost: OpenAI only accepts the loopback IP.
    redirectUri: `http://127.0.0.1:${opts.port}${CALLBACK_PATH}`,
    clientId: opts.clientId,
    returnTo: opts.returnTo,
    startedAt: Date.now(),
  };
  const params = new URLSearchParams({
    client_id: opts.clientId ?? REGISTRATION_CLIENT,
    ...(opts.clientId ? {} : { agent_name_hint: "RolePort" }),
    ext_agent_host_id: opts.hostId,
    ...(opts.clientId && opts.idTokenHint ? { id_token_hint: opts.idTokenHint } : {}),
    ...(opts.clientId && opts.email ? { login_hint: opts.email } : {}),
    ...(opts.consent ? { prompt: "consent" } : {}),
    response_type: "code",
    redirect_uri: pending.redirectUri,
    scope: SCOPES,
    resource: API_BASE,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
  });
  return { url: `${AUTHORIZE_URL}?${params}`, pending };
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: Date;
  scopes: string;
};

/** An OAuth error from the token endpoint, with its code (invalid_grant, …). */
export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function tokenRequest(form: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.access_token !== "string") {
    const code = typeof body.error === "string" ? body.error : `http_${res.status}`;
    throw new OAuthError(code, `OpenAI's sign-in answered ${code}.`);
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    idToken: typeof body.id_token === "string" ? body.id_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: typeof body.scope === "string" ? body.scope : "",
  };
}

export function exchangeCode(pending: PendingSignIn, clientId: string, code: string): Promise<TokenSet> {
  return tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: pending.verifier,
    redirect_uri: pending.redirectUri,
    resource: API_BASE,
  });
}

/** A new access token and a replacement refresh token; the old refresh token stops working. */
export function refreshTokens(clientId: string, refreshToken: string): Promise<TokenSet> {
  // No scope: the existing grant is kept.
  return tokenRequest({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken, resource: API_BASE });
}

/** Refresh errors that mean the sign-in is over and the user has to sign in again. */
export const TERMINAL_REFRESH_ERRORS = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
]);

/** Checks the ID token's signature, issuer, audience, expiry and nonce; returns who signed in. */
export async function verifyIdToken(idToken: string, clientId: string, nonce: string): Promise<{ subject: string; email: string | null }> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUER,
    audience: clientId,
    requiredClaims: ["sub", "exp", "iat"],
    clockTolerance: 5,
  });
  if (payload.nonce !== nonce) throw new Error("The sign-in didn't match this attempt. Try again.");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("OpenAI's sign-in didn't say who signed in.");
  return { subject: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

/** Revokes the refresh token. Returns whether OpenAI confirmed it. */
export async function revoke(clientId: string, refreshToken: string): Promise<boolean> {
  try {
    const discovery = (await (await fetch(DISCOVERY_URL, { signal: AbortSignal.timeout(10_000) })).json()) as { revocation_endpoint?: string };
    if (!discovery.revocation_endpoint) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(discovery.revocation_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token", client_id: clientId }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;
      if (res.status < 500) return false;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  } catch {
    // Network failure: the caller says revocation wasn't confirmed.
  }
  return false;
}

export type ChatGptModel = { slug: string; label: string };

/** The models this ChatGPT account may use, in OpenAI's order. */
export async function listChatGptModels(accessToken: string): Promise<ChatGptModel[]> {
  const res = await fetch(`${API_BASE}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Couldn't list your ChatGPT models (${res.status}).`);
  const body = (await res.json()) as { models?: unknown[]; data?: unknown[] };
  type Entry = { slug?: string; id?: string; display_name?: string; visibility?: string };
  return ((body.models ?? body.data ?? []) as Entry[])
    .filter((m) => m.visibility === undefined || m.visibility === "list")
    .map((m) => ({ slug: m.slug ?? m.id ?? "", label: m.display_name ?? m.slug ?? m.id ?? "" }))
    .filter((m) => m.slug);
}
