---
title: Customizing the prompts
description: Read and change exactly what RolePort asks the AI, so it writes the way you want.
---

Nothing RolePort asks the AI is hidden. Six prompts can be read and changed in Settings, and the CV, email and other pages show exactly what's sent to your AI.

## The prompts you can change

| Prompt | Controls | Common changes |
| --- | --- | --- |
| CV reading prompt | How your CV becomes your profile | Have AI write your summary, look for a section of your own |
| CV tailoring prompt | How your CV is tailored to a job | Number of bullets, tone, how many keywords |
| Cover letter prompt | How letters are written | Length, tone, structure |
| Application questions prompt | How form questions are answered | Length, tone, approach |
| Email prompt | Each kind of email | Tone and length per kind |
| Mock interviewer prompt | When the interviewer presses or moves on | How hard it probes |

The fit evaluation's rules aren't editable, so that scores stay comparable.

## How to change one

1. Go to **Settings** and find the prompt. The CV reading prompt is on **Profile** too.
2. Edit the **Instructions**. A badge shows **Default prompt** or **Your prompt**.
3. Click **Save prompt**. The next run uses it.
4. **Reset to default** goes back at any time.

Each prompt can be up to 8,000 characters. If you save the default text unchanged, RolePort stores nothing, so you keep getting future improvements to the default. Once you save your own text, it stays until you reset it.

## Quick changes to the CV reading prompt

You don't need to write the rule yourself:

- **Have AI write my summary** makes the AI write 2 or 3 sentences about you, instead of copying the CV's own.
- **Ask for a section**, such as "Open source", then **Add to prompt**.

Save the prompt, then read your CV again to see the result.

## Rules that can't be changed

Under each prompt, **Rules RolePort always adds** shows what's added after your instructions. They stop postings and CVs from giving the AI instructions, and let RolePort read the answer. RolePort also keeps a few things out of the AI's hands:

- **CV:** employers, titles, dates, education and contact details are copied from your profile.
- **Cover letter:** your name, contact details, the date and the employer's address are added by RolePort.
- **Email:** the subject line, sign-off and contact details are added by RolePort.
- **Interviewer:** the style you pick is added between your instructions and the rules, and RolePort caps the follow-ups.

Whatever your prompt says, RolePort still flags numbers it can't find in your profile or CV, and leftover placeholders.

## Tips

- **Change one thing at a time,** and test it on a real job.
- **Keep the truth rules.** The defaults tell the AI never to invent facts. Removing those makes warnings more likely and could put false claims in your application.
- **Be specific.** "Keep each bullet under 15 words" works better than "make it shorter".
- **Write in the posting's language.** The defaults already do this. Change it if you always want one language.
- **On small models,** keep prompts short and clear.

## Example

To make cover letters shorter, find this line in the cover letter prompt:

```text
- paragraphs: 3 or 4 short paragraphs, 250-350 words in total.
```

Change it to:

```text
- paragraphs: 2 or 3 short paragraphs, 150-200 words in total.
```
