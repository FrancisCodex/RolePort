import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMyInterview } from "@/lib/interview/data";
import { isLite } from "@/lib/mode";
import { InterviewRoom } from "./interview-room";
import { LiteInterview } from "./lite-interview";

export const metadata: Metadata = { title: "Mock interview" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function InterviewPage(props: PageProps<"/coach/[id]">) {
  return (
    <Suspense fallback={skeleton}>
      {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
      {isLite ? <LiteInterview /> : <Interview params={props.params} />}
    </Suspense>
  );
}

async function Interview({ params }: { params: PageProps<"/coach/[id]">["params"] }) {
  const { id } = await params;
  const data = await getMyInterview(id);
  if (!data) notFound();
  return <InterviewRoom key={id} data={data} />;
}
