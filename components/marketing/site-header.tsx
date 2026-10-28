"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommandMenu } from "./command-menu";
import { GitHubMark, REPO_URL } from "./setup-guide";

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** True once the page has scrolled past the very top. */
function useScrolled() {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 8,
    () => false,
  );
}

/**
 * The landing page navbar: see-through over the hero while the page is at the top, then a frosted
 * bar with a hairline border once the visitor scrolls. Each link gets a solid background on hover,
 * so the hero's dots never sit behind the one being read.
 */
const navLink = "rounded-md px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-fg";

export function SiteHeader() {
  const scrolled = useScrolled();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-[var(--ease-snappy)]",
        scrolled
          ? "border-border bg-bg/75 shadow-[0_1px_12px_-4px_hsl(var(--shadow-color)/0.12)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo className="-ml-2 rounded-md px-2 py-1 transition-colors hover:bg-surface-2" />
        <div className="hidden items-center gap-1 text-[13px] text-muted md:flex">
          <Link href="/#features" className={navLink}>
            Features
          </Link>
          <Link href="/#how" className={navLink}>
            How it works
          </Link>
          <Link href="/#get-started" className={navLink}>
            Install
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <CommandMenu />
          <ThemeToggle />
          <a href={REPO_URL} aria-label="RolePort on GitHub" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <GitHubMark />
          </a>
          <Link href="/home" className={buttonVariants({ size: "sm" })}>
            Open RolePort
          </Link>
        </div>
      </nav>
    </header>
  );
}
