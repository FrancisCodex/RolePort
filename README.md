# HireMe

A free, open-source job search app you run yourself. Find jobs in the Philippines or abroad, see how well each one fits you, and track every application, with your CV and data staying on your own machine.

Bring your own AI: Claude, OpenAI, OpenRouter, Groq, or a free local model through [Ollama](https://ollama.com).
Inspired by [ai-job-search](https://github.com/MadsLorentzen/ai-job-search). See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Quick start

There are two ways to run HireMe. Both keep your data on your computer and need no sign-in.

| | Option A: Docker | Option B: Node.js |
| --- | --- | --- |
| Best for | Using HireMe | Working on HireMe's code |
| You need | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | [Node.js](https://nodejs.org) 20.9+ (22 recommended), plus Docker or [Python](https://www.python.org) 3.10+ if you want JobSpy |
| JobSpy (LinkedIn, Indeed…) | Included | One extra command |

### Option A: Docker (everything included)

```bash
git clone https://github.com/FrancisCodex/HireMe.git
cd HireMe
docker compose up -d --build
```

The first build takes a few minutes. Then:

1. Open http://localhost:3000 and click **Get started**.
2. In **Profile**, set the country you live in and any countries you'd move to.
3. Optional: in **Settings**, pick an AI provider, and turn on **LinkedIn, Indeed and more via JobSpy** ([read this first](#jobspy-linkedin-indeed-and-more)).

Your data lives in the `hireme-data` Docker volume. Useful commands:

| What | Command |
| --- | --- |
| Stop | `docker compose stop` |
| Start again | `docker compose up -d` |
| Update to the latest version | `git pull`, then `docker compose up -d --build` |
| See logs | `docker compose logs -f` |
| Start over (deletes your data) | `docker compose down -v` |

### Option B: Node.js (for development)

```bash
git clone https://github.com/FrancisCodex/HireMe.git
cd HireMe
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and click **Get started**. Data is saved in `.data/` (delete that folder to start over). The database updates itself when the app starts.

To add JobSpy:

1. Start the JobSpy service. With Docker Desktop running:

   ```bash
   npm run jobspy
   ```

   It listens on `127.0.0.1:8765`, which only your computer can reach. No Docker? Use Python instead:

   ```bash
   pip install -r services/jobspy/requirements.txt
   python services/jobspy/server.py
   ```

2. In `.env.local`, uncomment `JOBSPY_URL=http://127.0.0.1:8765`. The dev server picks it up on its own; restart it if Settings doesn't show JobSpy.
3. In **Settings → Job sources**, turn on **LinkedIn, Indeed and more via JobSpy**.

`npm run jobspy:logs` shows what the service is doing, and `npm run jobspy:stop` stops it. After restarting your computer, start Docker Desktop and run `npm run jobspy` again.

## What you get

| Feature | Needs |
| --- | --- |
| Job search in your country or abroad: jobs from [freehire](https://freehire.me), remote roles from [Jobicy](https://jobicy.com). Set where you live and which countries you'd move to in your profile | Nothing |
| Quick match score from your skills on every job | Nothing |
| Pipeline: save jobs, track Saved → Applied → Interview → Offer | Nothing |
| CV import with automatic skill detection | Nothing |
| AI fills in your whole profile from your CV | An AI provider |
| AI fit evaluation: eligibility, language and location gates, four scored dimensions, strengths, gaps and a recommendation. Evaluate one job or the top 10 results | An AI provider |
| JobStreet, Indeed, LinkedIn and Kalibrr listings via [JSearch](https://rapidapi.com/letscrunch/api/jsearch) | A RapidAPI key (free tier) |
| LinkedIn, Indeed, Glassdoor, Bayt, Naukri and more via [JobSpy](https://github.com/speedyapply/JobSpy) | The JobSpy service, on a self-hosted install ([details](#jobspy-linkedin-indeed-and-more)) |
| Coming next: tailored CV and cover letter, follow-ups, interview coach | An AI provider |

## Choosing an AI provider

Open **Settings** in the app, pick a provider, and click **Test connection**.

- **Ollama (free, private):** install Ollama, run `ollama pull gemma4:12b`, then choose Ollama in Settings. Use a 12B+ model for reliable results. Setting *Thinking* to *Off* makes answers much faster. A fit evaluation takes about 30-60 seconds on a 12B model with a mid-range GPU, and a few seconds on Claude or OpenAI. In Docker, use `http://host.docker.internal:11434/v1` as the Ollama address.
- **Claude, OpenAI, OpenRouter, Groq:** paste your own API key. You pay the provider directly. HireMe charges nothing.

Keys are encrypted before they're saved and never sent back to the browser.

## JobSpy: LinkedIn, Indeed and more

[JobSpy](https://github.com/speedyapply/JobSpy) is an open-source library by Cullen Watson and contributors that reads public job pages from LinkedIn, Indeed, Glassdoor, Google Jobs and regional boards. HireMe runs it as a small separate service (`services/jobspy`) and picks the boards that cover the country you search:

| Board | Countries |
| --- | --- |
| LinkedIn | All |
| Indeed | 60+ countries, including the Philippines |
| Glassdoor | 22 countries, including Singapore, Australia, the UK and the US |
| Bayt | UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Egypt, Morocco |
| Naukri | India |
| BDJobs | Bangladesh |
| ZipRecruiter | US and Canada |
| HelloWork | France |
| Google Jobs | All (JobSpy's Google scraper currently returns nothing) |

It needs no key, but these sites' terms don't allow automated access, so HireMe treats it as a personal tool:

- It only works on a self-hosted install (`HIREME_LOCAL_MODE=true`), runs from your own network, and stays off until you turn it on in **Settings**.
- Results are cached for a few hours, so repeating a search doesn't hit the boards again. The first search takes 30-60 seconds.
- Boards change often and may rate-limit you. When one fails, the others still return results.
- Don't turn it on for a server that hosts HireMe for other people.

### Troubleshooting

| You see | What to do |
| --- | --- |
| Settings has no JobSpy section | Option B: set `JOBSPY_URL` in `.env.local` and check `HIREME_LOCAL_MODE=true`, then restart `npm run dev`. |
| "The JobSpy service isn't responding" | Start it: `npm run jobspy` (Option B) or `docker compose up -d` (Option A). Check `npm run jobspy:logs`. |
| A board shows **unavailable** in search results | The board blocked or rate-limited you, or changed its pages. Wait a while and try again; the other sources still work. |
| Google Jobs is always **unavailable** | Known: JobSpy's Google scraper is broken at the moment. |
| `port is already allocated` from Docker | Something else uses port 3000 or 8765, such as `npm run dev`. Stop it, or change the left-hand port in `docker-compose.yml`. |

## Hosting for others

Set `DATABASE_URL` (Postgres, Supabase or Neon) and run `npm run db:migrate`. Set `HIREME_LOCAL_MODE=false`, `BETTER_AUTH_SECRET` and a stable `HIREME_SECRET` to turn on accounts. See [.env.example](.env.example). JobSpy is switched off in this mode.

## Contributing

Job sources for other countries, provider improvements and UI polish are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

HireMe builds on the work of others:

- [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) by Mads Lorentzen (MIT): the workflow, job keys and the fit evaluation framework.
- [JobSpy](https://github.com/speedyapply/JobSpy) by Cullen Watson and contributors (MIT): the LinkedIn, Indeed, Glassdoor, Bayt, Naukri, BDJobs, ZipRecruiter and HelloWork scrapers behind the JobSpy service.
- Job data from [freehire](https://freehire.me), [Jobicy](https://jobicy.com) and [JSearch](https://rapidapi.com/letscrunch/api/jsearch). Every job links back to its original posting.

## License

[MIT](LICENSE). Third-party licences are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
