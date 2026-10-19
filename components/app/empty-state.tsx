import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function EmptyState({
  icon: Icon,
  title,
  body,
  phase,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  phase?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-border-strong px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-3xl bg-brand-soft text-brand-ink">
        <Icon className="size-7" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-muted">{body}</p>
      {phase && (
        <Badge tone="brand" className="mt-4">
          {phase}
        </Badge>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
