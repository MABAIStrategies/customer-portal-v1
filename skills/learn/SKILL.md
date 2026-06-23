---
name: learn
description: After a work session or milestone, capture durable engineering learnings — what was tried, what worked, what failed and why, surprises/constraints discovered, and recommendations for next time — into a dated entry in docs/LEARNINGS.md. Use when the user says "learn", asks to "capture learnings", wants a "retro", or wraps up a chunk of work worth remembering.
---

# Skill: Learn

A short retrospective that turns a finished session or milestone into durable, reusable
knowledge. It writes a dated entry to `docs/LEARNINGS.md` so future sessions don't relearn
the same lessons. This is an internal, engineering-facing log (be technical and candid) —
distinct from the customer-facing `journal` skill.

## Scope rule: this skill writes ONLY to docs/LEARNINGS.md

The only write this skill performs is appending an entry to `docs/LEARNINGS.md` (create the
file if it doesn't exist). Do **not** change code, tests, or any other file as part of a
learn pass.

## Step 0 — Ground yourself in what actually happened

Don't write from vague memory of the session. Reconstruct it from evidence:

- What changed: `git log --oneline -15` and `git diff --stat` for the session's commits /
  working tree.
- What was attempted and abandoned — uncommitted experiments, reverted changes, notes in
  the conversation.
- Real constraints hit this session (environment limits, missing deps, no network, API
  quirks, flaky tooling) — these are the most valuable thing to capture.
- Read the existing `docs/LEARNINGS.md` (if present) so you match its format and don't
  duplicate prior entries.

## The entry — append, dated, structured

Append (never overwrite) a new section to `docs/LEARNINGS.md`. Use today's date as the
heading and cover:

```
## YYYY-MM-DD — <short title for the session/milestone>

- **What we tried:** ...
- **What worked:** ...
- **What failed and why:** ...
- **Surprises / constraints discovered:** ... (e.g. environment limits, tooling quirks)
- **Recommendations for next time:** ...
```

Keep each bullet concrete and specific — a future agent should be able to act on it without
the original context.

## Style rules (encode these every time)
- Honest and specific: record real failures and dead ends, not just wins. The failures are
  the point.
- Grounded in Step 0 evidence (git, the actual session), not a rosy reconstruction.
- Append-only and dated; preserve prior entries.
- Tight: a few sharp bullets beat a wall of text. No secrets or raw credentials in the log.
