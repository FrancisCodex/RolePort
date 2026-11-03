/*
 * OpenAI's Responses API on a ChatGPT plan (Sign in with ChatGPT): every request streams, and
 * only `response.completed` means it worked. Errors come as an HTTP status before the stream
 * opens, or as `response.failed` inside it, both with an `error.code` worth showing as words.
 */

const RESPONSES_URL = "https://api.openai.com/v1/responses";
export const USAGE_SETTINGS_URL = "https://chatgpt.com/settings/usage";
const TIMEOUT_MS = 5 * 60_000;

export class ResponsesError extends Error {
  constructor(
    readonly code: string,
    readonly param: string | null,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** POST /v1/responses and return the streamed output text. */
export async function streamResponse(accessToken: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ ...body, store: false, stream: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let parsed: { error?: { code?: string; param?: string; message?: string }; detail?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {}
    const error = parsed.error;
    throw new ResponsesError(error?.code ?? `http_${res.status}`, error?.param ?? null, error?.message ?? parsed.detail ?? text.slice(0, 200), res.status);
  }
  return readResponseStream(res.body);
}

type StreamEvent = {
  type?: string;
  delta?: string;
  response?: { error?: { code?: string; param?: string; message?: string } | null; incomplete_details?: { reason?: string } | null; output?: unknown[] };
  code?: string;
  param?: string;
  message?: string;
};

/** Reads server-sent events until `response.completed`; throws on `response.failed`, `response.incomplete` or an early end. */
export async function readResponseStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const handle = (raw: string): boolean => {
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return false;
    let event: StreamEvent;
    try {
      event = JSON.parse(data);
    } catch {
      return false;
    }
    switch (event.type) {
      case "response.output_text.delta":
        text += event.delta ?? "";
        return false;
      case "response.completed":
        if (!text) text = outputText(event.response?.output);
        return true;
      case "response.failed": {
        const error = event.response?.error;
        throw new ResponsesError(error?.code ?? "unknown_error", error?.param ?? null, error?.message ?? "The response failed.");
      }
      case "response.incomplete":
        throw new ResponsesError("incomplete", null, event.response?.incomplete_details?.reason ?? "The answer was cut off.");
      case "error":
        throw new ResponsesError(event.code ?? "unknown_error", event.param ?? null, event.message ?? "The response failed.");
      default:
        return false;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : events.pop()!;
      for (const raw of events) if (handle(raw)) return text;
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  throw new ResponsesError("stream_ended", null, "The answer stopped before it was finished.");
}

/** The text of a completed response's message items, when no deltas came. */
function outputText(output: unknown[] | undefined): string {
  return (output ?? [])
    .flatMap((item) => ((item as { content?: unknown[] }).content ?? []) as { type?: string; text?: string }[])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");
}

/** What to tell the user about a failed ChatGPT-plan call (OpenAI's "Errors and recovery" page). */
export function chatGptErrorMessage(error: ResponsesError): string {
  switch (error.code) {
    case "subscription_sharing_usage_limit_exceeded":
      return `Usage limit reached. Review your plan or RolePort's limit in ChatGPT settings: ${USAGE_SETTINGS_URL}`;
    case "subscription_sharing_usage_unavailable":
    case "subscription_sharing_user_unavailable":
      return "ChatGPT plan usage is unavailable right now. Try again in a few minutes.";
    case "subscription_sharing_user_not_eligible":
      return "This ChatGPT account can't use its plan in other apps. Use an API key or Ollama instead.";
    case "subscription_sharing_unsupported_capability":
      return `ChatGPT doesn't support part of this request${error.param ? ` (${error.param})` : ""}. Try another model in Settings.`;
    case "subscription_sharing_invalid_user":
      return "ChatGPT didn't accept your sign-in. If you disconnected RolePort in ChatGPT, sign in again in Settings.";
    case "incomplete":
    case "stream_ended":
      return "ChatGPT's answer was incomplete. Please try again.";
  }
  if (error.status === 401) return "ChatGPT didn't accept your sign-in. Sign in again in Settings.";
  if (error.status === 403) return `ChatGPT refused the request${error.message ? `: ${error.message}` : "."}`;
  if (error.status === 503) return "ChatGPT plan usage is unavailable right now. Try again in a few minutes.";
  if (error.status === 404) return "That ChatGPT model isn't available to your account. Pick another in Settings.";
  return `ChatGPT answered ${error.code}${error.message ? `: ${error.message}` : ""}`;
}
