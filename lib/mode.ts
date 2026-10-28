/**
 * Build mode, inlined at build time so it works on the server and in the browser.
 * "lite" is the hosted edition (docs/LITE.md): all user data lives in the browser.
 */
export const isLite = process.env.NEXT_PUBLIC_ROLEPORT_MODE === "lite";

/** Address of the hosted lite edition, for "Try it in your browser" on a self-hosted install's landing page. */
export const liteUrl = process.env.NEXT_PUBLIC_ROLEPORT_LITE_URL?.replace(/\/+$/, "") || null;

/**
 * Whether new users start on the welcome guide (/welcome) instead of Home. On by default in the
 * lite edition, off for self-hosted installs; NEXT_PUBLIC_ROLEPORT_ONBOARDING=on|off overrides.
 * The guide itself stays reachable from Home either way.
 */
export const onboardingEnabled = process.env.NEXT_PUBLIC_ROLEPORT_ONBOARDING ? process.env.NEXT_PUBLIC_ROLEPORT_ONBOARDING === "on" : isLite;
