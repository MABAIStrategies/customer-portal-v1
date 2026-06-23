---
name: run-tests
description: Locate and run the project's test suite, then report pass/fail counts per suite and diagnose any failures with the failing assertion and smallest likely cause. Use when the user says "run tests", asks "are tests passing", wants a green-check before merge, or wants to confirm a change didn't break anything.
---

# Skill: Run Tests

Find the project's tests, run them, and report results clearly. In this repo the suite is
`npm test`, which runs five Node accuracy harnesses (no install, no network).

## Hard rule: stay in scope

This skill **runs** tests and **reports** — it does not fix code to make tests pass and
does not edit the tests. If a test fails, diagnose it and report; only change code if the
user explicitly asks for a fix as a separate step.

## Step 0 — Ground yourself in the real suite first

Don't assume the command. Confirm what actually exists:

- Read `package.json` `scripts` to confirm the test command. Here it is:
  `npm test` → `node test/parser_test.mjs && node test/extract_test.mjs &&
  node test/trial_extract.mjs && node test/trial2_extract.mjs && node test/trial3_extract.mjs`.
- Note that `&&` means the run **stops at the first failing harness** — later suites won't
  report until earlier ones pass. If you need per-suite results past a failure, run the
  harnesses individually with `node test/<file>.mjs`.
- Check `test/` for the actual harness files so your report names them correctly.

## Step 1 — Run

Run `npm test` from the repo root. If you need full coverage despite an early failure, run
each `node test/*.mjs` harness separately and collect all results.

## Step 2 — Report

- **Per suite**: name each harness and its result (pass/fail, with counts if the harness
  prints them).
- **Overall**: total passed / failed.

## On failure — diagnose, don't guess

For each failure, report:
- Which harness and which assertion failed (quote the actual failing line/expected-vs-actual
  from the output).
- The **smallest likely cause** — point at the specific function or input that produced the
  mismatch. These harnesses execute functions lifted from the shipped `Apex_*.html`, so
  trace the failure back to the real source, not the test scaffold.
- Do not propose a code change unless asked; state the cause and stop.

## If you can't run tests

If the environment can't run the suite (no Node, sandbox blocks execution, etc.), **say so
explicitly**. Do not report a guessed result or claim tests pass. State what blocked you and
what the user would need to run it.

## Style rules (encode these every time)
- Honest: report real output; never claim green without a real run.
- Grounded: confirm the command from `package.json`, name the actual harnesses.
- Tight and scannable: per-suite line items, then an overall total.
- In scope: run and report; fix only if explicitly asked.
