import { Suspense } from "react";
import { SidebarNav, SidebarNavFallback, TabBar, TabBarFallback } from "@/components/app/app-nav";
import { BackupReminder } from "@/components/app/backup-reminder";
import { SidebarCollapseButton, SidebarExpandButton } from "@/components/app/sidebar-toggle";
import { OpenBrowserDb } from "@/components/app/open-browser-db";
import { LiteUserChip, UserChip, UserChipSkeleton } from "@/components/app/user-chip";
import { DocsLink, SettingsLink } from "@/components/app/settings-link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { isLite } from "@/lib/mode";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      {isLite && <OpenBrowserDb />}
      <SidebarExpandButton />
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-sidebar px-2.5 pt-3 pb-2.5 lg:flex [[data-sidebar=hidden]_&]:lg:hidden!">
        <div className="flex h-8 items-center justify-between pr-0.5 pl-2">
          <Logo href="/home" />
          <div className="flex items-center">
            <ThemeToggle />
            <SidebarCollapseButton />
          </div>
        </div>
        <div className="mt-5 flex-1">
          <Suspense fallback={<SidebarNavFallback />}>
            <SidebarNav />
          </Suspense>
        </div>
        <div className="mt-2 border-t border-border pt-2">
          {isLite ? (
            <LiteUserChip />
          ) : (
            <Suspense fallback={<UserChipSkeleton />}>
              <UserChip />
            </Suspense>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-bg/85 pr-2 pl-4 backdrop-blur-xl lg:hidden">
          <Logo href="/home" />
          <div className="flex items-center">
            <DocsLink />
            <SettingsLink />
            <ThemeToggle />
          </div>
        </header>
        {/* Pages that need room (the jobs split view) mark themselves with data-wide. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 has-[[data-wide]]:max-w-7xl sm:px-8 lg:pt-10 lg:pb-12">
          {isLite && <BackupReminder />}
          {children}
        </main>
      </div>

      <Suspense fallback={<TabBarFallback />}>
        <TabBar />
      </Suspense>
    </div>
  );
}
