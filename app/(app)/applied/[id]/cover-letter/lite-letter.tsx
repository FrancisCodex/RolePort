"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { DocumentHeader } from "../document-header";
import { LetterWorkspace } from "./letter-workspace";

/** An application's cover letter in the lite edition: loaded from the browser database. */
export function LiteLetter() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id}
      load={(q) => q.loadLetterPage(id)}
      tables={["application", "job", "profile", "user_settings", "document"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <>
            <DocumentHeader applicationId={id} title="Cover letter" role={data.role} company={data.company} />
            <LetterWorkspace data={data} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="Application not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
