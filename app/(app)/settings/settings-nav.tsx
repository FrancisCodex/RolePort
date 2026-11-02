"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type SettingsNavGroup = { title: string; items: { id: string; label: string }[] };

/** How far below the top of the window a card's top must reach to count as the one being read. */
const READING_LINE = 140;

/**
 * The Settings section menu: a sticky list beside the cards on wide screens, a sticky row of
 * chips above them on smaller ones. It follows the card being read and jumps to one when clicked.
 */
export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0]);
  const chips = useRef<HTMLDivElement>(null);
  const idKey = ids.join(" ");

  // The card being read: the last one whose top has passed the reading line, or the last card at the bottom of the page.
  useEffect(() => {
    const list = idKey.split(" ");
    // A dozen cards: cheap enough to check on every scroll event, with no frame to wait for.
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setActive(list[list.length - 1]);
      let current = list[0];
      for (const id of list) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= READING_LINE) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [idKey]);

  // Keep the active chip centred in the sideways-scrolling row. Instantly: a smooth scroll still
  // under way for an earlier chip could leave the row stopped short of the current one.
  useLayoutEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!row || !chip) return;
    row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  }, [active]);

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <>
      <nav aria-label="Settings sections" className="sticky top-10 hidden self-start xl:block">
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">{group.title}</p>
              {group.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => jump(e, item.id)}
                  aria-current={active === item.id ? "location" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active === item.id ? "bg-brand-soft font-medium text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <nav
        aria-label="Settings sections"
        className="sticky top-12 z-20 -mx-4 mb-6 border-b border-border bg-bg/85 backdrop-blur-xl sm:-mx-8 lg:top-0 xl:hidden"
      >
        <div ref={chips} className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
          {groups.flatMap((group) =>
            group.items.map((item) => (
              <a
                key={item.id}
                data-id={item.id}
                href={`#${item.id}`}
                onClick={(e) => jump(e, item.id)}
                aria-current={active === item.id ? "location" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  active === item.id ? "border-brand/30 bg-brand-soft text-brand-ink" : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.label}
              </a>
            )),
          )}
        </div>
      </nav>
    </>
  );
}
