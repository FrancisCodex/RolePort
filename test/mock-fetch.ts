import { readFileSync } from "node:fs";
import { vi } from "vitest";

export type MockRoute = { status?: number; body?: unknown; headers?: Record<string, string> };

/**
 * Replaces global fetch. Each call takes the next route in order; the calls are recorded so tests
 * can check the URLs a source asked for. Never reaches the network.
 */
export function mockFetch(...routes: MockRoute[]) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: string | URL | Request) => {
    calls.push(new URL(input instanceof Request ? input.url : input));
    const route = routes[Math.min(calls.length - 1, routes.length - 1)] ?? {};
    const body = route.body === undefined ? null : typeof route.body === "string" ? route.body : JSON.stringify(route.body);
    return new Response(body, { status: route.status ?? 200, headers: route.headers });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

/** Reads a JSON fixture relative to the calling test file's folder. */
export function fixture(metaUrl: string, name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, metaUrl), "utf8"));
}
