import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** A quiet layout for the welcome guide: no navigation, one thing at a time. */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="relative flex h-14 items-center justify-between pr-2 pl-4 sm:pr-4 sm:pl-6">
        <Logo href="/home" />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 flex-col items-center px-4 pt-4 pb-16 sm:px-6 sm:pt-10">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
