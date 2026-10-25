import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isAiConfigured } from "@/lib/ai/config";
import { getMyApplication } from "@/lib/jobs/data";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import { isLite } from "@/lib/mode";
import { toApplicationData } from "../view-data";
import { ApplicationView } from "./application-view";
import { LiteApplication } from "./lite-application";

export const metadata: Metadata = { title: "Application" };

// Where "Apply" leads: the saved posting, its progress and (next) the tailored CV and answers.
export default function ApplicationPage(props: PageProps<"/applied/[id]">) {
  return (
    <>
      <Link href="/applied" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to applied jobs
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}>
        {/* Lite reads the id in the browser (useParams), so the page shell still prerenders. */}
        {isLite ? <LiteApplication /> : <Application params={props.params} />}
      </Suspense>
    </>
  );
}

async function Application({ params }: { params: PageProps<"/applied/[id]">["params"] }) {
  const { id } = await params;
  const [found, aiEnabled] = await Promise.all([getMyApplication(id), isAiConfigured()]);
  if (!found) notFound();
  const { application, job } = found;
  return <ApplicationView data={toApplicationData(application, job, aiEnabled, job && sourceCredit(job.source))} />;
}
