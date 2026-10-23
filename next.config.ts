import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The lite edition (docs/LITE.md) builds into its own folder so both modes can run side by side.
  distDir: process.env.NEXT_PUBLIC_HIREME_MODE === "lite" ? ".next-lite" : ".next",
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
