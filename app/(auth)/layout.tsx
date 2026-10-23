import { Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MatchRing } from "@/components/ui/match-ring";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-center text-xs text-subtle">Free and open source · Made in the Philippines 🇵🇭</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand lg:flex lg:items-center lg:justify-center">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-40 -left-20 size-[28rem] rounded-full bg-white/5" />
        <div className="relative w-full max-w-sm -rotate-2 rounded-3xl bg-surface p-6 text-fg shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Top match today</p>
              <p className="mt-1 font-display text-xl font-bold">Product Designer</p>
              <p className="text-sm text-muted">Fintech startup · BGC, Taguig · Hybrid</p>
            </div>
            <MatchRing score={92} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-success">Figma ✓</span>
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-success">Design systems ✓</span>
            <span className="rounded-full bg-warning-soft px-2.5 py-1 text-warning">Motion · learn</span>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink">
            <Sparkles className="size-4" />
            CV &amp; cover letter tailored in 40s
          </div>
        </div>
      </aside>
    </div>
  );
}
