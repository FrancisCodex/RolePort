import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocMarkdown } from "@/components/docs/markdown";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/docs-nav";
import { REPO_URL } from "@/components/marketing/setup-guide";
import { allDocs, getDoc, type Doc } from "@/lib/docs/content";
import { DOC_SLUGS, docHref, docSection } from "@/lib/docs/nav";
import { splitSections } from "@/lib/docs/parse";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug: slug ? slug.split("/") : [] }));
}

async function slugOf(params: Props["params"]) {
  return ((await params).slug ?? []).join("/");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = getDoc(await slugOf(params));
  return doc ? { title: doc.slug ? `${doc.title} · Docs` : "Docs", description: doc.description } : {};
}

function PageLink({ doc, direction }: { doc: Doc | undefined; direction: "previous" | "next" }) {
  if (!doc) return <span />;
  const next = direction === "next";
  return (
    <Link
      href={docHref(doc.slug)}
      className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg border border-border px-3.5 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-2", next && "items-end text-right")}
    >
      <span className="flex items-center gap-1 text-xs text-subtle">
        {!next && <ArrowLeft className="size-3" />}
        {next ? "Next" : "Previous"}
        {next && <ArrowRight className="size-3" />}
      </span>
      <span className="truncate text-[13px] font-medium">{doc.title}</span>
    </Link>
  );
}

export default async function DocPage({ params }: Props) {
  const slug = await slugOf(params);
  const doc = getDoc(slug);
  if (!doc) notFound();

  const docs = allDocs();
  const at = docs.findIndex((d) => d.slug === slug);
  const contents = splitSections(doc.body).sections;

  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
      <DocsSidebar docs={docs} current={slug} />

      <article className="min-w-0 flex-1 py-8 lg:py-12">
        <div className="mx-auto max-w-3xl">
          <DocsMobileNav docs={docs} current={slug} />
          <p className="font-mono text-xs text-subtle">{docSection(slug)}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-balance">{doc.title}</h1>
          {doc.description && <p className="mt-3 text-base text-muted text-pretty">{doc.description}</p>}

          <DocMarkdown body={doc.body} />

          <a
            href={`${REPO_URL}/edit/main/content/docs/${slug || "index"}.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"
          >
            <Pencil className="size-3.5" /> Edit this page on GitHub
          </a>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <PageLink doc={docs[at - 1]} direction="previous" />
            <PageLink doc={docs[at + 1]} direction="next" />
          </div>
        </div>
      </article>

      {contents.length > 0 && (
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 overflow-y-auto py-12 xl:block">
          <p className="pb-2 text-[11px] font-medium text-subtle">On this page</p>
          <ul className="flex flex-col gap-1.5 border-l border-border">
            {contents.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cn("block text-[13px] text-muted hover:text-fg", s.level === 2 ? "pl-3" : "pl-6")}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
