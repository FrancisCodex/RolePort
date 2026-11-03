"use client";

import { Check, ExternalLink, Loader2, LogOut, PlugZap, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { USAGE_SETTINGS_URL } from "@/lib/ai/responses-stream";
import { fetchChatGptModels, saveChatGptModel, signOutChatGpt, startChatGptSignIn, testChatGpt } from "@/lib/client/mutations";
import { cn } from "@/lib/utils";

export type ChatGptView = {
  signedIn: boolean;
  email: string | null;
  /** The user allowed RolePort to use their plan (the chatgpt.tokens.use.direct scope). */
  planEnabled: boolean;
  /** Why the last sign-in or renewal didn't work. */
  problem: string | null;
};

const HELP_URL = "https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites";

type Status = { tone: "success" | "error" | "info"; text: string } | null;

/**
 * "Use your ChatGPT plan" in Settings → AI provider (lib/chatgpt): sign in, pick one of the
 * account's models, test it, sign out. Wording and button follow OpenAI's Sign in with ChatGPT
 * guidelines.
 */
export function ChatGptSignIn({ view, active, savedModel }: { view: ChatGptView; active: boolean; savedModel: string | null }) {
  const [models, setModels] = useState<{ slug: string; label: string }[]>([]);
  const [model, setModel] = useState(savedModel ?? "");
  const [status, setStatus] = useState<Status>(null);
  const [welcome, setWelcome] = useState(false);
  const [busy, setBusy] = useState<"signin" | "models" | "save" | "test" | "signout" | null>(null);
  const [pending, start] = useTransition();
  const ready = view.signedIn && view.planEnabled;

  function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    setStatus(null);
    start(async () => {
      await task();
      setBusy(null);
    });
  }

  function showModels(result: Awaited<ReturnType<typeof fetchChatGptModels>>) {
    if (!result.ok) return setStatus({ tone: "error", text: result.error });
    setModels(result.data);
    setModel((m) => (m && result.data.some((x) => x.slug === m) ? m : (result.data[0]?.slug ?? "")));
  }

  const loadModels = () => run("models", async () => showModels(await fetchChatGptModels()));

  // What the sign-in came back with (app/api/chatgpt/callback), once, then off the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("chatgpt");
    if (!result) return;
    url.searchParams.delete("chatgpt");
    window.history.replaceState(null, "", url);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the address bar once after the redirect */
    if (result === "welcome") setWelcome(true);
    else if (result === "signed-in") setStatus({ tone: "success", text: "Signed in. AI features now use your ChatGPT plan." });
    else if (result === "denied") setStatus({ tone: "info", text: "Sign-in cancelled. Nothing was changed." });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // The account's models, once signed in.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetchChatGptModels().then((result) => live && showModels(result));
    return () => {
      live = false;
    };
  }, [ready]);

  function signIn(consent = false) {
    run("signin", async () => {
      const result = await startChatGptSignIn({ consent });
      if (!result.ok) return setStatus({ tone: "error", text: result.error });
      window.location.assign(result.data.url);
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <p className="text-[13px] leading-relaxed text-muted">
        Sign in with ChatGPT and RolePort&apos;s AI requests use your ChatGPT plan instead of an API key. You can see RolePort&apos;s usage and set a
        limit for it in ChatGPT&apos;s settings.{" "}
        <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline">
          Learn more <ExternalLink className="size-3" />
        </a>
      </p>

      {view.problem && !ready && <p className="rounded-md bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{view.problem}</p>}

      {!view.signedIn && (
        <div>
          <button
            type="button"
            data-oai-siwc-button=""
            onClick={() => signIn()}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {busy === "signin" && <Loader2 className="size-4 animate-spin" />}
            Continue with ChatGPT
          </button>
          <p className="mt-2 text-xs text-subtle">Opens OpenAI&apos;s sign-in, then brings you back here. Use a browser on the computer RolePort runs on.</p>
        </div>
      )}

      {view.signedIn && !view.planEnabled && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[13px]">
          <p>
            Signed in{view.email && <> as <span className="font-medium">{view.email}</span></>}, but using your ChatGPT plan wasn&apos;t allowed. Allow it,
            or use an API key or Ollama instead.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => signIn(true)} disabled={pending}>
              {busy === "signin" && <Loader2 className="animate-spin" />} Use your ChatGPT plan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run("signout", async () => void (await signOutChatGpt()))} disabled={pending}>
              Sign out
            </Button>
          </div>
        </div>
      )}

      {ready && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span>
              Signed in{view.email && <> as <span className="font-medium">{view.email}</span></>}
            </span>
            {active && (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="size-1.5 rounded-full bg-success" /> Using ChatGPT plan
              </span>
            )}
            <a href={USAGE_SETTINGS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline">
              Manage usage <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="chatgpt-model">Model</Label>
            <div className="flex gap-2">
              <Select
                id="chatgpt-model"
                value={model}
                placeholder={models.length === 0 && !status ? "Loading your models…" : "Choose a model"}
                options={models.map((m) => ({ value: m.slug, label: m.label }))}
                onValueChange={setModel}
              />
              <Button type="button" variant="secondary" size="icon" className="size-9 shrink-0" aria-label="Reload models" onClick={loadModels} disabled={pending}>
                {busy === "models" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            </div>
            <p className="text-xs text-subtle">The models your ChatGPT account offers.</p>
          </div>
        </>
      )}

      {status && (
        <p
          role="status"
          className={cn(
            "rounded-md px-3 py-2 text-[13px] font-medium",
            status.tone === "success" && "bg-success-soft text-success",
            status.tone === "error" && "bg-danger-soft text-danger",
            status.tone === "info" && "bg-brand-soft text-brand-ink",
          )}
        >
          {status.text}
        </p>
      )}

      {ready && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              run("save", async () => {
                const result = await saveChatGptModel({ model });
                setStatus(result.ok ? { tone: "success", text: "Saved. AI features now use your ChatGPT plan." } : { tone: "error", text: result.error });
              })
            }
            disabled={pending || !model}
          >
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />} Save
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              run("test", async () => {
                const result = await testChatGpt({ model });
                setStatus(
                  result.ok
                    ? { tone: "success", text: `It works (${(result.data.ms / 1000).toFixed(1)}s): “${result.data.reply}”` }
                    : { tone: "error", text: result.error },
                );
              })
            }
            disabled={pending || !model}
          >
            {busy === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              run("signout", async () => {
                const result = await signOutChatGpt();
                setStatus(
                  result.ok && result.data.confirmed
                    ? { tone: "info", text: "Signed out of ChatGPT. AI is off until you pick a provider." }
                    : {
                        tone: "info",
                        text: "Signed out here, but OpenAI couldn't be told. To be sure, disconnect RolePort in ChatGPT's settings.",
                      },
                );
              })
            }
            disabled={pending}
          >
            {busy === "signout" ? <Loader2 className="animate-spin" /> : <LogOut />} Sign out
          </Button>
        </div>
      )}

      <Dialog open={welcome} onClose={() => setWelcome(false)} labelledBy="chatgpt-welcome-title">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 id="chatgpt-welcome-title" className="text-[15px] font-semibold tracking-tight">
              You&apos;re using your ChatGPT plan
            </h2>
            <p className="text-[13px] leading-relaxed text-muted">
              Eligible usage in this app uses your ChatGPT plan. Manage usage in your ChatGPT settings. RolePort itself is free and charges nothing.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a
              href={USAGE_SETTINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-3 text-[13px] font-medium text-brand-ink hover:underline"
            >
              Manage usage <ExternalLink className="size-3" />
            </a>
            <Button onClick={() => setWelcome(false)}>Got it</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
