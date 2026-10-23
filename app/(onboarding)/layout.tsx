import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** A quiet layout for the welcome guide: no navigation, one thing at a time. */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,var(--brand-soft),transparent_70%)]"
      />
      <header className="relative flex h-16 items-center justify-between px-4 sm:px-8">
        <Logo href="/home" />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 flex-col items-center px-4 pt-4 pb-16 sm:px-6 sm:pt-8">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
