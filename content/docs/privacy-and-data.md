---
title: Privacy and your data
description: Where your data lives in each edition, what leaves your device, and how to back it up or delete it.
updated: 2026-10-31
---

RolePort has no accounts, no analytics and no ads. The [Privacy page](/privacy) says exactly what goes where. This page is the short version.

## Where your data lives

- **Lite:** in your browser, on your device. RolePort's server never receives your profile, CV, saved jobs, settings or keys.
- **Self-hosted:** in a database on your computer. With Docker, that's the `roleport-data` volume. With Node.js, it's the `.data` folder, or your own Postgres server. Keys are encrypted. Nothing is sent to the RolePort project.

## What leaves your device

| What | Where it goes |
| --- | --- |
| Your profile, CV text and postings, when you use AI | The AI provider you chose, or your own computer with a local model |
| Job search terms and filters | Self-hosted: the job sources. Lite: RolePort's server, which asks the sources and stores nothing |
| Companies you follow | Lite: sent with each search to read their job feeds, and not stored |
| Links you paste | Lite: RolePort's server reads the page, and doesn't store it |
| Your JSearch key | Lite: sent with a search for that one request, never stored or logged |
| Your voice | Stays on your device with Whisper. With built-in speech, Chrome and Edge send it to Google or Microsoft |

In Lite, your IP address is used in memory to limit searches per minute, and the hosting provider may keep its standard access logs.

## Backups

**Settings → Your data → Download backup** makes one file with your profile, CV text, pipeline, evaluations, interviews and followed companies. It works in both editions. API keys and Whisper models are never included, so enter your keys again after restoring.

To restore, import the file in the same card and choose:

- **Add to what's here:** keeps your current data. Where both have the same job, the newer version wins.
- **Replace what's here:** deletes your current profile, pipeline and evaluations first. Settings and API keys stay.

## Protecting Lite data

Browsers can clear site data when a device runs low on space. **Your data** shows whether yours is protected. Installing RolePort as an app usually helps, and Safari may clear data after about 7 days without a visit unless the site is on your home screen. A backup is the only sure protection.

## Deleting your data

- **Lite:** clear this site's data in your browser. Download a backup first if you might want it.
- **Self-hosted with Docker:** `docker compose down -v` deletes everything.
- **Self-hosted with Node.js:** delete the `.data` folder.
- **Your AI key:** **Settings → AI provider → Turn off AI** removes it.
