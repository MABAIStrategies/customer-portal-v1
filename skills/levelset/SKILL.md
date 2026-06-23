---
name: levelset
description: Produce a concise build-inventory / level-set status report (gaps, percent-to-finished, next-phase necessity & timeline, and clear-path-to-finish-line with blockers). Use after a gap of hours or days to re-orient the coding agent and the user on where a build stands, or whenever the user asks for a "levelset", "level set", "build inventory", or "where are we".
---

# Skill: Level-Set

A reusable build-inventory pass. Invoke it after a gap of a few hours or days to quickly
re-orient BOTH the coding agent and the user on where the build actually stands. It
produces a tight, scannable status report grounded in the real current state of the repo.

## Hard rule: this is read-only

Do **NOT** build, edit, refactor, or change any code during a level-set. No fixes, no
"while I'm here" tweaks. This is a status pass only. If you spot something to fix, note it
as a gap — do not act on it.

## Step 0 — Ground yourself in reality first (do this before writing anything)

Never answer from memory. Quickly inspect the actual current state so every claim is
grounded:

- Recent git history: `git log --oneline -20`, `git status`, and `git diff --stat` to see
  what was last touched and what is uncommitted/in-flight.
- The plan/roadmap, if present: check `~/.claude/plans/` first, then look for a `PLAN.md`,
  `ROADMAP.md`, `TODO.md`, or similar doc at the repo root or in `docs/`.
- Open TODOs in the code: search for `TODO`, `FIXME`, `XXX`, `HACK`.
- Test status: locate and run the test suite (or at least read the latest known result).
  If tests can't be run in this environment, say so explicitly rather than guessing.
- Note any environmental constraints you hit (missing deps, no network, no DB, etc.) and
  surface them in the report.

## Step 0.5 — Confirm the finish line

Define **"the finish line"** from the user's most recently stated definition of done for
the **current phase**. If that definition is unclear or you can't find it, STOP and ask the
user to confirm the finish-line definition before producing the report.

## The report — answer these four questions, in this order

Use headers plus checkbox bullets (`- [ ]`) wherever a list is given. Be honest and
specific; never inflate progress. Keep it tight and scannable but detailed enough to act
on.

### 1. Where are the gaps and what are they?
List each known gap / incomplete piece as a checkbox bullet. Be concrete about what each
gap is and where it lives.
- [ ] (gap)

### 2. Percent-to-finished for the current phase + what's left
Give a single honest percentage estimate (not inflated). Then list the remaining work as
checkbox bullets, and clearly distinguish:
- [ ] **Engineering** work (things the agent/dev does)
- [ ] **Inputs owed by the user** (decisions, assets, credentials, answers)

### 3. Is the next phase necessary for production?
Answer each sub-question plainly:
- Is the next phase necessary for production? (yes/no + why)
- How long until it's done? (honest estimate)
- Is it the final phase? (yes/no)

### 4. Do we have a clear path to the finish line?
Answer **yes or no**.
- If **yes**: note whether we can proceed right now.
- If **no**: list the blockers as checkbox bullets, then state explicitly:
  *"If you (the user) provide answers to these blockers, will the path be clear?"* — and
  answer that question.
- [ ] (blocker, only if path is not clear)

## Close out

End the report by reminding the user what inputs are still owed by them (if any). If
nothing is owed, say so.

## Style rules (encode these every time)
- Honest and specific; never inflate progress. Surface real blockers and environmental
  constraints.
- Tight and scannable: headers + checkbox bullets, detailed enough to act on.
- Every claim grounded in the actual current repo/build state from Step 0 — not memory.
- Read-only: do not build or change code.
