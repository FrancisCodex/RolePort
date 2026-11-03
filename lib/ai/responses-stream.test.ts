import { describe, expect, it } from "vitest";
import { chatGptErrorMessage, readResponseStream, ResponsesError } from "./responses-stream";

/** A server-sent event stream from these events, cut into awkward chunks like a real network. */
function sse(events: unknown[], chunk = 7): ReadableStream<Uint8Array> {
  const text = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });
}

describe("readResponseStream", () => {
  it("joins the text deltas once the response completes", async () => {
    const stream = sse([
      { type: "response.created" },
      { type: "response.output_text.delta", delta: '{"reply":' },
      { type: "response.output_text.delta", delta: '"Kumusta!"}' },
      { type: "response.completed", response: {} },
    ]);
    await expect(readResponseStream(stream)).resolves.toBe('{"reply":"Kumusta!"}');
  });

  it("reads the completed response's output when no deltas came", async () => {
    const stream = sse([{ type: "response.completed", response: { output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] } }]);
    await expect(readResponseStream(stream)).resolves.toBe("{}");
  });

  it("throws the code of a failed response", async () => {
    const stream = sse([
      { type: "response.output_text.delta", delta: "{" },
      { type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded", message: "limit" } } },
    ]);
    await expect(readResponseStream(stream)).rejects.toMatchObject({ code: "subscription_sharing_usage_limit_exceeded" });
  });

  it("treats a stream that ends without response.completed as failed", async () => {
    await expect(readResponseStream(sse([{ type: "response.output_text.delta", delta: "{" }]))).rejects.toMatchObject({ code: "stream_ended" });
  });

  it("treats an incomplete response as failed", async () => {
    const stream = sse([{ type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } }]);
    await expect(readResponseStream(stream)).rejects.toMatchObject({ code: "incomplete" });
  });
});

describe("chatGptErrorMessage", () => {
  it("points a used-up limit at ChatGPT's usage settings", () => {
    const message = chatGptErrorMessage(new ResponsesError("subscription_sharing_usage_limit_exceeded", null, "", 429));
    expect(message).toContain("Usage limit reached");
    expect(message).toContain("chatgpt.com/settings/usage");
  });

  it("names the refused part of a request", () => {
    expect(chatGptErrorMessage(new ResponsesError("subscription_sharing_unsupported_capability", "tools", "", 400))).toContain("(tools)");
  });
});
