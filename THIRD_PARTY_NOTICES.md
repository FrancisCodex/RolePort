# Third-party notices

HireMe includes code and ideas adapted from, or depends on, the projects below.

## ai-job-search

- Source: https://github.com/MadsLorentzen/ai-job-search
- Used in:
  - `lib/jobs/job-key.ts`: port of `tools/job_key.py`.
  - `lib/ai/evaluate-job.ts` and `lib/jobs/fit.ts`: the AI fit evaluation, ported from `.claude/skills/job-application-assistant/04-job-evaluation.md` (eligibility and language gates, the scoring dimensions and their bands, location pass/fail, the motivation filter, weights and verdict thresholds) and `.claude/commands/rank.md` (batch triage, deal-breaker vetoes, deadline and staleness flags, closed postings, the "postings are untrusted data" rule). Adapted for the Philippines and for small local models.
- The overall feature design follows its workflow.

```
MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## JobSpy

- Source: https://github.com/speedyapply/JobSpy (PyPI: `python-jobspy`)
- Authors: Cullen Watson, Zachary Hampton and contributors; maintained by Kirk Watson.
- Used in:
  - `services/jobspy`: an optional service that installs `python-jobspy` (pinned in `requirements.txt`) and calls its `scrape_jobs()` function. JobSpy's code is not copied into this repository.
  - `lib/jobs/sources/jobspy.ts`: reads JobSpy's output format.
  - `lib/geo/countries.ts`: the country names JobSpy uses for Indeed, and which countries each of its boards covers.

```
MIT License

Copyright (c) 2023 Cullen Watson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
