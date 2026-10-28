"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { InterviewRoom } from "./interview-room";

/** A mock interview in the lite edition: loaded from the browser database. */
export function LiteInterview() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id}
      load={(q) => q.loadInterview(id)}
      tables={["user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <InterviewRoom key={id} data={data} />
        ) : (
          <EmptyState icon={SearchX} title="Interview not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
