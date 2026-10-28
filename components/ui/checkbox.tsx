import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Checkbox and radio drawn to match the app's fields (hairline border, brand fill) instead of the
 * browser's own. Each is still a real <input>, just restyled with appearance-none, so labels,
 * keyboard use, forms (`name`/`value`) and screen readers work exactly as before.
 */

type InputProps = Omit<ComponentProps<"input">, "type" | "size">;

const box =
  "peer absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface shadow-[var(--shadow-soft)] transition-[background-color,border-color,box-shadow] duration-150 " +
  "hover:border-brand/60 checked:border-brand checked:bg-brand focus-visible:ring-3 focus-visible:ring-brand/25 focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const sizes = { sm: "size-3.5", md: "size-4" };

export function Checkbox({
  className,
  size = "md",
  onCheckedChange,
  onChange,
  ...props
}: InputProps & { size?: keyof typeof sizes; onCheckedChange?: (checked: boolean) => void }) {
  return (
    <span className={cn("relative inline-flex shrink-0", sizes[size], className)}>
      <input
        type="checkbox"
        className={cn(box, "rounded-[4px]")}
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
      <Check
        aria-hidden
        strokeWidth={3.25}
        className="pointer-events-none absolute inset-0 m-auto size-[70%] text-brand-fg opacity-0 transition-opacity duration-100 peer-checked:opacity-100"
      />
    </span>
  );
}

export function Radio({ className, size = "md", ...props }: InputProps & { size?: keyof typeof sizes }) {
  return (
    <span className={cn("relative inline-flex shrink-0", sizes[size], className)}>
      <input type="radio" className={cn(box, "rounded-full checked:bg-surface")} {...props} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto size-[45%] scale-50 rounded-full bg-brand opacity-0 transition-[opacity,transform] duration-100 peer-checked:scale-100 peer-checked:opacity-100"
      />
    </span>
  );
}
