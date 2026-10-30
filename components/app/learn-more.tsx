import Link from "next/link";
import { docHref, type DocSlug } from "@/lib/docs/nav";

/** A small link from a screen to its page in the documentation. */
export function LearnMore({ doc }: { doc: DocSlug }) {
  return (
    <Link href={docHref(doc)} className="font-medium whitespace-nowrap text-brand-ink hover:underline">
      Learn more
    </Link>
  );
}
