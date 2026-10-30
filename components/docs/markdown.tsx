import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyBlock } from "@/app/(app)/settings/ollama-setup";
import { slugger } from "@/lib/docs/parse";

type HastNode = { type: string; value?: string; children?: HastNode[] };

function hastText(node: HastNode | undefined): string {
  if (!node) return "";
  return node.value ?? (node.children ?? []).map(hastText).join("");
}

function DocLink({ href = "", children }: ComponentProps<"a">) {
  const className = "font-medium text-brand-ink underline-offset-4 hover:underline";
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function headingAnchor(id: string, children: ReactNode) {
  return (
    <a href={`#${id}`} className="hover:text-brand-ink">
      {children}
    </a>
  );
}

/** A page's Markdown with the site's look. Heading ids match lib/docs/parse.ts, for the contents and search. */
export function DocMarkdown({ body }: { body: string }) {
  const slug = slugger();
  const components: Components = {
    h2: ({ node, children }) => {
      const id = slug(hastText(node).trim());
      return (
        <h2 id={id} className="mt-10 scroll-mt-20 text-xl font-semibold tracking-tight">
          {headingAnchor(id, children)}
        </h2>
      );
    },
    h3: ({ node, children }) => {
      const id = slug(hastText(node).trim());
      return (
        <h3 id={id} className="mt-7 scroll-mt-20 text-base font-semibold tracking-tight">
          {headingAnchor(id, children)}
        </h3>
      );
    },
    p: ({ children }) => <p className="mt-3 text-muted [&_strong]:text-fg">{children}</p>,
    a: ({ href, children }) => <DocLink href={href}>{children}</DocLink>,
    ul: ({ children }) => <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted marker:text-subtle">{children}</ul>,
    // `start`: a code block between steps splits a list in two, and the steps carry on counting.
    ol: ({ start, children }) => (
      <ol start={start} className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-muted marker:text-subtle">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="[&_strong]:text-fg [&>p]:mt-0">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px] [&>p]:mt-0 [&>p+p]:mt-2">{children}</blockquote>
    ),
    code: ({ children }) => <code className="rounded border border-border bg-surface-2 px-1 py-px font-mono text-[0.85em] text-fg">{children}</code>,
    pre: ({ node }) => (
      <div className="mt-3">
        <CopyBlock code={hastText(node).replace(/\n$/, "")} />
      </div>
    ),
    table: ({ children }) => (
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-[13px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-surface-2 text-xs text-muted">{children}</thead>,
    th: ({ children }) => <th className="px-3 py-2 font-medium whitespace-nowrap">{children}</th>,
    td: ({ children }) => <td className="border-t border-border px-3 py-2 align-top text-muted [&_strong]:text-fg">{children}</td>,
    hr: () => <hr className="mt-8 border-border" />,
  };
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {body}
    </Markdown>
  );
}
