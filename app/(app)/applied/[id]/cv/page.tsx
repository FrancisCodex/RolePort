import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMyCvPage } from "@/lib/cv/data";
import { isLite } from "@/lib/mode";
import { DocumentHeader } from "../document-header";
import { CvWorkspace } from "./cv-workspace";
import { LiteCv } from "./lite-cv";

export const metadata: Metadata = { title: "Tailored CV" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function CvPage(props: PageProps<"/applied/[id]/cv">) {
  return (
    <Suspense fallback={skeleton}>
      {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
      {isLite ? <LiteCv /> : <Cv params={props.params} />}
    </Suspense>
  );
}

async function Cv({ params }: { params: PageProps<"/applied/[id]/cv">["params"] }) {
  const { id } = await params;
  const data = await getMyCvPage(id);
  if (!data) notFound();
  return (
    <>
      <DocumentHeader applicationId={id} title="Tailored CV" role={data.role} company={data.company} />
      {/* The editor keeps its own state after loading; saves and tailoring update it in place. */}
      <CvWorkspace data={data} />
    </>
  );
}
