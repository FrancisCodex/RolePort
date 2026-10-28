import { BookOpen, CircleHelp, ListChecks, MessageCircleQuestion, Quote, ShieldAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { InterviewBriefing } from "@/lib/interview/types";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Things to have ready for any interview, whatever the role. */
const LOGISTICS = [
  "A 60-second answer to “tell me about yourself”: who you are, your strongest recent work, why this role.",
  "Your salary range and the lowest you'd accept, said as a monthly figure.",
  "Your notice period or earliest start date.",
  "For a video call: camera, mic and connection tested, a quiet room, the link open five minutes early.",
];

/** The pre-interview briefing: the role, likely themes, which story proves what, gaps, and questions to ask. */
export function Briefing({ briefing }: { briefing: InterviewBriefing }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[14px] leading-relaxed text-pretty">{briefing.roleSummary}</p>

      {briefing.mustHaves.length > 0 && (
        <Section icon={ListChecks} title="What they'll care about most">
          <div className="flex flex-wrap gap-1.5">
            {briefing.mustHaves.map((m) => (
              <Badge key={m} tone="brand" className="whitespace-normal">
                {m}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {briefing.themes.length > 0 && (
        <Section icon={CircleHelp} title="Likely topics">
          <ul className="flex flex-col gap-3">
            {briefing.themes.map((t) => (
              <li key={t.theme} className="flex flex-col gap-1">
                <span className="text-[13px] font-medium">{t.theme}</span>
                <span className="text-[13px] text-muted">{t.why}</span>
                {t.quote && (
                  <span className="flex gap-1.5 text-xs text-subtle italic">
                    <Quote className="mt-0.5 size-3 shrink-0" /> {t.quote}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {briefing.stories.length > 0 && (
        <Section icon={BookOpen} title="Your story bank">
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {briefing.stories.map((s) => (
              <li key={s.competency} className="flex flex-col gap-1 px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                  {s.competency}
                  {s.from ? <span className="font-normal text-muted">→ {s.from}</span> : <Badge tone="warning">No story yet</Badge>}
                </span>
                <span className="text-xs text-muted">{s.angle}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {briefing.gaps.length > 0 && (
        <Section icon={ShieldAlert} title="Where you might be pressed">
          <ul className="flex flex-col gap-3">
            {briefing.gaps.map((g) => (
              <li key={g.gap} className="flex flex-col gap-1">
                <span className="text-[13px] font-medium">{g.gap}</span>
                <span className="text-[13px] text-muted">{g.howToAddress}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {briefing.questionsToAsk.length > 0 && (
        <Section icon={MessageCircleQuestion} title="Questions to ask them">
          <List items={briefing.questionsToAsk} />
        </Section>
      )}

      <Section icon={Sparkles} title="Have ready">
        <List items={LOGISTICS} />
      </Section>

      <p className="text-xs text-subtle">
        Written {formatWhen(briefing.at)} with {briefing.model}, from your profile{briefing.themes.some((t) => t.quote) ? " and the posting" : ""}.
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-subtle uppercase">
        <Icon className="size-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-[13px]">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" /> {item}
        </li>
      ))}
    </ul>
  );
}
