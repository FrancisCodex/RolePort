/** Network failures as the server (Node) and browsers (Chrome, Firefox, Safari) report them. */
const UNREACHABLE = /fetch failed|ECONNREFUSED|ENOTFOUND|Failed to fetch|NetworkError|Load failed/i;

export function isUnreachable(error: unknown): boolean {
  return error instanceof Error && UNREACHABLE.test(error.message + String((error as { cause?: unknown }).cause ?? ""));
}

/** A message for a failed AI call (evaluation, CV reading), the same on the server and in the browser. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The model took too long to answer. Try again, or pick a faster model in Settings.";
  }
  if (isUnreachable(error)) return "Couldn't reach your AI provider. Is it running? Check Settings.";
  return (error instanceof Error && error.message) || fallback;
}
