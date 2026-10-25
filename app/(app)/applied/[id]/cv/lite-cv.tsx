"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { DocumentHeader } from "../document-header";
import { CvWorkspace } from "./cv-workspace";

/** An application's CV in the lite edition: loaded from the browser database. */
export function LiteCv() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id}
      load={(q) => q.loadCvPage(id)}
      tables={["application", "job", "profile", "user_settings", "document"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <>
            <DocumentHeader applicationId={id} title="Tailored CV" role={data.role} company={data.company} />
            <CvWorkspace data={data} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="Application not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
