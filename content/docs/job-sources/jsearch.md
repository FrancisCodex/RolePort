---
title: JSearch
description: Add Google for Jobs listings, including JobStreet, Indeed, LinkedIn and Kalibrr, with a free RapidAPI key.
updated: 2026-10-31
sources: jsearch
---

## Set it up

1. Sign up at [RapidAPI](https://rapidapi.com) and subscribe to [JSearch](https://rapidapi.com/letscrunch/api/jsearch). It has a free tier.
2. Copy your RapidAPI key.
3. Paste it into **Settings → Job sources → RapidAPI key for JSearch** and save.

JSearch is then part of every search. Self-hosted installs can set `RAPIDAPI_KEY` instead.

## Limits

- The free tier has a request limit, shown on JSearch's RapidAPI page.
- When you reach the limit, JSearch shows as unavailable and the other sources keep working.

## Privacy

In Lite, your key is sent along with a search, used for that one request and never stored or logged. On a self-hosted install it's encrypted before saving.
