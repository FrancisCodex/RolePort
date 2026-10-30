---
title: Which edition should I use?
description: RolePort Lite and the self-hosted install are the same app. They differ in where your data lives and where requests come from.
updated: 2026-10-31
---

**Choose Lite** to try RolePort now, or if you'd rather not install anything. **Choose self-hosted** if you want LinkedIn and Indeed included with no extra setup, want to reach RolePort from several devices, or want to work on the code.

You can switch at any time: a [backup file](/docs/privacy-and-data#backups) from one edition imports into the other.

## Side by side

| | RolePort Lite | Self-hosted |
| --- | --- | --- |
| Install | None | Docker or Node.js |
| Where your data lives | Your browser, on that device | A database on your computer |
| API keys | Stored in your browser | Encrypted before saving |
| AI requests | From your browser to your provider | From your server to your provider |
| Job searches | Through RolePort's server, which stores nothing | From your server |
| JobSpy (LinkedIn, Indeed and more) | Runs on your computer, your browser connects to it | Included with Docker |
| Several devices | One browser, move with a backup file | Any browser that can reach your install |
| Setup guide on first visit | Yes | Off unless you turn it on |

## Using Lite well

- **Keep a backup.** Clearing the site's data in your browser deletes everything. Use **Settings → Your data → Download backup** now and then. RolePort reminds you when your last backup is getting old.
- **Install it as an app.** The install icon in Chrome's address bar, or Add to Home Screen on an iPhone, makes the browser less likely to clear your data.
- **Use Chrome, Edge or Firefox.** Safari can't always reach Ollama on your computer.

## Hosting for other people

RolePort has no accounts, so every self-hosted install belongs to one person. To offer it to others, host RolePort Lite, where each visitor's data stays in their own browser. The [README](https://github.com/FrancisCodex/RolePort#hosting-roleport-lite) covers how.
