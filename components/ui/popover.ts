"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const GAP = 6;

/**
 * Fixed-position style for a floating panel anchored to a trigger. Rendered in a portal so
 * scrolling columns and cards never clip it; flips above the trigger when there's no room below.
 */
export function useAnchoredPanel(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  { width, minWidth = 0, maxHeight = 320, roomNeeded = 240 }: { width?: number; minWidth?: number; maxHeight?: number; roomNeeded?: number } = {},
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - GAP;
      const above = r.top - GAP;
      const up = below < roomNeeded && above > below;
      const w = Math.min(width ?? Math.max(r.width, minWidth), window.innerWidth - 16);
      setStyle({
        position: "fixed",
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
        width: w,
        maxHeight: Math.min(maxHeight, (up ? above : below) - 8),
        transformOrigin: up ? "bottom" : "top",
        ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef, width, minWidth, maxHeight, roomNeeded]);

  return open ? style : null;
}

/** Calls `onDismiss` on a pointer press outside every given element while `open`. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!refs.some((ref) => ref.current?.contains(target))) onDismiss();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });
}
