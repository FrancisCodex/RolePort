import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border-2 border-border bg-surface-2 px-4 text-[15px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}
