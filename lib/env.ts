/** Feature switches derived from environment variables. Safe to import anywhere on the server. */
export const isLocalMode = process.env.HIREME_LOCAL_MODE === "true";
export const isAiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
export const isJSearchEnabled = Boolean(process.env.RAPIDAPI_KEY);
