/*
 * Lite edition: the browser talks to a model server on the user's own machine (Ollama,
 * LM Studio). When that fails, a fetch error alone can't say why, so these helpers work it out.
 */

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i;

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isOllamaUrl(url: string): boolean {
  try {
    return new URL(url).port === "11434";
  } catch {
    return false;
  }
}

/**
 * Why a request to a local server failed with a network error. A CORS refusal and "nothing
 * listening" look the same to fetch(), but a no-cors request resolves whenever something answers.
 */
export async function explainLocalFailure(baseUrl: string): Promise<string> {
  const { origin } = new URL(baseUrl);
  const name = isOllamaUrl(baseUrl) ? "Ollama" : `The server at ${origin}`;
  try {
    await fetch(origin, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(3_000) });
    return isOllamaUrl(baseUrl)
      ? `Ollama is running but doesn't allow this site yet. Set OLLAMA_ORIGINS to ${location.origin} (steps below), then restart Ollama.`
      : `${name} is running but doesn't allow requests from ${location.origin}. Allow this site in its CORS settings.`;
  } catch {
    return `Couldn't reach ${isOllamaUrl(baseUrl) ? "Ollama" : origin}. Is it running? If your browser asked to let this site access devices on your local network, allow it.`;
  }
}
