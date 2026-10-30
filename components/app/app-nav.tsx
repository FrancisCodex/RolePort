"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { docsItem, navItems, settingsItem } from "./nav-items";

type IsActive = (href: string) => boolean;
const none: IsActive = () => false;

function useIsActive(): IsActive {
  const pathname = usePathname();
  return (href) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  return <SidebarLinks isActive={useIsActive()} />;
}

/** Same links without an active state: the Suspense fallback while the pathname is resolved. */
export function SidebarNavFallback() {
  return <SidebarLinks isActive={none} />;
}

function SidebarLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav className="flex h-full flex-col">
      <p className="px-2 pb-1 text-[11px] font-medium text-subtle">Workspace</p>
      <div className="flex flex-col gap-px">
        {navItems.map((item) => (
          <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-px pt-4">
        <SidebarLink {...docsItem} active={false} />
        <SidebarLink {...settingsItem} active={isActive(settingsItem.href)} />
      </div>
    </nav>
  );
}

function SidebarLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
        active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4", active ? "text-fg" : "text-subtle")} strokeWidth={1.75} />
      {label}
    </Link>
  );
}

export function TabBar() {
  return <TabBarLinks isActive={useIsActive()} />;
}

export function TabBarFallback() {
  return <TabBarLinks isActive={none} />;
}

const tabItems = navItems.filter((item) => !("tab" in item) || item.tab);

function TabBarLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-medium transition-colors",
                active ? "text-fg" : "text-subtle",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
