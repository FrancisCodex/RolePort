import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { sidebarInitScript } from "@/components/app/sidebar-toggle";
import { themeInitScript } from "@/components/theme-toggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "HireMe — Open-source job search you run yourself",
    template: "%s · HireMe",
  },
  description:
    "Free, open-source job search that runs on your own machine. Find jobs in your country or abroad, score your fit with your own AI, and track every application.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  // Installed to the home screen (app/manifest.ts); iOS also keeps a home-screen app's storage.
  appleWebApp: { capable: true, title: "HireMe", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-PH"
      data-theme="light"
      // In-page links glide (globals.css); this keeps route changes instant (Next 16 opt-in).
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
