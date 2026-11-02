import { Database, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { LearnMore } from "@/components/app/learn-more";
import { VoicePanel } from "@/components/speech/voice-settings";
import { CompanyManager } from "@/components/companies/company-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsForm, type AiSettingsView } from "./ai-settings-form";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { BackupControls } from "./backup-controls";
import { JobSourceForm, JobSpyToggle } from "./job-source-form";
import { LocalJobSpy } from "./local-jobspy";
import { McpForm, type McpSettingsView } from "./mcp-form";
import type { FollowUpRules } from "@/lib/outreach/rules";
import { FollowUpRulesForm } from "./follow-up-rules-form";
import { AnswerPromptForm, CvPromptForm, EmailPromptForm, InterviewerPromptForm, LetterPromptForm, ProfilePromptForm } from "./prompt-form";
import { SettingsNav, type SettingsNavGroup } from "./settings-nav";

export type SettingsData = {
  ai: AiSettingsView;
  /** AI calls run from this browser and data lives in it (the lite edition). */
  aiInBrowser?: boolean;
  rapidApiKeyHint: string | null;
  companies: FollowedCompanyView[];
  /** The user's countries (home first), for the starter company lists. */
  countries: string[];
  /** The JobSpy switch, when this install can use it. */
  jobSpy: { enabled: boolean; reachable: boolean } | null;
  /** Lite: JobSpy on the user's computer, called from the browser. */
  localJobSpy?: { enabled: boolean };
  /** The user's own instructions for reading a CV, or null for the default. */
  profilePrompt: string | null;
  /** The user's own CV tailoring instructions, or null for the default. */
  cvPrompt: string | null;
  /** The user's own cover letter instructions, or null for the default. */
  coverLetterPrompt: string | null;
  answerPrompt: string | null;
  /** The user's own mock interviewer instructions, or null for the default. */
  interviewPrompt: string | null;
  /** The user's own email instructions, or null for the default. */
  emailPrompt: string | null;
  /** When follow-ups come due. */
  followUpRules: FollowUpRules;
  /** The MCP server switch, on self-hosted installs (the lite edition has no server to reach). */
  mcp?: McpSettingsView;
  /** Where the user's data and keys are kept, for the "Your data" card. */
  dataNote: string;
  keyNote: string;
};

/**
 * One card. `id` is its anchor: other pages link to /settings#<id> (follow-ups, the prompts,
 * data), so keep ids stable. `nav` is its shorter name in the section menu.
 */
type Section = { id: string; title: string; nav?: string; description: ReactNode; content: ReactNode; contentClassName?: string };
type Group = { title: string; sections: (Section | false | undefined)[] };

const groupId = (title: string) => `settings-${title.toLowerCase().replace(/\W+/g, "-")}`;

/** The Settings cards in groups, with a menu to jump between them. Shared by the server page and the lite edition. */
export function SettingsView({
  ai,
  aiInBrowser,
  rapidApiKeyHint,
  companies,
  countries,
  jobSpy,
  localJobSpy,
  profilePrompt,
  cvPrompt,
  coverLetterPrompt,
  answerPrompt,
  interviewPrompt,
  emailPrompt,
  followUpRules,
  mcp,
  dataNote,
  keyNote,
}: SettingsData) {
  const groups: Group[] = [
    {
      title: "AI",
      sections: [
        {
          id: "ai",
          title: "AI provider",
          description: (
            <>
              Used to read your CV, evaluate fit and tailor applications. Use your own API key, or run a model locally with Ollama for free.{" "}
              <LearnMore doc="ai/providers" />
            </>
          ),
          content: <AiSettingsForm initial={ai} aiInBrowser={aiInBrowser} />,
        },
        mcp && {
          id: "agents",
          title: "Connect an AI agent",
          nav: "AI agents",
          description: (
            <>
              Use RolePort from Claude, Codex, Cursor or another AI agent you already use: &ldquo;find data analyst jobs in Cebu from this week and
              evaluate the best five.&rdquo; Off until you turn it on, and only agents with the token can connect. <LearnMore doc="ai/agents" />
            </>
          ),
          content: <McpForm initial={mcp} />,
        },
      ],
    },
    {
      title: "Job search",
      sections: [
        {
          id: "job-sources",
          title: "Job sources",
          description: (
            <>
              freehire, the remote-job feeds (Jobicy, Remotive, Himalayas, Remote OK) and official boards like Platsbanken (Sweden) work without a
              key and are searched whenever they cover your search. Add JSearch to include Google for Jobs listings from JobStreet, Indeed,
              LinkedIn and Kalibrr. <LearnMore doc="job-sources" />
            </>
          ),
          content: (
            <>
              <JobSourceForm rapidApiKeyHint={rapidApiKeyHint} />
              {jobSpy && <JobSpyToggle enabled={jobSpy.enabled} reachable={jobSpy.reachable} />}
              {localJobSpy && <LocalJobSpy enabled={localJobSpy.enabled} />}
            </>
          ),
          contentClassName: "flex flex-col gap-4",
        },
        {
          id: "companies",
          title: "Companies you follow",
          nav: "Companies",
          description: (
            <>
              Know a company you&apos;d love to work for? Follow it, and every job search also checks that company&apos;s own list of openings, in
              any country. You can also do this from the Jobs page. <LearnMore doc="guides/companies" />
            </>
          ),
          content: <CompanyManager companies={companies} countries={countries} />,
        },
        {
          id: "follow-ups",
          title: "Follow-up reminders",
          description: (
            <>
              When a follow-up comes due on Home and on each application. Switch off any you don&apos;t want. RolePort only reminds you and drafts
              the email; it never sends anything. <LearnMore doc="guides/emails" />
            </>
          ),
          content: <FollowUpRulesForm saved={followUpRules} />,
        },
      ],
    },
    {
      title: "Prompts",
      sections: [
        {
          id: "profile-prompt",
          title: "CV reading prompt",
          nav: "CV reading",
          description: (
            <>
              Exactly what RolePort asks the AI when it reads your CV into your profile. Change what it picks up, ask for a section or a summary of
              its own, or go back to the default at any time. <LearnMore doc="ai/prompts" />
            </>
          ),
          content: <ProfilePromptForm saved={profilePrompt} />,
        },
        {
          id: "cv-prompt",
          title: "CV tailoring prompt",
          nav: "CV tailoring",
          description: (
            <>
              Exactly what RolePort asks the AI when it tailors your CV to a job. Read it, change it to suit how you like your CV written, or go
              back to the default at any time. <LearnMore doc="guides/tailored-cv" />
            </>
          ),
          content: <CvPromptForm saved={cvPrompt} />,
        },
        {
          id: "letter-prompt",
          title: "Cover letter prompt",
          nav: "Cover letters",
          description: (
            <>
              Exactly what RolePort asks the AI when it writes a cover letter. Change the tone, length or structure to suit you, or go back to the
              default at any time. <LearnMore doc="guides/cover-letters" />
            </>
          ),
          content: <LetterPromptForm saved={coverLetterPrompt} />,
        },
        {
          id: "answer-prompt",
          title: "Application questions prompt",
          nav: "Application questions",
          description: (
            <>
              Exactly what RolePort asks the AI when it answers a question from an application form. Change the tone, length or approach to suit
              you, or go back to the default at any time. <LearnMore doc="guides/application-questions" />
            </>
          ),
          content: <AnswerPromptForm saved={answerPrompt} />,
        },
        {
          id: "email-prompt",
          title: "Email prompt",
          nav: "Emails",
          description: (
            <>
              Exactly what RolePort asks the AI when it writes an application email, a referral request, a note to a hiring manager or a follow-up.
              Change the tone or length of each kind, or go back to the default at any time. <LearnMore doc="guides/emails" />
            </>
          ),
          content: <EmailPromptForm saved={emailPrompt} />,
        },
        {
          id: "interviewer-prompt",
          title: "Mock interviewer prompt",
          nav: "Mock interviewer",
          description: (
            <>
              What the Interview Coach&apos;s interviewer is told after each of your answers: when to press with a follow-up and when to move on.
              Change how it probes, or go back to the default at any time. <LearnMore doc="guides/interview-coach" />
            </>
          ),
          content: <InterviewerPromptForm saved={interviewPrompt} />,
        },
      ],
    },
    {
      title: "Voice and data",
      sections: [
        {
          id: "speech",
          title: "Voice",
          description: (
            <>
              For answering mock interviews out loud: your microphone, how speech becomes text (built-in or the optional Whisper download), and the
              interviewer&apos;s voice. The same settings open from Voice settings in any interview. <LearnMore doc="guides/voice" />
            </>
          ),
          content: <VoicePanel showBrowserNote={false} />,
        },
        {
          id: "data",
          title: "Your data",
          description: (
            <>
              {aiInBrowser &&
                "Your data lives in this browser. To move to another browser or computer, download a backup here and import it there. API keys aren't included, so enter them again; a downloaded Whisper model isn't either. "}
              <LearnMore doc="privacy-and-data" />
            </>
          ),
          content: (
            <>
              <p className="flex gap-2.5">
                <Database className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                {dataNote}
              </p>
              <p className="flex gap-2.5">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                {keyNote}
              </p>
              <BackupControls browserStorage={aiInBrowser} />
            </>
          ),
          contentClassName: "flex flex-col gap-3 text-[13px] text-muted",
        },
      ],
    },
  ];

  const shown = groups.map((g) => ({ title: g.title, sections: g.sections.filter((s): s is Section => Boolean(s)) }));
  const nav: SettingsNavGroup[] = shown.map((g) => ({ title: g.title, items: g.sections.map((s) => ({ id: s.id, label: s.nav ?? s.title })) }));

  return (
    <div className="xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:gap-8">
      <SettingsNav groups={nav} />
      <div className="flex min-w-0 flex-col gap-8">
        {shown.map((group) => (
          <section key={group.title} aria-labelledby={groupId(group.title)} className="flex flex-col gap-4">
            <h2 id={groupId(group.title)} className="text-xs font-semibold tracking-wide text-subtle uppercase">
              {group.title}
            </h2>
            {group.sections.map((s) => (
              // Clears the sticky menu (phones and tablets) or the page top (wide screens) when jumped to.
              <Card key={s.id} id={s.id} className="scroll-mt-28 lg:scroll-mt-16 xl:scroll-mt-6">
                <CardHeader>
                  <CardTitle>{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent className={s.contentClassName}>{s.content}</CardContent>
              </Card>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
