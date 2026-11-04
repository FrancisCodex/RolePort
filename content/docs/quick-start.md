---
title: Quick start
description: From nothing to your first evaluated job in a few minutes, in RolePort Lite, the desktop app or on your own computer.
updated: 2026-11-04
---

## Start RolePort

### RolePort Lite

Open the RolePort Lite website and click **Open RolePort**. There's nothing to install and no account. The setup guide starts on its own.

### Desktop app (Windows)

Download **RolePort-Setup-x64.exe** from the RolePort website (**Download for Windows**) and run it. Windows may say "Windows protected your PC" because the app isn't code signed yet: click **More info → Run anyway**. RolePort opens when it's installed, with the setup guide.

- **LinkedIn, Indeed and more:** the setup guide offers JobSpy, a free 39 MB download that adds LinkedIn, Indeed, Google Jobs, Glassdoor and regional boards to your searches. Skip it and add it later in **Settings → Job sources**.
- **Answering out loud:** mock interviews read questions in your computer's own voices. To answer by speaking, download Whisper in the guide or **Settings → Voice**; it turns your speech into text on your computer, offline. Without it, you type your answers.
- **Updates:** RolePort checks for new versions on its own and downloads them in the background. When one is ready it asks you to restart. Choose **Later** and it installs the next time you close RolePort. You never need to download it again.
- **Uninstall:** Windows **Settings → Apps → Installed apps → RolePort → Uninstall**. Your jobs, CVs and settings stay in `%APPDATA%\RolePort`, so reinstalling picks up where you left off. To remove them too, delete that folder after uninstalling.

### Self-hosted with Docker

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/). In a terminal:

```bash
git clone https://github.com/FrancisCodex/RolePort.git
cd RolePort
docker compose up -d --build
```

The first build takes a few minutes. Then open `http://localhost:3000` and click **Open RolePort**.

### Self-hosted with Node.js

This is the route for working on RolePort's code. You need [Node.js](https://nodejs.org) 20.9 or newer (22 recommended).

```bash
git clone https://github.com/FrancisCodex/RolePort.git
cd RolePort
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Your data is saved in the `.data` folder.

## Set yourself up

1. **Run the setup guide.** Lite starts on it. On a self-hosted install, open it from Home, or go to `/welcome`. It takes about two minutes and asks for your name, country, the roles you want and your CV. You can skip anything.
2. **Add an AI provider (optional).** Go to **Settings → AI provider**, pick a provider, paste your key or choose your local model, then click **Test connection** and **Save**. See [AI providers](/docs/ai/providers).
3. **Import your CV.** On **Profile**, drop in a PDF or `.txt` file up to 5 MB. With AI, your whole profile fills in. Without it, RolePort picks out your skills, email, phone and links. Check the result and press **Save**.
4. **Set your countries.** On **Profile**, set the country you live in, any other countries you'd work in, and where you can already work without a visa.

## Run your first search

1. Open **Jobs**. Your first role and country are filled in.
2. Search, then sort by **Best match** or **Newest**, and pick a date range or work setup.
3. Open a job to read it and see its quick match score.

## Evaluate a job

With an AI provider set up, click **Evaluate fit** on a job, or choose several jobs from the list and analyze up to 10 at once. You get pass or fail gates, four scores, your strengths and gaps, and a recommendation. See [Match scores and AI evaluations](/docs/guides/match-scores).

## Apply

Click **Apply** on a job you like. It opens the job's page under **Applied**, where you can tailor your CV, write your cover letter, answer form questions and draft emails. When your application is ready, **Continue to job posting** takes you to the employer's site, and you send it yourself. See [Applications](/docs/guides/applications).
