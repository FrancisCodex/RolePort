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
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
      <span className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted shadow-[var(--shadow-soft)]">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>
      {phase && <Badge className="mt-3">{phase}</Badge>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
