# JobSpy service

A small HTTP service that lets HireMe search LinkedIn, Indeed, Glassdoor, Bayt, Naukri, BDJobs, ZipRecruiter and HelloWork. It wraps [JobSpy](https://github.com/speedyapply/JobSpy) by Cullen Watson and contributors (MIT licence, see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)).

It's optional and runs on your own computer, for a self-hosted HireMe or for HireMe Lite in your browser. Setup and the reasons are in the main [README](../../README.md#jobspy-linkedin-indeed-and-more).

## Running it

| How | Command |
| --- | --- |
| With the whole app in Docker | `docker compose up -d` (from the repository root) |
| Next to `npm run dev`, with Docker | `npm run jobspy` |
| Next to `npm run dev`, with Python 3.10+ | `pip install -r requirements.txt`, then `python server.py` |

Then set `JOBSPY_URL=http://127.0.0.1:8765` for HireMe (Docker Compose sets it for you) and turn JobSpy on in **Settings**.

### For HireMe Lite

HireMe Lite calls the service from your browser, so start it with the site's address allowed:

| How | Command |
| --- | --- |
| Docker | `docker build -t hireme-jobspy https://github.com/FrancisCodex/HireMe.git#main:services/jobspy`, then `docker run -d --name hireme-jobspy -p 127.0.0.1:8765:8000 -e JOBSPY_ALLOWED_ORIGINS=https://<lite address> hireme-jobspy` |
| Python (PowerShell) | `$env:JOBSPY_ALLOWED_ORIGINS="https://<lite address>"; python server.py` |
| Python (macOS, Linux) | `JOBSPY_ALLOWED_ORIGINS=https://<lite address> python3 server.py` |

Settings in HireMe Lite shows these with the right address filled in.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `HOST` | `127.0.0.1` (`0.0.0.0` in Docker) | Address to listen on. Keep it on this computer. |
| `PORT` | `8765` (`8000` in Docker) | Port to listen on. |
| `JOBSPY_ALLOWED_ORIGINS` | none | Comma-separated sites whose pages may call the service from a browser, e.g. `https://lite.example,http://localhost:3100`. Browser requests from any other site get `403` before anything is searched. Server-to-server calls (self-hosted HireMe) don't need it. |

## API

| Request | Returns |
| --- | --- |
| `GET /health` | `{"ok": true}` |
| `GET /search?site=linkedin&term=nurse&location=Manila, Philippines&country_indeed=philippines&hours_old=72&is_remote=false&results=20` | `{"jobs": [...], "error": null}` |

- `site`: one of `linkedin`, `indeed`, `google`, `glassdoor`, `zip_recruiter`, `bayt`, `naukri`, `bdjobs`, `hellowork`. HireMe asks for one board per request, so each board reports its own result.
- `jobs`: JobSpy's job rows (title, company, location, salary, description as HTML, and so on).
- `error`: the board's error message when it failed, for example when it was rate-limited.
- `results` is capped at 25.

The service listens on `127.0.0.1:8765` by default. Don't expose it to the internet.

## Updating JobSpy

Change the version in `requirements.txt`, then rebuild with `npm run jobspy` (or `docker compose up -d --build`).
