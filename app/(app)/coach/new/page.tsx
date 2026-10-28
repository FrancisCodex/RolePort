import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { getMyInterviewSetup } from "@/lib/interview/data";
import { isLite } from "@/lib/mode";
import { LiteSetup } from "./lite-setup";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "New mock interview" };

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

export default function NewInterviewPage(props: PageProps<"/coach/new">) {
  return (
    <>
      <Link href="/coach" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to Coach
      </Link>
      <PageHeader title="New mock interview" description="Choose what to practise. Your coach plans the questions from your profile and the job." />
      <Suspense fallback={skeleton}>
        {/* Lite reads ?application= in the browser, so the page shell still prerenders. */}
        {isLite ? <LiteSetup /> : <Setup searchParams={props.searchParams} />}
      </Suspense>
    </>
  );
}

async function Setup({ searchParams }: { searchParams: PageProps<"/coach/new">["searchParams"] }) {
  const { application } = await searchParams;
  return <SetupForm data={await getMyInterviewSetup(typeof application === "string" ? application : null)} />;
}
