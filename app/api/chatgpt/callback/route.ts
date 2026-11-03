import type { NextRequest } from "next/server";
import { clearPending, markProblem, readAccount, readPending, saveSignIn } from "@/lib/chatgpt/account";
import { switchToChatGpt } from "@/lib/chatgpt/models";
import { exchangeCode, OAuthError, PLAN_SCOPE, verifyIdToken } from "@/lib/chatgpt/oauth";
import { isLite } from "@/lib/mode";
import { getCurrentUser } from "@/lib/session";

/*
 * Where OpenAI sends the browser after "Continue with ChatGPT" (lib/chatgpt/oauth.ts). Always
 * reached at http://127.0.0.1:<port>, so it finds the sign-in in progress in the database rather
 * than a cookie (the user opened RolePort at localhost, a different site to the browser), then
 * sends the browser back to Settings where they started.
 */

export async function GET(request: NextRequest) {
  if (isLite) return new Response(null, { status: 404 });
  const user = await getCurrentUser();
  const params = request.nextUrl.searchParams;
  const pending = readPending(await readAccount(user.id));

  if (!pending || params.get("state") !== pending.state) {
    return new Response(
      "<!doctype html><meta charset=utf-8><title>RolePort</title><p style=\"font:15px system-ui;margin:3rem\">This sign-in has expired or was started somewhere else. Go back to RolePort's Settings and choose <b>Continue with ChatGPT</b> again.</p>",
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  const back = (result: string) => Response.redirect(`${pending.returnTo}/settings?chatgpt=${result}#ai`, 303);

  if (params.get("error")) {
    await clearPending(user.id);
    return back(params.get("error") === "access_denied" ? "denied" : "failed");
  }

  // A sign-in after the first keeps its client ID; the first one is issued it here.
  const issued = params.get("client_id");
  const clientId = pending.clientId ?? issued;
  const code = params.get("code");
  try {
    if (pending.clientId && issued && issued !== pending.clientId) throw new Error("OpenAI answered for a different app registration. Try again.");
    if (!clientId) throw new Error("OpenAI didn't finish registering RolePort. Try again.");
    if (!code) throw new Error("OpenAI didn't send a sign-in code. Try again.");

    const tokens = await exchangeCode(pending, clientId, code);
    if (!tokens.idToken) throw new Error("OpenAI's sign-in didn't say who signed in.");
    const { subject, email } = await verifyIdToken(tokens.idToken, clientId, pending.nonce);
    await saveSignIn(user.id, { clientId, subject, email, tokens });

    // Signed in, but plan use declined: keep the sign-in and say so in Settings.
    if (!tokens.scopes.split(/\s+/).includes(PLAN_SCOPE)) return back("no-plan");
    await switchToChatGpt(user.id, tokens.accessToken);
    return back(pending.clientId ? "signed-in" : "welcome");
  } catch (error) {
    await clearPending(user.id);
    const message =
      error instanceof OAuthError && error.code === "invalid_grant"
        ? "The sign-in code had already been used or expired. Try again."
        : error instanceof Error
          ? error.message
          : "The sign-in didn't work.";
    await markProblem(user.id, message);
    return back("failed");
  }
}
