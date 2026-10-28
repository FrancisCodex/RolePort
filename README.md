# RolePort

A free, open-source job search app you run yourself. Find jobs in the Philippines or abroad, see how well each one fits you, tailor your CV and cover letter for each one, track every application, and practise for the interview with an AI mock interviewer, with your CV and data staying on your own machine.

Bring your own AI: Claude, OpenAI, OpenRouter, Groq, or a free local model through [Ollama](https://ollama.com).
Don't want to install anything? [RolePort Lite](#roleport-lite-in-your-browser) runs the same app in your browser.
Inspired by [ai-job-search](https://github.com/MadsLorentzen/ai-job-search). See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Quick start

There are two ways to run RolePort. Both keep your data on your computer and need no sign-in.

| | Option A: Docker | Option B: Node.js |
| --- | --- | --- |
| Best for | Using RolePort | Working on RolePort's code |
| You need | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | [Node.js](https://nodejs.org) 20.9+ (22 recommended), plus Docker or [Python](https://www.python.org) 3.10+ if you want JobSpy |
| JobSpy (LinkedIn, Indeed…) | Included | One extra command |

### Option A: Docker (everything included)

```bash
git clone https://github.com/FrancisCodex/RolePort.git
cd RolePort
docker compose up -d --build
```

The first build takes a few minutes. Then:

1. Open http://localhost:3000 and click **Get started**.
2. In **Profile**, set the country you live in and any countries you'd move to.
3. Optional: in **Settings**, pick an AI provider, and turn on **LinkedIn, Indeed and more via JobSpy** ([read this first](#jobspy-linkedin-indeed-and-more)).

Your data lives in the `roleport-data` Docker volume. Useful commands:

| What | Command |
| --- | --- |
| Stop | `docker compose stop` |
| Start again | `docker compose up -d` |
| Update to the latest version | `git pull`, then `docker compose up -d --build` |
| See logs | `docker compose logs -f` |
| Start over (deletes your data) | `docker compose down -v` |

### Option B: Node.js (for development)

```bash
git clone https://github.com/FrancisCodex/RolePort.git
cd RolePort
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

## RolePort Lite (in your browser)

RolePort Lite is the same app as a website: nothing to install, no account. Everything you add (profile, CV text, saved jobs, evaluations, settings and API keys) is stored in your browser, on your device. RolePort's server only relays job searches and keeps nothing. [docs/LITE.md](docs/LITE.md) explains how it works and its Privacy page (`/privacy`) says exactly what goes where.

| | Self-hosted | Lite |
| --- | --- | --- |
| Install | Docker or Node.js | None |
| Where your data lives | A database on your computer | Your browser, on that device |
| AI | From your server | From your browser, with your own key or Ollama |
| JobSpy (LinkedIn, Indeed…) | Included with Docker | Runs on your computer, the browser connects to it |
| Several devices | Any browser that reaches your install | One browser; move with a backup file |

Using Lite:

- **AI with Ollama:** Ollama only answers sites you allow. Settings shows the command for your system (`OLLAMA_ORIGINS=<the Lite address>`, then restart Ollama). Hosted providers (Claude, OpenAI, OpenRouter, Groq) work with just your key.
- **JobSpy:** start the service with `JOBSPY_ALLOWED_ORIGINS` set to the Lite address ([details](#in-roleport-lite)).
- **Keep a backup:** clearing the site's data in your browser deletes everything. **Settings → Your data → Download backup** makes one file that also imports into a self-hosted install. Installing Lite as an app (the install icon in Chrome's address bar, or Add to Home Screen on iPhone) makes the browser less likely to clear it.
- **Browsers:** Chrome, Edge and Firefox. Safari can't always reach Ollama on your computer.

Run Lite yourself with `npm run dev:lite` (port 3100), or build it with `npm run build:lite` and `npm run start:lite`. Hosting it is covered [below](#hosting-roleport-lite).

## What you get

| Feature | Needs |
| --- | --- |
| Job search in your country or abroad: jobs from [freehire](https://freehire.me), remote roles from [Jobicy](https://jobicy.com). Set where you live and which countries you'd move to in your profile. The same opening posted on several boards shows once, with links to the others, and results come 20 to a page | Nothing |
| Quick match score from your skills on every job | Nothing |
| Applied jobs: **Apply** opens a page for that job with the saved posting, its status history and your notes, and your application kit: the tailored CV to download and the cover letter to copy, each made in one click (or both with **Prepare all with AI**) | Nothing (AI for the one-click drafts) |
| Pipeline: save jobs, track Saved → Applied → Interview → Offer | Nothing |
| ATS-friendly CV as a PDF for any saved or applied job: built from your profile, editable, and checked by reading its text back out | Nothing |
| Dashboard: applications sent, response rate, interviews and offers, how far applications get, weekly pace, follow-ups due | Nothing |
| Setup guide (`/welcome`): name, roles and CV in a few steps, then pointers to AI, JobSpy and more. New users start there in RolePort Lite; set `NEXT_PUBLIC_ROLEPORT_ONBOARDING=on` to do the same on a self-hosted install | Nothing |
| CV import with automatic skill detection, plus your email, phone and profile links | Nothing |
| AI fills in your whole profile from your CV | An AI provider |
| AI fit evaluation: eligibility, language and location gates, four scored dimensions, strengths, gaps and a recommendation. Evaluate one job or the top 10 results | An AI provider |
| JobStreet, Indeed, LinkedIn and Kalibrr listings via [JSearch](https://rapidapi.com/letscrunch/api/jsearch) | A RapidAPI key (free tier) |
| LinkedIn, Indeed, Glassdoor, Bayt, Naukri and more via [JobSpy](https://github.com/speedyapply/JobSpy) | The JobSpy service, on a self-hosted install ([details](#jobspy-linkedin-indeed-and-more)) |
| CV tailoring: rewrites your headline, summary, skills and bullets for one posting from your own facts, flags anything it can't back up, and lists what the posting asks for that you don't show. The prompt is in Settings to read and change | An AI provider |
| Cover letters: drafted from your profile for one posting, checked for numbers it can't back up, placeholders and clichés, then copied into a form or downloaded as a PDF. The prompt is in Settings to read and change | An AI provider (or write it yourself) |
| Application questions: paste a question from an application form and get an answer from your profile and CV, with the facts it leans on and what to check. Answers can be edited and copied, and the prompt is in Settings to read and change | An AI provider (or write them yourself) |
| Prompts you can read: Settings shows the full CV tailoring, cover letter and application question prompts to change or reset, and each page shows exactly what's sent to your AI | An AI provider |
| Interview Coach: mock interviews for a job you applied to (its posting plus the CV, letter and answers you sent) or for any role. A briefing first (what the role needs, your story bank, where you might be pressed, questions to ask), then one question at a time with follow-ups on vague answers. Pick the focus (recruiter screen, behavioral, role-specific or a job posting), quick (3 questions) or full (6), an interviewer style (Friendly, Standard, Tough or "from Hell") and optionally a two-person panel | An AI provider |
| Interview reports: rubric scores per answer, a summary and a practice verdict, consistency flags when what you said doesn't match what you sent (each quoting both sides, checked in code), a stronger version of each answer, and a cheat sheet to rehearse from. Redo any question and compare the score, track progress across interviews and drill your weakest topics, and add your interview date for a countdown. The interviewer prompt is in Settings to read and change | An AI provider |
| Answer out loud: built-in browser speech-to-text by default, or an optional on-device Whisper download that works in every browser ([details](#answering-out-loud)). Questions can be read aloud, and the report shows your pace and filler words | Nothing (Chrome, Edge or Safari for built-in speech) |
| Coming next: follow-ups, skill-gap insights | An AI provider |

## Choosing an AI provider

Open **Settings** in the app, pick a provider, and click **Test connection**.

- **Ollama (free, private):** install Ollama, run `ollama pull gemma4:12b`, then choose Ollama in Settings. Use a 12B+ model for reliable results. Setting *Thinking* to *Off* makes answers much faster. A fit evaluation takes about 30-60 seconds on a 12B model with a mid-range GPU, and a few seconds on Claude or OpenAI. In Docker, use `http://host.docker.internal:11434/v1` as the Ollama address.
- **Claude, OpenAI, OpenRouter, Groq:** paste your own API key. You pay the provider directly. RolePort charges nothing.

Keys are encrypted before they're saved and never sent back to the browser.

## Answering out loud

The Interview Coach lets you answer by speaking. **Settings → Voice** (or **Voice settings** in any interview) picks and tests the microphone, chooses the interviewer's voice, and sets how speech becomes text:

- **Built-in browser speech (the default):** nothing to download. Works in Chrome, Edge and Safari, but not in Brave, Firefox or most in-app browsers. Chrome and Edge send the audio to Google or Microsoft to transcribe it.
- **Whisper on this device (optional):** a one-time download that works in every modern browser and keeps your voice on your computer. The text appears when you stop speaking, not while you talk.

| Model | Download | Notes |
| --- | --- | --- |
| Tiny | about 44 MB | Fastest; fine for clear speech in a quiet room |
| Base | about 80 MB | Recommended |
| Small | about 252 MB | Most accurate; slower on older computers |

Before anything downloads, RolePort lists every file, its size and where it comes from (the model from huggingface.co, the 27 MB speech runtime from RolePort itself). Nothing downloads until you press **Download**. The model is kept in that browser's storage for the site, in both the self-hosted and Lite versions: not in `.data/` and not in backups. Each browser or device downloads its own copy, and clearing the site's data removes it. Remove a model any time in **Settings → Voice**.

Moving to a browser where built-in speech works? Download a backup in **Settings → Your data** and import it there.

## JobSpy: LinkedIn, Indeed and more

[JobSpy](https://github.com/speedyapply/JobSpy) is an open-source library by Cullen Watson and contributors that reads public job pages from LinkedIn, Indeed, Glassdoor, Google Jobs and regional boards. RolePort runs it as a small separate service (`services/jobspy`) and picks the boards that cover the country you search:

| Board | Countries |
| --- | --- |
| LinkedIn | All |
| Indeed | 60+ countries, including the Philippines |
| Glassdoor | 23 countries, including the Philippines, Singapore, Australia, the UK and the US |
| Bayt | UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Egypt, Morocco |
| Naukri | India |
| BDJobs | Bangladesh |
| ZipRecruiter | US and Canada |
| HelloWork | France |
| Google Jobs | All (JobSpy's Google scraper currently returns nothing) |

It needs no key, but these sites' terms don't allow automated access, so RolePort treats it as a personal tool:

- It runs on your own computer and stays off until you turn it on in **Settings**. A self-hosted install calls it from its server; RolePort Lite calls it from your browser ([below](#in-roleport-lite)).
- Results are cached for a few hours, so repeating a search doesn't hit the boards again. The first search takes 30-60 seconds.
- Boards change often and may rate-limit you. When one fails, the others still return results.
- Don't turn it on for a server that hosts RolePort for other people.

### In RolePort Lite

RolePort Lite runs in your browser, so the browser talks to JobSpy on your computer directly. JobSpy only answers the sites you list in `JOBSPY_ALLOWED_ORIGINS`. **Settings → Job sources → LinkedIn, Indeed and more via JobSpy** shows the exact commands with the right address. With Docker:

```bash
docker build -t roleport-jobspy https://github.com/FrancisCodex/RolePort.git#main:services/jobspy
```

```bash
docker run -d --name roleport-jobspy -p 127.0.0.1:8765:8000 -e JOBSPY_ALLOWED_ORIGINS=https://<lite address> roleport-jobspy
```

Then click **Test** in Settings and turn it on. Results go from JobSpy straight to your browser; RolePort's server never sees them.

### Troubleshooting

| You see | What to do |
| --- | --- |
| Lite: "JobSpy is running but doesn't allow this site" | Restart JobSpy with `JOBSPY_ALLOWED_ORIGINS` set to the address in your browser's address bar (no trailing slash). |
| Lite: "Couldn't reach JobSpy" | Start it (see above) and check the address in Settings. If the browser asked to let the site access devices on your local network, allow it. |
| Settings has no JobSpy section | Option B: set `JOBSPY_URL` in `.env.local`, then restart `npm run dev`. |
| "The JobSpy service isn't responding" | Start it: `npm run jobspy` (Option B) or `docker compose up -d` (Option A). Check `npm run jobspy:logs`. |
| A board shows **unavailable** in search results | The board blocked or rate-limited you, or changed its pages. Wait a while and try again; the other sources still work. |
| Google Jobs is always **unavailable** | Known: JobSpy's Google scraper is broken at the moment. |
| `port is already allocated` from Docker | Something else uses port 3000 or 8765, such as `npm run dev`. Stop it, or change the left-hand port in `docker-compose.yml`. |

## Hosting RolePort Lite

Lite is a static site plus one stateless route (`POST /api/lite/search`), so any host that runs Next.js route handlers works (Vercel, Netlify, Cloudflare). There's no database and nothing to configure for users.

- **Build:** use `npm run build:lite` as the build command. It sets `NEXT_PUBLIC_ROLEPORT_MODE=lite` and builds the starter database into `public/pglite/` first. Also set `NEXT_PUBLIC_ROLEPORT_MODE=lite` in the host's environment, so anything that runs `next` directly builds Lite too. The output goes to `.next-lite` (the `distDir` in `next.config.ts`), except on Vercel, where it stays in `.next`; on other hosts, set the output directory to `.next-lite`. On Vercel, `vercel.json` already sets the build command.
- **Optional:** `FREEHIRE_API_URL` for a different freehire instance. Don't set any AI keys or `RAPIDAPI_KEY`: users bring their own. On a self-hosted install, `NEXT_PUBLIC_ROLEPORT_LITE_URL` adds a "Try it in your browser" link to its landing page.
- **Security headers:** production Lite builds send a Content Security Policy (`lib/security-headers.ts`) that only lets the page talk to RolePort, the supported AI providers and `localhost`. To support another hosted AI provider, add it there.
- **Rate limiting:** the search route allows about 20 searches a minute per address, keyed on `X-Forwarded-For`. Each server instance counts on its own, so keep the host's own rate limiting or firewall on as well.
- **Caching:** `/_next/static/*` and the PGlite files are content-hashed and can be cached for a year. `/pglite/seed.tar.gz` keeps its name between builds, so leave it on revalidation. Serving with Brotli cuts the first visit's download noticeably (the PGlite runtime and the starter database are about 10 MB gzipped together).
- **Logs:** turn off request-body logging if your host offers it. The route itself logs nothing about users.
- **On-device Whisper:** the build copies ONNX Runtime's WebAssembly files (about 41 MB) into `public/ort/` (`scripts/copy-ort.mjs`), so your deployment serves them rather than a CDN. The security headers allow huggingface.co and its `*.hf.co` storage hosts for the model files, which users download only if they choose to, and allow the microphone for the site itself.

## Hosting for others

RolePort has no accounts: every install belongs to one person. To give other people a hosted version, deploy RolePort Lite ([above](#hosting-roleport-lite)), where each visitor's data stays in their own browser.

## Roadmap: a desktop app

Next on the roadmap is wrapping RolePort in a desktop app built with [Tauri](https://tauri.app) or [Electron](https://www.electronjs.org): one installer for Windows, macOS and Linux, with no Docker, Node.js or Python to set up.

- **Everything included:** the app and JobSpy are packaged together, with JobSpy as a bundled helper program, so LinkedIn, Indeed and the other boards work without starting a separate service.
- **Local by default:** your data stays in a database on your computer, as in the self-hosted version. Optional downloads such as Whisper can ship with the app, so answering out loud works offline.
- **The web versions stay:** the self-hosted install and RolePort Lite in the browser remain for anyone who doesn't want to install anything, and backups move between all three.
- **Tauri or Electron:** Tauri is much smaller but doesn't run Node.js, so it would package the Lite build (data in the app's own browser storage) with JobSpy alongside. Electron is larger but can run the full self-hosted server inside the app. The choice is still open.

To keep that possible, new features run in the browser where they can (the Interview Coach's voice features do) and avoid depending on outside CDNs.

## Contributing

Job sources for other countries, provider improvements and UI polish are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

RolePort builds on the work of others:

- [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) by Mads Lorentzen (MIT): the workflow, job keys and the fit evaluation framework.
- [JobSpy](https://github.com/speedyapply/JobSpy) by Cullen Watson and contributors (MIT): the LinkedIn, Indeed, Glassdoor, Bayt, Naukri, BDJobs, ZipRecruiter and HelloWork scrapers behind the JobSpy service.
- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face (Apache-2.0), [ONNX Runtime](https://github.com/microsoft/onnxruntime) by Microsoft (MIT) and OpenAI's [Whisper](https://github.com/openai/whisper) (MIT): the optional on-device speech-to-text.
- Job data from [freehire](https://freehire.me), [Jobicy](https://jobicy.com) and [JSearch](https://rapidapi.com/letscrunch/api/jsearch). Every job links back to its original posting.

## License

[MIT](LICENSE). Third-party licences are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
