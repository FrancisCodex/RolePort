"use client";

import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { setApplicationStatus } from "@/app/(app)/jobs/actions";
import { cn } from "@/lib/utils";
import { StatusSelect, type Status } from "./status-select";

export type BoardCard = {
  id: string;
  jobId: string | null;
  role: string;
  company: string;
  status: Status;
  /** Pre-formatted on the server so the label matches between server and client renders. */
  updated: string | null;
};

const COLUMNS: { title: string; dot: string; statuses: Status[] }[] = [
  { title: "Saved", dot: "bg-subtle", statuses: ["saved"] },
  { title: "Applied", dot: "bg-brand", statuses: ["applied", "screening"] },
  { title: "Interview", dot: "bg-warning", statuses: ["interview"] },
  { title: "Offer", dot: "bg-success", statuses: ["offer", "hired"] },
];
const CLOSED: Status[] = ["rejected", "withdrawn", "offer_declined", "ghosted"];

/** Kanban board: drag a card onto another column (or use its status menu) to move it. */
export function PipelineBoard({ cards }: { cards: BoardCard[] }) {
  const [items, applyMove] = useOptimistic(cards, (state, move: { id: string; status: Status }) =>
    state.map((c) => (c.id === move.id ? { ...c, status: move.status } : c)),
  );
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [lastMoved, setLastMoved] = useState<string | null>(null);

  const dragged = items.find((c) => c.id === dragId);
  const closed = items.filter((c) => CLOSED.includes(c.status));

  function move(id: string, status: Status) {
    setLastMoved(id);
    startTransition(async () => {
      applyMove({ id, status });
      await setApplicationStatus(id, status);
    });
  }

  function endDrag() {
    setDragId(null);
    setOverColumn(null);
  }

  const cardProps = (card: BoardCard) => ({
    card,
    dragging: card.id === dragId,
    justMoved: card.id === lastMoved,
    onMove: (status: Status) => move(card.id, status),
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.id);
      setDragId(card.id);
    },
    onDragEnd: endDrag,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colCards = items.filter((c) => col.statuses.includes(c.status));
          const canDrop = !!dragged && !col.statuses.includes(dragged.status);
          const isOver = canDrop && overColumn === col.title;
          return (
            <section
              key={col.title}
              aria-label={col.title}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overColumn !== col.title) setOverColumn(col.title);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged && canDrop) move(dragged.id, col.statuses[0]);
                endDrag();
              }}
              className={cn(
                "flex w-72 shrink-0 snap-start flex-col rounded-3xl bg-surface-2 p-3 transition-[background-color,outline-color] duration-150 sm:w-auto",
                canDrop && "outline-2 -outline-offset-2 outline-border-strong outline-dashed",
                isOver && "bg-brand-soft outline-brand outline-solid",
              )}
            >
              <h2 className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", col.dot)} />
                {col.title}
                <span className="ml-auto text-xs text-subtle tabular-nums">{colCards.length}</span>
              </h2>
              <div className="mt-2 flex flex-1 flex-col gap-2">
                {colCards.map((card) => (
                  <PipelineCard key={card.id} {...cardProps(card)} />
                ))}
                {canDrop ? (
                  <div
                    className={cn(
                      "grid min-h-20 place-items-center rounded-2xl border-2 border-dashed p-4 text-center text-sm font-semibold transition-colors",
                      isOver ? "border-brand text-brand-ink" : "border-border-strong text-subtle",
                    )}
                  >
                    Move to {col.title}
                  </div>
                ) : (
                  colCards.length === 0 && (
                    <div className="grid min-h-32 place-items-center rounded-2xl border-2 border-dashed border-border-strong p-4 text-center text-sm text-subtle">
                      {col.title === "Saved" ? (
                        <span>
                          Save jobs from{" "}
                          <Link href="/jobs" className="font-semibold text-brand">
                            Jobs
                          </Link>
                        </span>
                      ) : (
                        "Nothing here yet"
                      )}
                    </div>
                  )
                )}
              </div>
            </section>
          );
        })}
      </div>

      {closed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">Closed ({closed.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {closed.map((card) => (
              <PipelineCard key={card.id} {...cardProps(card)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PipelineCard({
  card,
  dragging,
  justMoved,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  card: BoardCard;
  dragging: boolean;
  justMoved: boolean;
  onMove: (status: Status) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-grab flex-col gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)] transition-[opacity,transform,box-shadow] duration-150 hover:shadow-[var(--shadow-lift)] active:cursor-grabbing",
        dragging && "scale-[0.98] opacity-40",
        justMoved && "animate-[pane-in_220ms_var(--ease-spring)]",
      )}
    >
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          {card.jobId ? (
            <Link href={`/jobs/${card.jobId}`} draggable={false} className="font-semibold leading-snug hover:text-brand">
              {card.role}
            </Link>
          ) : (
            <p className="font-semibold leading-snug">{card.role}</p>
          )}
          <p className="truncate text-sm text-muted">{card.company}</p>
          {card.updated && <p className="mt-1 text-xs text-subtle">Updated {card.updated.toLowerCase()}</p>}
        </div>
        <GripVertical aria-hidden className="-mr-1 size-4 shrink-0 text-subtle opacity-40 transition-opacity group-hover:opacity-100" />
      </div>
      <StatusSelect status={card.status} onChange={onMove} />
    </article>
  );
}
