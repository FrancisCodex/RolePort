import type { NextConfig } from "next";
import { LITE_SECURITY_HEADERS } from "./lib/security-headers";

const isLite = process.env.NEXT_PUBLIC_ROLEPORT_MODE === "lite";

const nextConfig: NextConfig = {
  // The lite edition (docs/LITE.md) builds into its own folder so both modes can run side by side.
  // Not on Vercel (VERCEL=1): its post-build step expects .next, whatever the build's environment.
  distDir: isLite && !process.env.VERCEL ? ".next-lite" : ".next",
  // The desktop app (desktop/) runs a self-contained server folder instead of `next start`.
  ...(process.env.ROLEPORT_DESKTOP_BUILD === "1"
    ? {
        output: "standalone" as const,
        // The server's file trace takes in the whole project folder. Leave out what it never reads,
        // above all desktop/ itself: its earlier builds and installers would end up inside the next one.
        outputFileTracingExcludes: { "/*": ["desktop/**/*", "services/**/*", "test/**/*"] },
      }
    : {}),
  // PGlite ships WebAssembly + data files that must load from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  /* config options here */
  experimental: {
    // CV uploads go through a server action.
    serverActions: { bodySizeLimit: "6mb" },
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // The hosted lite edition keeps API keys in the page: lock down where it can send data.
  async headers() {
    if (!isLite || process.env.NODE_ENV !== "production") return [];
    return [{ source: "/(.*)", headers: LITE_SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
