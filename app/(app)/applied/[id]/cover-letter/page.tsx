import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMyLetterPage } from "@/lib/letter/data";
import { isLite } from "@/lib/mode";
import { DocumentHeader } from "../document-header";
import { LetterWorkspace } from "./letter-workspace";
import { LiteLetter } from "./lite-letter";

export const metadata: Metadata = { title: "Cover letter" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function CoverLetterPage(props: PageProps<"/applied/[id]/cover-letter">) {
  return (
    <Suspense fallback={skeleton}>
      {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
      {isLite ? <LiteLetter /> : <Letter params={props.params} />}
    </Suspense>
  );
}

async function Letter({ params }: { params: PageProps<"/applied/[id]/cover-letter">["params"] }) {
  const { id } = await params;
  const data = await getMyLetterPage(id);
  if (!data) notFound();
  return (
    <>
      <DocumentHeader applicationId={id} title="Cover letter" role={data.role} company={data.company} />
      <LetterWorkspace data={data} />
    </>
  );
}
