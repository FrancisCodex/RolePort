---
title: Local models
description: Run RolePort's AI for free on your own computer, with nothing leaving your machine.
---

A local model costs nothing and keeps your CV on your computer. It's slower than a hosted provider and needs a reasonably capable machine.

## Set up Ollama

1. Install [Ollama](https://ollama.com/download).
2. Download a model:

```bash
ollama pull gemma4:12b
```

3. In **Settings → AI provider**, choose **Ollama**. Your downloaded models load on their own.
4. Pick the model, leave **Thinking** on **Off (fastest)**, then click **Test connection** and **Save**.

**In Docker,** RolePort can't see Ollama at `localhost`, so set the Base URL to:

```bash
http://host.docker.internal:11434/v1
```

## Using Ollama from RolePort Lite

Ollama only answers websites you allow, so allow the Lite address once. Settings shows these commands with your address filled in.

**Windows,** in PowerShell, then quit Ollama from the system tray and open it again:

```bash
setx OLLAMA_ORIGINS "https://your-lite-address"
```

**macOS,** in Terminal, then quit Ollama from the menu bar and open it again:

```bash
launchctl setenv OLLAMA_ORIGINS "https://your-lite-address"
```

**Linux,** run `sudo systemctl edit ollama.service`, add these lines and save, then run `sudo systemctl restart ollama`:

```bash
[Service]
Environment="OLLAMA_ORIGINS=https://your-lite-address"
```

If your browser asks to let the site access devices on your local network, choose **Allow**. Safari can't always reach Ollama, so use Chrome, Edge or Firefox.

## LM Studio and other servers

Choose **Custom** and enter the server's Base URL. LM Studio's default is `http://localhost:1234/v1`. An API key is optional. Any server that speaks the OpenAI chat format works.

## Choosing a model

- **Use a 12B or larger model** for reliable results, such as `gemma4:12b` or a Qwen 14B to 32B.
- **Smaller models** can misjudge the fit gates and struggle with long prompts.
- **Set Thinking to Off** on thinking models, which is about ten times faster. Turn it up for a job you care about.

## What works on small models

Every feature is built to work on a 12B model. RolePort keeps the AI's job small and checks the results in code:

- Overall scores are worked out by RolePort, not the model.
- Quotes from postings have to really appear in the posting.
- Pasted job fields have to appear word for word in the text.
- Facts on your CV are copied from your profile.
- Mock interviews send less context to local models.

## How long things take

A fit evaluation takes about 30 to 60 seconds on a 12B model with a mid-range GPU, and a few seconds on a hosted provider. Tailoring a CV or planning an interview can take a few minutes. The first request after starting can take a minute while the model loads. Keep the page open while it works.
