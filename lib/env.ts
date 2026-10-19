/** Feature switches derived from environment variables. Safe to import anywhere on the server. */
export const isLocalMode = process.env.HIREME_LOCAL_MODE === "true";
