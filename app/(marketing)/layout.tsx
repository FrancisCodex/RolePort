import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { GitHubMark, REPO_URL } from "@/components/marketing/setup-guide";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <Link href="/#how" className="hover:text-fg">How it works</Link>
            <Link href="/#features" className="hover:text-fg">Features</Link>
            <Link href="/#get-started" className="hover:text-fg">Install</Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <a href={REPO_URL} aria-label="HireMe on GitHub" className={buttonVariants({ variant: "ghost", size: "icon" })}>
              <GitHubMark />
            </a>
            <Link href="/home" className={buttonVariants({ size: "sm" })}>
              Open HireMe
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:px-6">
          <Logo className="text-base" />
          <p className="text-center">
            Open source under the{" "}
            <a href={`${REPO_URL}/blob/main/LICENSE`} className="underline-offset-4 hover:text-fg hover:underline">
              MIT licence
            </a>{" "}
            · Made in the Philippines 🇵🇭 for job seekers everywhere ·{" "}
            <Link href="/privacy" className="underline-offset-4 hover:text-fg hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
