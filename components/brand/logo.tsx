import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-8 place-items-center rounded-[10px] bg-brand text-brand-fg shadow-[0_2px_0_0_var(--brand-ink)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 5v14M18 5v14M6 12h12" />
        <circle cx="18" cy="5" r="1.4" fill="var(--sun)" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight", className)}>
      <LogoMark />
      HireMe
    </Link>
  );
}
