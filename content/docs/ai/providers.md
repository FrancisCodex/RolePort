---
title: AI providers
description: Choose where RolePort's AI runs. Use your own key with a hosted provider, or a free local model.
updated: 2026-11-03
---

RolePort works with any provider you choose, and charges nothing for it. AI is optional. Without it, job search, quick match, the pipeline, PDFs and reminders still work.

## Set up a provider

1. Go to **Settings → AI provider** and pick a provider.
2. Paste your API key, using the **Get a key** link if you need one. Ollama and most local servers need no key.
3. Choose a model. Click the refresh button to load the provider's list, or type a model name.
4. Click **Test connection**, then **Save**.

**Turn off AI** removes the saved key and switches AI features off.

## Which provider?

| Provider | Good for | What you need |
| --- | --- | --- |
| Claude | The best quality. The default model is `claude-opus-5-5` | An [Anthropic API key](https://console.anthropic.com/settings/keys) |
| ChatGPT | A ChatGPT plan and no API key. Self-hosted only | A ChatGPT plan (see below) |
| OpenAI | A familiar choice | An [OpenAI API key](https://platform.openai.com/api-keys) |
| OpenRouter | One key for hundreds of models | An [OpenRouter key](https://openrouter.ai/keys) |
| Groq | Fast hosted open models | A [Groq key](https://console.groq.com/keys) |
| Ollama | Free and private, on your computer | [Ollama](https://ollama.com/download) and a downloaded model |
| Custom | LM Studio, vLLM or any OpenAI-compatible server | The server's address |

See [Local models](/docs/ai/local-models) for Ollama and LM Studio.

## Use your ChatGPT plan

If you pay for ChatGPT but have no API key, RolePort can use your plan instead. It's an OpenAI preview, open to open-source apps you run yourself, so it's on self-hosted installs only, not Lite.

1. Open RolePort in a browser on the computer it runs on (for example `http://localhost:3000`). OpenAI sends you back to `127.0.0.1` on that computer after signing in, so a phone or another PC can't finish it.
2. Go to **Settings → AI provider**, pick **ChatGPT** and click **Continue with ChatGPT**.
3. Sign in on OpenAI's page and allow RolePort to use your plan. You come back to Settings.
4. Pick one of the models your account offers, click **Test connection**, then **Save**.

Every AI feature then uses your plan: evaluations, tailored CVs, cover letters, emails, CV import, pasted jobs and the Interview Coach. RolePort itself still charges nothing.

**Usage.** RolePort's requests count against your plan. See them, and set a limit for RolePort, in [ChatGPT's usage settings](https://chatgpt.com/settings/usage). When the limit is used up, RolePort says so instead of failing, and works again once ChatGPT allows it.

**Signing out.** **Sign out** in Settings tells OpenAI to end the sign-in and turns AI off. You can also disconnect RolePort in ChatGPT's settings; RolePort notices the next time it uses AI and asks you to sign in again.

**Where your sign-in goes.** Like API keys, the sign-in is encrypted before it's saved on your server and never sent to the browser. Backups don't include it.

**On a remote server (a VPS).** The sign-in has to finish on the computer RolePort runs on, so it doesn't work yet when RolePort runs somewhere else. Use an API key there, or [connect an AI agent](/docs/ai/agents).

## Advanced options

### Base URL

Everything except Claude uses the OpenAI chat format, so RolePort shows a **Base URL**, which is the server's address. The presets fill it in. Change it to use a proxy or another compatible server. It must start with `http://` or `https://`.

### Model

Any model name your provider accepts works. Pick one that handles structured answers well, since RolePort asks for replies in a fixed format.

### Thinking

For models that think before answering, **Thinking** sets how much they do.

| Option | Use it when |
| --- | --- |
| Provider default | You're not sure |
| Off (fastest) | You're on a local thinking model, where it's often much faster |
| Low or Medium | You want more care and can wait |
| High (slowest, most careful) | Quality matters more than time |

## Where your key goes

- **Self-hosted:** keys are encrypted before they're saved and never sent back to the browser. Requests go from your server to the provider.
- **Lite:** your key stays in your browser, and requests go straight from your browser to the provider. RolePort's server isn't involved.

Backups never include keys. Your profile, CV text and the job description go to the provider you choose, and its privacy terms apply. A local model keeps them on your computer.

## Other providers in Lite

Hosted Lite only lets the page talk to RolePort, the listed AI providers and your own computer. Claude, OpenAI, OpenRouter, Groq and local servers work. Other hosted providers need a self-hosted install.
