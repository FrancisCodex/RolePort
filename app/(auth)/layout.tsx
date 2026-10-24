import { Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { MatchRing } from "@/components/ui/match-ring";
import { isLite } from "@/lib/mode";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  // The lite edition has no accounts (proxy.ts also sends these pages to /home).
  if (isLite) notFound();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-5 sm:px-8">
        <Logo />
        <main className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-center text-xs text-subtle">Free and open source · Made in the Philippines</p>
      </div>

      {/* A quiet product preview on a dotted canvas. */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-sidebar lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted">Top match today</p>
              <p className="mt-1 text-[15px] font-semibold">Product Designer</p>
              <p className="text-[13px] text-muted">Fintech startup · BGC, Taguig · Hybrid</p>
            </div>
            <MatchRing score={92} size={48} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-medium">
            <span className="rounded-md border border-success/20 bg-success-soft px-1.5 py-0.5 text-success">Figma</span>
            <span className="rounded-md border border-success/20 bg-success-soft px-1.5 py-0.5 text-success">Design systems</span>
            <span className="rounded-md border border-warning/20 bg-warning-soft px-1.5 py-0.5 text-warning">Motion · learn</span>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
            <Sparkles className="size-3.5 text-brand" />
            CV &amp; cover letter tailored in 40s
          </div>
        </div>
      </aside>
    </div>
  );
}
