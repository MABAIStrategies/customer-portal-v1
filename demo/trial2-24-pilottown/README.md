# Extraction trial #2 — 24 Pilottown Road, Lewes DE 19958 (Sussex)

A deliberately **harder** stress-test than trial #1. Genuine-looking **fake** Sussex County
records, chain 1981→2022, designed to break the parser on purpose.

## What makes it hard
- **Comma-delimited (CSV)** recorder index **plus a comma-heavy metes-and-bounds legal
  description** in the same paste — the worst delimiter-collision case.
- Quoted fields with internal commas (`"ELLISON, HAROLD W & MARY B"`, `"$46,000"`).
- Document-type **abbreviations** (`MTG`, `ASGN`) and full words mixed.
- An **Executor's Deed** (estate), a **trust** in and out, a **mechanics lien** and a
  **lis pendens** in the index, a **state tax lien** + **municipal sewer lien** as narrative,
  and **delinquent** taxes.

## Paste each into its zone
`1_recorder.txt` → Recorder · `2_tax.txt` → Tax · `3_court.txt` → Court · `4_state_lien.txt` → State-Lien.

## Expected extraction (verified by `node test/trial2_extract.mjs`, 15/15)
- **Chain: 4 deeds** newest→oldest (Trust→Ellison 2022 … Coastal Dev→Ellison 1981).
- **Mortgages 2 · Satisfaction 1 · Assignment 1** (the `ASGN` code is recognized + displayed
  as "Assignment of Mortgage").
- **Judgment 1** (Capital One). **Federal lien 0.**
- **Other liens / notes 4**: mechanics lien, lis pendens, municipal sewer lien, state tax lien.
- **Tax status: Delinquent.** Parcel `335-8.00-112.00`, Lewes & Rehoboth Hundred, full legal.

## What this trial caught (and we fixed)
1. **CSV + prose legal wiped the whole index** (same class of bug as trial #1, but on the comma
   path). Fix: the comma branch now counts only **top-level (unquoted) commas** and keeps only
   rows near the **modal column count**, so a comma-heavy legal description can't be mistaken
   for table rows.
2. **`ASGN` abbreviation was dropped** (routed to "review"). Fix: `classify()` now recognizes
   `ASGN`/`ASG` (assignment) and `SAT`/`REL` (satisfaction); `docFull()` expands the codes.
3. **State-tax and municipal/sewer liens were never captured** (not among the narrative
   keywords). Fix: `moneyLines()` now also captures STATE TAX LIEN, MUNICIPAL LIEN, and
   LIS PENDENS (NONE results are still dropped).

All in `Apex_Title_Studio.html` `extractSource()` / `classify()` / `docFull()`.
