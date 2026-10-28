import type { MetadataRoute } from "next";
import { isLite } from "@/lib/mode";

/**
 * Makes RolePort installable as an app. Matters most for the lite edition: an installed app's
 * storage is less likely to be cleared (Safari deletes a site's data after about a week
 * without a visit unless it's on the home screen).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: isLite ? "RolePort Lite" : "RolePort",
    short_name: "RolePort",
    description: isLite
      ? "Free, open-source job search in your browser. Your data stays on your device."
      : "Free, open-source job search that runs on your own machine.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
