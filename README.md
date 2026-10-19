# HireMe

Find jobs across the Philippines, see how well each one fits you, and track every application, in one calm app.
Inspired by [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (MIT). See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Run it on your machine

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and click **Get started**. With `HIREME_LOCAL_MODE=true` (the default in `.env.example`) there is no sign-in: everything belongs to one built-in user.

Data is stored in an embedded database at `.data/pglite`, created and migrated automatically. Delete that folder to start over.

## What works without any keys

- **Profile**: import a PDF or .txt CV (skills are detected automatically), then fill in roles, location, salary, experience and goals.
- **Job search**: live listings from [freehire](https://freehire.me) (about 28k Philippine jobs, filterable by city) and remote roles from [Jobicy](https://jobicy.com).
- **Quick match**: every job gets a score based on how your skills overlap with its requirements.
- **Pipeline**: save jobs and move them through Saved → Applied → Interview → Offer.

## Optional keys (add to `.env.local`, then restart)

| Key | Unlocks |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI fills in your whole profile from your CV. Next: full fit evaluation, tailored CV and cover letter. |
| `RAPIDAPI_KEY` | [JSearch](https://rapidapi.com/letscrunch/api/jsearch): Google for Jobs listings (JobStreet, Indeed, LinkedIn, Kalibrr). |

## Using a Postgres server instead

Set `DATABASE_URL` in `.env.local` (local Postgres, Supabase or Neon), then run `npm run db:migrate`.
To turn on accounts, set `HIREME_LOCAL_MODE=false` and fill in `BETTER_AUTH_SECRET` (`npx @better-auth/cli secret`).
