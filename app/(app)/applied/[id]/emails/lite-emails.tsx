"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { DocumentHeader } from "../document-header";
import { EmailsWorkspace } from "./emails-workspace";

/** An application's emails in the lite edition: loaded from the browser database. */
export function LiteEmails() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id}
      // Not "document": the page saves its own edits as you type, and a reload would reset the editor.
      load={(q) => q.loadOutreachPage(id)}
      tables={["application", "job", "profile", "user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <>
            <DocumentHeader applicationId={id} title="Emails and follow-ups" role={data.role} company={data.company} />
            <EmailsWorkspace data={data} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="Application not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
