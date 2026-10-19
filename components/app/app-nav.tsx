"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems, settingsItem } from "./nav-items";

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
    <nav className="flex flex-col gap-1">
      {[...navItems, settingsItem].map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-[15px] font-semibold transition-colors",
              active
                ? "border-brand/30 bg-brand-soft text-brand-ink"
                : "border-transparent text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  return <TabBarLinks isActive={useIsActive()} />;
}

export function TabBarFallback() {
  return <TabBarLinks isActive={none} />;
}

function TabBarLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-brand" : "text-subtle",
              )}
            >
              <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
