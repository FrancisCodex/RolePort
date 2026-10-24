"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A field of fine brand-green dots behind its children, drawn by asciify-engine: a dot grid
 * swelling in slow waves, with the dots rising round the pointer. It stays clear in a soft oval
 * round the child marked `data-dots-clear`.
 * - `hero`: full strength, for the top of the landing page.
 * - `calm`: fainter, for a card.
 *
 * The field mounts on this element itself (asciify puts its canvas underneath the children), because
 * it only follows pointer events that pass through the element it is mounted on.
 * Without WebGL2, or before the engine loads, the children simply sit on the plain surface.
 */
export function DotBackground({ variant, className, children }: { variant: "hero" | "calm"; className?: string; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let handle: { destroy(): void } | undefined;
    let cancelled = false;
    import("./ascii-kit").then((kit) => {
      const el = host.current;
      if (cancelled || !el) return;
      handle = kit.background(el, {
        preset: kit.swell,
        mark: "dot",
        ink: "--brand",
        cursor: "lantern",
        // A wider, stronger light than the preset's default, so the dots clearly rise round the pointer.
        look: { lantern: { radius: 0.2, strength: 1, trail: 0.8 } },
        clear: el.querySelector<HTMLElement>("[data-dots-clear]") ?? false,
        // A card is small and swell keeps its middle quiet, so it runs a little faster to read as moving.
        ...(variant === "calm" && { speed: 1.4, opacity: 0.5 }),
      });
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [variant]);

  return (
    <div ref={host} className={cn("relative isolate", className)}>
      {children}
    </div>
  );
}
