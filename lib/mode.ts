/**
 * Build mode, inlined at build time so it works on the server and in the browser.
 * "lite" is the hosted edition (docs/LITE.md): all user data lives in the browser.
 */
export const isLite = process.env.NEXT_PUBLIC_HIREME_MODE === "lite";

/** Address of the hosted lite edition, for "Try it in your browser" on a self-hosted install's landing page. */
export const liteUrl = process.env.NEXT_PUBLIC_HIREME_LITE_URL?.replace(/\/+$/, "") || null;
