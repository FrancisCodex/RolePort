import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * "See exactly what's sent": the instructions and the profile-and-posting message of an AI run,
 * word for word, with a link to edit the instructions in Settings.
 */
export function PromptDetails({ prompt, settingsAnchor }: { prompt: { system: string; user: string; custom: boolean }; settingsAnchor: string }) {
  return (
    <details className="rounded-lg border border-border bg-surface-2 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-medium text-muted select-none hover:text-fg">
        See exactly what&apos;s sent
        <Badge tone={prompt.custom ? "brand" : "neutral"} className="ml-auto">
          {prompt.custom ? "Your prompt" : "Default prompt"}
        </Badge>
      </summary>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <p className="text-muted">
          Sent only to the AI provider you chose. The second part is your profile and the posting, built fresh each time.{" "}
          <Link href={`/settings#${settingsAnchor}`} className="font-medium text-brand-ink hover:underline">
            Edit the prompt
          </Link>
        </p>
        <p className="font-medium">Instructions</p>
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface p-2 leading-relaxed whitespace-pre-wrap">{prompt.system}</pre>
        <p className="font-medium">Your profile and the posting</p>
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface p-2 leading-relaxed whitespace-pre-wrap">{prompt.user}</pre>
      </div>
    </details>
  );
}
