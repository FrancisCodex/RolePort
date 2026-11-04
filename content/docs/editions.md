---
title: Which edition should I use?
description: RolePort comes as a Windows desktop app, as RolePort Lite in your browser, or self-hosted. It's the same app in all three; they differ in setup, where your data lives and which extras come built in.
updated: 2026-11-04
---

RolePort works the same way in every edition: the same job search, fit scores, CV tailoring, tracker and Interview Coach. What changes is how you install it, where your data lives and how easy the extras are to switch on.

- **On Windows, choose the desktop app.** It's the easiest way to use RolePort: install it like any other program, with nothing to set up, and it updates itself.
- **To try RolePort first, or on a Mac or phone, choose Lite.** Nothing to install: it runs in your browser.
- **To run it on a Mac, Linux or a server, or to work on the code, choose self-hosted.**

You can switch at any time: a [backup file](/docs/privacy-and-data#backups) from one edition imports into any other.

## The desktop app (recommended on Windows)

- **Nothing to set up.** Download the installer from the RolePort website, run it, and the setup guide starts. No Docker, Node.js or Python.
- **Your data stays on your computer**, in a database in your user folder (`%APPDATA%\RolePort`), not in a browser that might clear it. API keys are encrypted before they're saved.
- **LinkedIn, Indeed and more with one click.** The setup guide offers JobSpy, a free 39 MB download that adds LinkedIn, Indeed, Google Jobs, Glassdoor and regional boards to every search. RolePort starts and stops it for you.
- **Updates itself.** New versions download in the background and install when you restart.
- **Answer interviews out loud, offline.** Questions are read in your computer's own voices, and Whisper turns your answers into text on your computer.

It's for Windows 10 and 11 only for now. Windows may warn "Windows protected your PC" the first time, because the app isn't code signed yet: click **More info → Run anyway**.

## RolePort Lite

- **Nothing to install.** Open the website and start. Works on any computer or phone with a modern browser.
- **Your data stays in your browser**, on that device. There's no account and RolePort's server stores nothing.
- **Good for trying RolePort** before you install it, or on a computer where you can't install programs.

The catch: your data lives in one browser. Clearing that site's data deletes it, so download a backup now and then (see below). LinkedIn and Indeed need JobSpy running on your computer separately, which takes some technical setup.

## Self-hosted

- **Runs anywhere Docker or Node.js runs:** macOS, Linux, Windows or a server.
- **Reach it from several devices**, on any browser that can reach your install.
- **JobSpy is included with Docker**, so LinkedIn and Indeed work with no extra step.
- **Work on the code** or change anything you like. It's open source.

It takes a few minutes in a terminal to set up, and you update it yourself by pulling the new version.

## Side by side

| | Desktop app | RolePort Lite | Self-hosted |
| --- | --- | --- | --- |
| Install | Windows installer, nothing else | None, it's a website | Docker or Node.js |
| Runs on | Windows 10 and 11 | Any modern browser | macOS, Linux, Windows, servers |
| Where your data lives | A database on your computer | Your browser, on that device | A database on your computer or server |
| API keys | Encrypted before saving | Stored in your browser | Encrypted before saving |
| AI requests | From your computer to your provider | From your browser to your provider | From your server to your provider |
| Job searches | From your computer | Through RolePort's server, which stores nothing | From your server |
| LinkedIn, Indeed and more (JobSpy) | One-click download in the app | Run JobSpy on your computer yourself | Included with Docker |
| Updates | Automatic | Always the latest | You pull and rebuild |
| Answering out loud | Whisper, on your computer | Built-in browser speech or Whisper | Built-in browser speech or Whisper |
| Several devices | One computer, move with a backup file | One browser, move with a backup file | Any browser that can reach your install |
| Setup guide on first visit | Yes | Yes | Off unless you turn it on |

## Using Lite well

- **Keep a backup.** Clearing the site's data in your browser deletes everything. Use **Settings → Your data → Download backup** now and then. RolePort reminds you when your last backup is getting old.
- **Install it as an app.** The install icon in Chrome's address bar, or Add to Home Screen on an iPhone, makes the browser less likely to clear your data.
- **Use Chrome, Edge or Firefox.** Safari can't always reach Ollama on your computer.

## Hosting for other people

RolePort has no accounts, so every desktop or self-hosted install belongs to one person. To offer it to others, host RolePort Lite, where each visitor's data stays in their own browser. The [README](https://github.com/FrancisCodex/RolePort#hosting-roleport-lite) covers how.
