import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,border-color,box-shadow,color] duration-150 ease-[var(--ease-snappy)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Flat brand fill with a faint top highlight; no Duolingo-style ledge.
        primary:
          "bg-brand text-brand-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_hsl(var(--shadow-color)/0.18)] hover:bg-brand-hover",
        secondary:
          "border border-border bg-surface text-fg shadow-[var(--shadow-soft)] hover:border-border-strong hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        soft: "bg-brand-soft text-brand-ink hover:bg-brand-soft/70",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-7 rounded-md px-2.5 text-xs",
        md: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-10 rounded-lg px-4 text-sm",
        icon: "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
