import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLite } from "@/lib/mode";
import { getMyOutreachPage } from "@/lib/outreach/data";
import { DocumentHeader } from "../document-header";
import { EmailsWorkspace } from "./emails-workspace";
import { LiteEmails } from "./lite-emails";

export const metadata: Metadata = { title: "Emails and follow-ups" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function EmailsPage(props: PageProps<"/applied/[id]/emails">) {
  return (
    <Suspense fallback={skeleton}>
      {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
      {isLite ? <LiteEmails /> : <Emails params={props.params} />}
    </Suspense>
  );
}

async function Emails({ params }: { params: PageProps<"/applied/[id]/emails">["params"] }) {
  const { id } = await params;
  const data = await getMyOutreachPage(id);
  if (!data) notFound();
  return (
    <>
      <DocumentHeader applicationId={id} title="Emails and follow-ups" role={data.role} company={data.company} />
      <EmailsWorkspace data={data} />
    </>
  );
}
