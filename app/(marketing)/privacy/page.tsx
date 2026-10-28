import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { REPO_URL } from "@/components/marketing/setup-guide";
import { isLite } from "@/lib/mode";

export const metadata: Metadata = { title: "Privacy" };

const UPDATED = "24 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-muted [&_strong]:text-fg">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-xs text-subtle">Privacy</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl">Your data stays with you</h1>
      <p className="mt-4 text-base text-muted text-pretty">
        RolePort has no accounts, no analytics and no ads. This page says exactly what goes where. Last updated {UPDATED}.
      </p>

      <Section title={isLite ? "On this site (RolePort Lite)" : "In RolePort Lite"}>
        <p>
          <strong>Your data is stored in your browser, on your device.</strong> Your profile, CV text, saved jobs, pipeline,
          evaluations, settings and API keys are kept in this browser&apos;s own storage. RolePort&apos;s server never receives them.
          Clearing this site&apos;s data in your browser deletes them, so download a backup from Settings now and then.
        </p>
        <p>
          <strong>Job searches go through RolePort&apos;s server.</strong> Most job sites don&apos;t accept requests from other websites, so
          your search terms and filters (job title, country, location, work setup, date range) go to RolePort&apos;s server. It asks
          freehire, Jobicy and, if you added a key, JSearch, and sends the jobs back. It stores nothing. Your IP address is used, in
          memory only, to limit how many searches can be made per minute, and the hosting provider may keep its standard access
          logs.
        </p>
        <p>
          <strong>Your JSearch key is sent along with a search when you add one,</strong> used for that single request to RapidAPI,
          and never stored or logged.
        </p>
        <p>
          <strong>AI requests go straight from your browser to the provider you choose.</strong> When you import a CV or evaluate a
          job, your profile, CV text and the job description go to that provider with your own key, or to Ollama on your own
          computer. RolePort&apos;s server is not involved. The provider&apos;s own privacy terms apply.
        </p>
        <p>
          <strong>JobSpy runs on your computer.</strong> If you connect it, your browser asks it for LinkedIn, Indeed and other
          boards&apos; results directly. Those searches come from your own internet connection.
        </p>
      </Section>

      <Section title="In a self-hosted install">
        <p>
          Everything is stored in a database on the computer or server you run RolePort on. Job searches and AI requests go from that
          server to the job sources and the AI provider you choose. API keys are encrypted before they&apos;re saved. Nothing is sent to
          the RolePort project.
        </p>
      </Section>

      <Section title="Moving between them">
        <p>
          A backup from <strong>Settings → Your data</strong> is one file you keep. It works in both RolePort Lite and a self-hosted
          install, and never includes API keys.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          RolePort is open source, so you can check all of this in the code. Ask or report anything on{" "}
          <a href={`${REPO_URL}/issues`} className="font-medium text-brand-ink hover:underline">
            GitHub
          </a>
          .
        </p>
        <p>
          <Link href="/" className="font-medium text-brand-ink hover:underline">
            Back to RolePort
          </Link>
        </p>
      </Section>
    </article>
  );
}
