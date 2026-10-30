---
title: Contributing
description: Add a job source, a starter list or a fix. Job sources for other countries are especially welcome.
---

RolePort is open source, and you don't need to be a developer to help. If a page here is wrong, use **Edit this page on GitHub** at the bottom of it.

## Run RolePort locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

No keys or database server are needed. `npm run dev:lite` runs the Lite edition on port 3100.

Before opening a pull request, run:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

[CONTRIBUTING.md](https://github.com/FrancisCodex/RolePort/blob/main/CONTRIBUTING.md) has the project layout and ground rules.

## Add a job source

Know a board that publishes its jobs openly? Not a coder? [Propose it](https://github.com/FrancisCodex/RolePort/issues/new?template=job-source.yml) and someone can build it.

To build it yourself, a source is one file in `lib/jobs/sources/`, one test against a saved sample response, and one line in `registry.ts`. It also needs a docs page here. [Adding a job source](https://github.com/FrancisCodex/RolePort/blob/main/docs/ADDING_A_JOB_SOURCE.md) has the source policy and a checklist. In short, core sources use official APIs, open data or pages the site allows to be read automatically, identify as RolePort, and never work around a refusal.

## Add a starter list

The **Popular employers** lists are one JSON file per country in `lib/companies/starters/`:

```json
[{ "name": "Example Labs", "ats": "greenhouse", "slug": "examplelabs" }]
```

Only add companies whose public job feed answers and that have open jobs in that country now. A new country is a new file plus one line in `lib/companies/starters.ts`.

## Improve these docs

Each page is one Markdown file in `content/docs`, and the sidebar is `lib/docs/nav.ts`. Fix the docs in the same pull request as the code they describe. `npm test` fails if a page is missing, a link inside the docs is broken, or a job source has no page.
