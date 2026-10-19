"use client";

import { usePathname } from "next/navigation";
import { createContext, use, type ReactNode } from "react";

/**
 * The jobs layout renders the @drawer slot (a job opened from the list) here, inside the
 * results, so it can sit beside the list instead of outside the page.
 */
const SlotContext = createContext<ReactNode>(null);

export function JobSlotProvider({ slot, children }: { slot: ReactNode; children: ReactNode }) {
  return <SlotContext value={slot}>{children}</SlotContext>;
}

/** The opened job, or `fallback` (the first result) while no job is open. */
export function JobDetailOutlet({ fallback }: { fallback: ReactNode }) {
  const slot = use(SlotContext);
  const onList = usePathname() === "/jobs";
  return (
    <>
      {onList && fallback}
      {slot}
    </>
  );
}
