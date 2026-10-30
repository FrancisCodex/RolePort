---
title: AI providers
description: Choose where RolePort's AI runs. Use your own key with a hosted provider, or a free local model.
updated: 2026-10-31
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
| OpenAI | A familiar choice | An [OpenAI API key](https://platform.openai.com/api-keys) |
| OpenRouter | One key for hundreds of models | An [OpenRouter key](https://openrouter.ai/keys) |
| Groq | Fast hosted open models | A [Groq key](https://console.groq.com/keys) |
| Ollama | Free and private, on your computer | [Ollama](https://ollama.com/download) and a downloaded model |
| Custom | LM Studio, vLLM or any OpenAI-compatible server | The server's address |

See [Local models](/docs/ai/local-models) for Ollama and LM Studio.

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
