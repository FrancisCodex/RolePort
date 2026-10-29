import { afterEach, vi } from "vitest";

// "use cache" is a plain string outside Next, but cacheLife() needs Next's runtime.
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
