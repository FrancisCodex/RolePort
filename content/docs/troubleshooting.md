---
title: Troubleshooting
description: What to do when something doesn't work.
updated: 2026-10-31
---

## AI

| You see | What to do |
| --- | --- |
| "AI is off" | Choose a provider in **Settings → AI provider** and click **Save** |
| Test connection fails on a hosted provider | Check the key, that your account has credit, and that the model name exists on that provider |
| No models found | Run `ollama pull gemma4:12b`, then click the refresh button beside **Model** |
| Ollama can't be reached in Docker | Set the Base URL to `http://host.docker.internal:11434/v1` |
| Ollama can't be reached in Lite | Allow the site with `OLLAMA_ORIGINS` and restart Ollama. See [Local models](/docs/ai/local-models#using-ollama-from-roleport-lite) |
| Safari can't reach Ollama | Use Chrome, Edge or Firefox, or the self-hosted install |
| Local AI is very slow | Set **Thinking** to **Off (fastest)**. The first request also loads the model, which can take a minute |
| Odd or failed results on a local model | Use a 12B or larger model |

## CV import

| You see | What to do |
| --- | --- |
| Few or no details found | Set up AI to read the whole CV, or fill in the profile by hand |
| Nothing is read from a PDF | It may be a scanned picture. Import a `.txt` version |
| The file is refused | Use a PDF or `.txt` file up to 5 MB |

## Job search

| You see | What to do |
| --- | --- |
| Few results | Try a broader title, widen **Date posted**, or see [Getting more results](/docs/guides/jobs#getting-more-results) |
| A source shows as unavailable | It's down or rate-limiting you. The others still work, so try again later |
| A pasted link won't read | Paste the posting's text. See [What can't be read](/docs/guides/paste-a-job#what-cant-be-read) |
| A careers page won't follow | See [If a link doesn't work](/docs/job-sources/hiring-systems#if-a-link-doesnt-work) |

## JobSpy

| You see | What to do |
| --- | --- |
| Lite: "JobSpy is running but doesn't allow this site" | Restart JobSpy with `JOBSPY_ALLOWED_ORIGINS` set to the address in your browser's address bar, with no trailing slash |
| Lite: "Couldn't reach JobSpy" | Start it, and check the address in Settings. If the browser asks to access devices on your local network, allow it |
| Settings has no JobSpy section | With Node.js, set `JOBSPY_URL` in `.env.local`, then restart `npm run dev` |
| "The JobSpy service isn't responding" | Start it with `npm run jobspy` or `docker compose up -d`, and check `npm run jobspy:logs` |
| A board shows as unavailable | It blocked or rate-limited you, or changed its pages. Wait and try again |
| Google Jobs is always unavailable | A known problem: JobSpy's Google scraper is broken at the moment |
| `port is already allocated` from Docker | Something else uses port 3000 or 8765. Stop it, or change the left-hand port in `docker-compose.yml` |

## Voice

| You see | What to do |
| --- | --- |
| Speech doesn't work | Built-in speech needs Chrome, Edge or Safari. Elsewhere, download [Whisper](/docs/guides/voice#whisper-on-this-device) |
| The microphone isn't heard | Allow it in your browser, then test it in **Settings → Voice** |

## Your data

| You see | What to do |
| --- | --- |
| My Lite data is gone | The browser's data was cleared. Restore a [backup](/docs/privacy-and-data#backups) |
| My API key is gone after a restore | Backups never include keys, so enter it again |
| Saved keys stopped working | `ROLEPORT_SECRET` may have changed. Set it back, or enter your keys again |

## Still stuck?

[Open an issue on GitHub](https://github.com/FrancisCodex/RolePort/issues) with what you did and what you saw. Leave out your API keys and personal details.
