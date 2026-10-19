import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,box-shadow,color] duration-150 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Duolingo-style tactile button: a solid "ledge" that compresses on press.
        primary:
          "bg-brand text-brand-fg shadow-[var(--shadow-press)] hover:bg-brand-hover active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--brand-ink)]",
        secondary:
          "border border-border-strong bg-surface text-fg shadow-[0_3px_0_0_var(--border-strong)] hover:bg-surface-2 active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--border-strong)]",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        soft: "bg-brand-soft text-brand-ink hover:bg-brand-soft/70",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-xl px-3.5 text-sm",
        md: "h-11 rounded-2xl px-5 text-[15px]",
        lg: "h-13 rounded-2xl px-7 text-base",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
