import Link from "next/link";
import type { Doc } from "@/lib/docs/content";
import { DOCS_NAV, docHref } from "@/lib/docs/nav";
import { cn } from "@/lib/utils";

/** Every page by section. The page in view is passed in, so the whole sidebar stays static. */
function DocsLinks({ titles, current }: { titles: Map<string, string>; current: string }) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-5">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1 text-[11px] font-medium text-subtle">{section.title}</p>
          <ul className="flex flex-col gap-px">
            {section.slugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={docHref(slug)}
                  aria-current={slug === current ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-2 py-1 text-[13px] transition-colors",
                    slug === current ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {titles.get(slug)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ docs, current }: { docs: Doc[]; current: string }) {
  const titles = new Map(docs.map((d) => [d.slug, d.title]));
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 pr-2 lg:block">
      <DocsLinks titles={titles} current={current} />
    </aside>
  );
}

/** The same links on phones and tablets, folded away above the page. */
export function DocsMobileNav({ docs, current }: { docs: Doc[]; current: string }) {
  const titles = new Map(docs.map((d) => [d.slug, d.title]));
  return (
    <details className="mb-6 rounded-lg border border-border bg-surface lg:hidden">
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium select-none">
        All pages <span className="font-normal text-muted">· {titles.get(current)}</span>
      </summary>
      <div className="max-h-[60dvh] overflow-y-auto border-t border-border p-2">
        <DocsLinks titles={titles} current={current} />
      </div>
    </details>
  );
}
