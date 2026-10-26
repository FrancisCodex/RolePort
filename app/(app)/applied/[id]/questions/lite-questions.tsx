"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { DocumentHeader } from "../document-header";
import { QuestionsWorkspace } from "./questions-workspace";

/** An application's questions in the lite edition: loaded from the browser database. */
export function LiteQuestions() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id}
      load={(q) => q.loadQuestionsPage(id)}
      tables={["application", "job", "profile", "user_settings", "document"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <>
            <DocumentHeader applicationId={id} title="Application questions" role={data.role} company={data.company} />
            <QuestionsWorkspace data={data} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="Application not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
