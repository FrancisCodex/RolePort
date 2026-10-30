---
title: JobSpy (LinkedIn, Indeed and more)
description: An optional service on your own computer that reads public job pages from LinkedIn, Indeed, Glassdoor and regional boards.
updated: 2026-10-31
sources: linkedin, indeed, google, glassdoor, bayt, naukri, bdjobs, zip_recruiter, hellowork
---

[JobSpy](https://github.com/speedyapply/JobSpy) is an open-source library by Cullen Watson and contributors. RolePort runs it as a small separate service and picks the boards that cover the country you search.

> **Read this first.** JobSpy needs no key, but these sites' terms don't allow automated access, so RolePort treats it as a personal tool. It stays off until you turn it on. Don't turn it on for a server that hosts RolePort for other people.

## Boards and countries

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
| Google Jobs | All, though JobSpy's Google scraper currently returns nothing |

## Set it up

### Self-hosted with Docker

`docker compose up` already runs JobSpy. Go to **Settings → Job sources** and turn on **LinkedIn, Indeed and more via JobSpy**.

### Self-hosted with Node.js

1. With Docker Desktop running, start the service:

```bash
npm run jobspy
```

2. In `.env.local`, uncomment `JOBSPY_URL=http://127.0.0.1:8765`, and restart `npm run dev` if Settings doesn't show JobSpy.
3. Turn it on in **Settings → Job sources**.

No Docker? Use Python 3.10 or newer instead:

```bash
pip install -r services/jobspy/requirements.txt
python services/jobspy/server.py
```

`npm run jobspy:logs` shows what the service is doing, and `npm run jobspy:stop` stops it.

### RolePort Lite

Your browser talks to JobSpy on your computer directly, and JobSpy only answers the sites you list. **Settings → Job sources → LinkedIn, Indeed and more via JobSpy** shows the exact commands with your address filled in. With Docker:

```bash
docker build -t roleport-jobspy https://github.com/FrancisCodex/RolePort.git#main:services/jobspy
```

```bash
docker run -d --name roleport-jobspy -p 127.0.0.1:8765:8000 -e JOBSPY_ALLOWED_ORIGINS=https://your-lite-address roleport-jobspy
```

Then click **Test** in Settings and turn it on. Results go from JobSpy straight to your browser, and RolePort's server never sees them.

## Limits

- The first search takes 30 to 60 seconds. Results are cached for a few hours.
- Boards change often and may rate-limit you. When one fails, the others still return results.

For error messages, see [Troubleshooting](/docs/troubleshooting#jobspy).
