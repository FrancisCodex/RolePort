import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteHeader } from "@/components/marketing/site-header";
import { REPO_URL } from "@/components/marketing/setup-guide";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:flex-row sm:px-6">
          <Logo />
          <p className="text-center">
            Open source under the{" "}
            <a href={`${REPO_URL}/blob/main/LICENSE`} className="underline-offset-4 hover:text-fg hover:underline">
              MIT licence
            </a>{" "}
            · Made in the Philippines for job seekers everywhere · Made by{" "}
            <a
              href="https://github.com/FrancisCodex"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:text-fg hover:underline"
            >
              Francis
            </a>{" "}
            ·{" "}
            <Link href="/docs" className="underline-offset-4 hover:text-fg hover:underline">
              Docs
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="underline-offset-4 hover:text-fg hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
