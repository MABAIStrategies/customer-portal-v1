---
name: journal
description: At each natural break in the work (after a milestone, a merged PR, or a meaningful chunk of progress), append a short, plain-language, customer-facing entry to docs/JOURNAL.md describing what got done, what it means for the business owner, and the ROI (hours saved and/or dollars). Use when the user says "journal", "update the journal", or "log progress for the customer", or when wrapping a milestone worth reporting upward.
---

# Skill: Journal

A lightweight, **customer-facing** progress journal. It is meant to be run **briefly at each
natural break** in the iteration — after a milestone, a merged PR, or a meaningful chunk of
work — by a low-tier, mid-thinking model. It appends one short, dated, plain-language entry
to `docs/JOURNAL.md` (create the file if it doesn't exist).

This journal will ultimately be surfaced in the **customer portal** as a live window into
production status, and later alongside invoice costs. So it must stay **readable, honest, and
non-technical** — written for a busy business owner, not an engineer.

## Audience & voice

The reader is a **non-technical business owner**. Write the way you'd update a client over
coffee:

- Plain language. No jargon, no file names, no function names, no framework names.
- Frame everything around **what it means for their business**.
- Lean into **ROI**: estimated hours saved and/or dollars, and "here's how to capitalize on
  this / scale into the next step."

## Scope rule: this skill writes ONLY to docs/JOURNAL.md

The only write this skill performs is appending an entry to `docs/JOURNAL.md`. Do **not**
change code, tests, or any other file. Do **not** rewrite or delete prior entries — append
only.

## Step 0 — Ground yourself in what actually shipped

Don't invent progress. Confirm what truly got done since the last entry:

- `git log --oneline -10` and `git diff --stat` to see what actually changed / merged.
- Read the last entry in `docs/JOURNAL.md` (if present) so you don't repeat it and you
  continue the story.
- Translate the real change into business terms — only claim what genuinely happened.

## The entry — short, dated, ROI-leaning

Append a new dated entry. Keep it to **4–8 sentences max**. Cover, in plain language:

```
### YYYY-MM-DD — <plain-language headline>

<What just got done, in business terms.> <What it means for you / your customers.>
<ROI: estimated hours saved per week/month and/or dollars.> <How to capitalize on it or
the natural next step to scale.>
```

- Lead toward ROI (hours + money) and toward the next step the owner can capitalize on.
- Be honest: if a number is an estimate, say "roughly" — never overstate.

## Hard safety rules (encode these every time)
- **Terse:** 4–8 sentences. This is a glance-able status note, not a report.
- **Non-technical:** no code, file names, stack details, or internal jargon.
- **Never expose secrets, credentials, or raw PII** (no owner names, addresses, account
  numbers, keys). It will be shown in the customer portal.
- **Honest:** claim only what actually shipped (grounded in Step 0); estimates labeled as
  estimates.
- **Append-only:** add a dated entry; never edit or remove earlier ones.
