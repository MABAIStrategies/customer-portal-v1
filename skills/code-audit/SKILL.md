---
name: code-audit
description: Run a read-only code-review pass over the current diff or a named area, hunting correctness bugs, security issues, dead/duplicated code, and simplification/reuse opportunities. Use when the user asks for a "code audit", to "audit the code", to "review the diff", or wants a second pass over recent changes before merge.
---

# Skill: Code Audit

A read-only review pass. Invoke it to scrutinize the current working diff (default) or a
specific area the user names, and to surface concrete, actionable findings grouped by
severity. It does **not** change code.

## Hard rule: this is read-only

Do **NOT** edit, refactor, or "fix while you're here" during an audit. Produce findings
only. Offer to apply fixes **only if the user asks** — and even then, treat applying them
as a separate, explicitly-requested step.

## Step 0 — Ground yourself in the real code first

Never review from memory or from the prompt's description. Inspect the actual current
state:

- Scope the diff: `git status`, `git diff` (unstaged), `git diff --staged`, and
  `git log --oneline -10` to see what changed and the baseline it sits on.
- If the user named an area instead of "the diff", read those files/dirs directly rather
  than assuming their contents.
- Read enough surrounding code to judge correctness — callers, the function being changed,
  and any tests that exercise it (this repo's harnesses live in `test/`).
- Note any constraint that limits your review (couldn't run it, file too large to fully
  read, missing context) and say so rather than guessing.

## What to look for

- **Correctness bugs** — off-by-one, null/undefined, wrong branch, broken edge cases,
  mismatched async, incorrect reconciliation/chain logic, regressions vs. the baseline.
- **Security issues** — injection, unsafe input handling, secrets in code, leaked PII,
  unsafe network/file egress. (For a deeper adversarial pass, point the user at the
  `red-team` skill and the built-in `security-review`.)
- **Dead / duplicated code** — unreachable branches, unused exports, copy-paste that
  should be shared, parallel implementations that drifted.
- **Simplification / reuse** — overcomplicated logic, reinvented helpers that already
  exist in the repo, opportunities to reuse an existing function instead of adding one.

## The report — group findings by severity

Lead with a one-line summary of what was reviewed (e.g. "diff of N files" or the named
area). Then list findings under three headers, highest first. Omit a header if it has no
findings.

### High
Correctness bugs that produce wrong output, security issues, or data loss.

### Medium
Likely-bug-but-conditional issues, risky patterns, meaningful duplication.

### Low
Style, minor simplifications, nits, reuse opportunities.

For **every** finding, give:
- `path:line` (or a tight range) so it's locatable.
- A one-sentence statement of the problem.
- A concrete fix suggestion (what to change, not just "this is wrong").

If you found nothing at a severity, say so honestly instead of padding the list.

## Style rules (encode these every time)
- Honest and specific; never invent findings to fill a section, never inflate severity.
- Every finding grounded in code you actually read in Step 0 — cite `path:line`.
- Tight and scannable: severity headers, one finding per bullet.
- Read-only: do not change code. Offer fixes only if asked.
