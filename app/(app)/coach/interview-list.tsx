import { ChevronRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { INTERVIEW_LENGTHS, verdictOf, type InterviewListItem } from "@/lib/interview/types";

const formatDate = (d: Date) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

/** The user's mock interviews, newest first, each opening its transcript or report. */
export function InterviewList({ items }: { items: InterviewListItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Practise before the real thing"
        body="Pick a job you applied to, or just a role title, and your coach runs a realistic interview: one question at a time, follow-ups when an answer is vague, and a graded report at the end."
        action={
          <Link href="/coach/new" className={buttonVariants()}>
            Start a mock interview
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/coach/${item.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {formatDate(item.createdAt)} · {INTERVIEW_LENGTHS[item.length].label} · {item.answered} of {item.questions} answered
                {item.applicationId ? " · from an application" : ""}
              </p>
            </div>
            <Status item={item} />
            <ChevronRight className="size-4 shrink-0 text-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Status({ item }: { item: InterviewListItem }) {
  if (item.status === "active") return <Badge tone="brand">In progress</Badge>;
  if (item.status === "ended") return <Badge tone="warning">Report pending</Badge>;
  if (item.score == null) return <Badge>No answers</Badge>;
  const verdict = verdictOf(item.score);
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-muted tabular-nums">{item.score.toFixed(1)}/4</span>
      <Badge tone={verdict.tone}>{verdict.label}</Badge>
    </span>
  );
}
