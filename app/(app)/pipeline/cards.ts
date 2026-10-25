import type { PipelineItem } from "@/lib/jobs/applications";
import { timeAgo } from "@/lib/jobs/format";
import type { BoardCard } from "./board";

/** Only what the cards show: the full job rows (descriptions included) stay out of the board. */
export function toBoardCards(items: PipelineItem[]): BoardCard[] {
  return items.map((i) => ({
    id: i.id,
    role: i.role,
    company: i.company,
    status: i.status,
    updated: timeAgo(i.updatedAt),
  }));
}
