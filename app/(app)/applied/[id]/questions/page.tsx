import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLite } from "@/lib/mode";
import { getMyQuestionsPage } from "@/lib/questions/data";
import { DocumentHeader } from "../document-header";
import { LiteQuestions } from "./lite-questions";
import { QuestionsWorkspace } from "./questions-workspace";

export const metadata: Metadata = { title: "Application questions" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function QuestionsPage(props: PageProps<"/applied/[id]/questions">) {
  return (
    <Suspense fallback={skeleton}>
      {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
      {isLite ? <LiteQuestions /> : <Questions params={props.params} />}
    </Suspense>
  );
}

async function Questions({ params }: { params: PageProps<"/applied/[id]/questions">["params"] }) {
  const { id } = await params;
  const data = await getMyQuestionsPage(id);
  if (!data) notFound();
  return (
    <>
      <DocumentHeader applicationId={id} title="Application questions" role={data.role} company={data.company} />
      <QuestionsWorkspace data={data} />
    </>
  );
}
