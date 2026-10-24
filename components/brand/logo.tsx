import Link from "next/link";
import { cn } from "@/lib/utils";

/** A monochrome "H" tile: inverts with the theme, so it reads as ink on paper in both modes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-6 place-items-center rounded-md bg-fg text-bg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 5v14M17 5v14M7 12h10" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight", className)}>
      <LogoMark />
      HireMe
    </Link>
  );
}
