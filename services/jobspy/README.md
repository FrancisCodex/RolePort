# JobSpy service

A small HTTP service that lets HireMe search LinkedIn, Indeed, Glassdoor, Bayt, Naukri, BDJobs, ZipRecruiter and HelloWork. It wraps [JobSpy](https://github.com/speedyapply/JobSpy) by Cullen Watson and contributors (MIT licence, see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)).

It's optional and meant for a self-hosted HireMe only. Setup and the reasons are in the main [README](../../README.md#jobspy-linkedin-indeed-and-more).

## Running it

| How | Command |
| --- | --- |
| With the whole app in Docker | `docker compose up -d` (from the repository root) |
| Next to `npm run dev`, with Docker | `npm run jobspy` |
| Next to `npm run dev`, with Python 3.10+ | `pip install -r requirements.txt`, then `python server.py` |

Then set `JOBSPY_URL=http://127.0.0.1:8765` for HireMe (Docker Compose sets it for you) and turn JobSpy on in **Settings**.

## API

| Request | Returns |
| --- | --- |
| `GET /health` | `{"ok": true}` |
| `GET /search?site=linkedin&term=nurse&location=Manila, Philippines&country_indeed=philippines&hours_old=72&is_remote=false&results=20` | `{"jobs": [...], "error": null}` |

- `site`: one of `linkedin`, `indeed`, `google`, `glassdoor`, `zip_recruiter`, `bayt`, `naukri`, `bdjobs`, `hellowork`. HireMe asks for one board per request, so each board reports its own result.
- `jobs`: JobSpy's job rows (title, company, location, salary, description as HTML, and so on).
- `error`: the board's error message when it failed, for example when it was rate-limited.
- `results` is capped at 25.

The service listens on `127.0.0.1:8765` by default (`HOST` and `PORT` change this). Don't expose it to the internet.

## Updating JobSpy

Change the version in `requirements.txt`, then rebuild with `npm run jobspy` (or `docker compose up -d --build`).
