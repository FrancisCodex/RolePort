"use client";

import { X } from "lucide-react";
import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border bg-surface text-sm text-fg shadow-[var(--shadow-soft)] outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-3 focus:ring-brand/15";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 px-3 py-2", className)} {...props} />;
}

/** Free-form tags: Enter or comma adds, Backspace on an empty input removes the last one. */
export function TagInput({
  value,
  onChange,
  placeholder,
  max = 20,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={cn(fieldBase, "flex min-h-9 flex-wrap items-center gap-1 px-1.5 py-1.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15")}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 py-0.5 pr-1 pl-2 text-[13px] font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full text-subtle hover:text-fg"
            aria-label={`Remove ${tag}`}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          add(draft);
          setDraft("");
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-32 flex-1 bg-transparent px-1.5 py-0.5 outline-none placeholder:text-subtle"
      />
    </div>
  );
}

/** Pill toggle group for small multi-select sets. */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== opt.value) : [...value, opt.value])}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
              on
                ? "border-brand/40 bg-brand-soft text-brand-ink"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
