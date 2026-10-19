# HireMe

A free, open-source job search app you run yourself. Find jobs across the Philippines, see how well each one fits you, and track every application, with your CV and data staying on your own machine.

Bring your own AI: Claude, OpenAI, OpenRouter, Groq, or a free local model through [Ollama](https://ollama.com).
Inspired by [ai-job-search](https://github.com/MadsLorentzen/ai-job-search). See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and click **Get started**. There's no sign-in, and data is saved in `.data/` (delete that folder to start over).

Or with Docker:

```bash
docker compose up -d
```

## What you get

| Feature | Needs |
| --- | --- |
| Job search: about 28k Philippine jobs from [freehire](https://freehire.me), remote roles from [Jobicy](https://jobicy.com) | Nothing |
| Quick match score from your skills on every job | Nothing |
| Pipeline: save jobs, track Saved → Applied → Interview → Offer | Nothing |
| CV import with automatic skill detection | Nothing |
| AI fills in your whole profile from your CV | An AI provider |
| JobStreet, Indeed, LinkedIn and Kalibrr listings via [JSearch](https://rapidapi.com/letscrunch/api/jsearch) | A RapidAPI key (free tier) |
| Coming next: AI fit evaluation, tailored CV and cover letter, interview coach | An AI provider |

## Choosing an AI provider

Open **Settings** in the app, pick a provider, and click **Test connection**.

- **Ollama (free, private):** install Ollama, run `ollama pull gemma4:12b`, then choose Ollama in Settings. Use a 12B+ model for reliable results. Setting *Thinking* to *Off* makes answers much faster.
- **Claude, OpenAI, OpenRouter, Groq:** paste your own API key. You pay the provider directly. HireMe charges nothing.

Keys are encrypted before they're saved and never sent back to the browser.

## Hosting for others

Set `DATABASE_URL` (Postgres, Supabase or Neon) and run `npm run db:migrate`. Set `HIREME_LOCAL_MODE=false`, `BETTER_AUTH_SECRET` and a stable `HIREME_SECRET` to turn on accounts. See [.env.example](.env.example).

## Contributing

Job sources for other countries, provider improvements and UI polish are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Portions adapted from ai-job-search; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
