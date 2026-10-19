import { Suspense } from "react";
import { SidebarNav, TabBar } from "@/components/app/app-nav";
import { UserChip, UserChipSkeleton } from "@/components/app/user-chip";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Logo href="/home" />
          <ThemeToggle />
        </div>
        <div className="mt-8 flex-1">
          <SidebarNav />
        </div>
        <Suspense fallback={<UserChipSkeleton />}>
          <UserChip />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
          <Logo href="/home" className="text-lg" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pt-10 lg:pb-12">{children}</main>
      </div>

      <TabBar />
    </div>
  );
}
