import { Database, Lock } from "lucide-react";
import { VoicePanel } from "@/components/speech/voice-settings";
import { CompanyManager } from "@/components/companies/company-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsForm, type AiSettingsView } from "./ai-settings-form";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { BackupControls } from "./backup-controls";
import { JobSourceForm, JobSpyToggle } from "./job-source-form";
import { LocalJobSpy } from "./local-jobspy";
import { AnswerPromptForm, CvPromptForm, InterviewerPromptForm, LetterPromptForm } from "./prompt-form";

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
  /** The user's own CV tailoring instructions, or null for the default. */
  cvPrompt: string | null;
  /** The user's own cover letter instructions, or null for the default. */
  coverLetterPrompt: string | null;
  answerPrompt: string | null;
  /** The user's own mock interviewer instructions, or null for the default. */
  interviewPrompt: string | null;
  /** Where the user's data and keys are kept, for the "Your data" card. */
  dataNote: string;
  keyNote: string;
};

/** The Settings cards, shared by the server page and the lite edition. */
export function SettingsView({
  ai,
  aiInBrowser,
  rapidApiKeyHint,
  companies,
  countries,
  jobSpy,
  localJobSpy,
  cvPrompt,
  coverLetterPrompt,
  answerPrompt,
  interviewPrompt,
  dataNote,
  keyNote,
}: SettingsData) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            Used to read your CV, evaluate fit and tailor applications. Use your own API key, or run a model locally with Ollama for free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsForm initial={ai} aiInBrowser={aiInBrowser} />
        </CardContent>
      </Card>

      <Card id="cv-prompt">
        <CardHeader>
          <CardTitle>CV tailoring prompt</CardTitle>
          <CardDescription>
            Exactly what RolePort asks the AI when it tailors your CV to a job. Read it, change it to suit how you like your CV written, or
            go back to the default at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CvPromptForm saved={cvPrompt} />
        </CardContent>
      </Card>

      <Card id="letter-prompt">
        <CardHeader>
          <CardTitle>Cover letter prompt</CardTitle>
          <CardDescription>
            Exactly what RolePort asks the AI when it writes a cover letter. Change the tone, length or structure to suit you, or go back to
            the default at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LetterPromptForm saved={coverLetterPrompt} />
        </CardContent>
      </Card>

      <Card id="answer-prompt">
        <CardHeader>
          <CardTitle>Application questions prompt</CardTitle>
          <CardDescription>
            Exactly what RolePort asks the AI when it answers a question from an application form. Change the tone, length or approach to
            suit you, or go back to the default at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnswerPromptForm saved={answerPrompt} />
        </CardContent>
      </Card>

      <Card id="interviewer-prompt">
        <CardHeader>
          <CardTitle>Mock interviewer prompt</CardTitle>
          <CardDescription>
            What the Interview Coach&apos;s interviewer is told after each of your answers: when to press with a follow-up and when to move on.
            Change how it probes, or go back to the default at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InterviewerPromptForm saved={interviewPrompt} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job sources</CardTitle>
          <CardDescription>
            freehire, the remote-job feeds (Jobicy, Remotive, Himalayas, Remote OK) and official boards like Platsbanken (Sweden) work
            without a key and are searched whenever they cover your search. Add JSearch to include Google for Jobs listings from
            JobStreet, Indeed, LinkedIn and Kalibrr.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <JobSourceForm rapidApiKeyHint={rapidApiKeyHint} />
          {jobSpy && <JobSpyToggle enabled={jobSpy.enabled} reachable={jobSpy.reachable} />}
          {localJobSpy && <LocalJobSpy enabled={localJobSpy.enabled} />}
        </CardContent>
      </Card>

      <Card id="companies">
        <CardHeader>
          <CardTitle>Companies you follow</CardTitle>
          <CardDescription>
            Know a company you&apos;d love to work for? Follow it, and every job search also checks that company&apos;s own list of openings,
            in any country. You can also do this from the Jobs page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyManager companies={companies} countries={countries} />
        </CardContent>
      </Card>

      <Card id="speech">
        <CardHeader>
          <CardTitle>Voice</CardTitle>
          <CardDescription>
            For answering mock interviews out loud: your microphone, how speech becomes text (built-in or the optional Whisper download), and the
            interviewer&apos;s voice. The same settings open from Voice settings in any interview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoicePanel showBrowserNote={false} />
        </CardContent>
      </Card>

      <Card id="data">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          {aiInBrowser && (
            <CardDescription>
              Your data lives in this browser. To move to another browser or computer, download a backup here and import it there. API keys
              aren&apos;t included, so enter them again; a downloaded Whisper model isn&apos;t either.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-[13px] text-muted">
          <p className="flex gap-2.5">
            <Database className="mt-0.5 size-3.5 shrink-0 text-subtle" />
            {dataNote}
          </p>
          <p className="flex gap-2.5">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-subtle" />
            {keyNote}
          </p>
          <BackupControls browserStorage={aiInBrowser} />
        </CardContent>
      </Card>
    </div>
  );
}
