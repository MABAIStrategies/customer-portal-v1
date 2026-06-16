# Test Report — Apex Title Form Filler & Setup/Download Page

**Files under test**
- `Apex_Title_Form_Filler.html` — the offline form-filler tool
- `Apex_Setup_and_Download.html` — the branded setup/landing page with one-click download

**Date:** 2026-06-16 · **Scope:** clarity, accuracy, and "does it sufficiently get the job
done" for any title search Zach can pull in his jurisdiction (Delaware — New Castle, Kent,
Sussex; the tool also nominally supports PA and NJ).

---

## 1. How it was tested
- **Automated:** `test/parser_test.mjs` extracts the *actual shipped* parser functions
  (`detectDelim`, `splitLine`, `looksHeader`, `guessCanon`, `parseText`, `classify`,
  `docFull`, `sortKey`) directly out of the HTML by balanced-brace slicing and runs all five
  demo datasets through the same parse → classify → chain-sort pipeline the browser uses.
  **Result: 22/22 assertions pass.** No npm installs required.
- **Integrity:** the base64 payload embedded in the setup page was decoded and SHA-256
  compared to the form-filler file — **byte-for-byte identical**.
- **Static review:** full read of the form-filler source (parser, classifier, persistence,
  print, export) and the setup page.
- **Manual smoke test (recommended before the demo):** open the tool, paste each dataset,
  confirm the review table and filled report match the expected outcomes in
  `demo/Apex_Demo_Datasets.md`.

---

## 2. Verdict

**Fit for purpose — ship it for the demo.** The tool reliably ingests recorder
grantor/grantee index results in whatever shape Zach exports them, classifies each document
into the right section of the Delaware Title Search Report, composes the chain of title
newest→oldest, auto-fills the current owner / deed reference / recorded date / legal, and
prints to a correctly-named PDF — entirely offline, with a human review-and-confirm gate
before anything commits. It matches the DE Title Report template section-for-section.

There is **one accuracy caveat** (release/satisfaction reconciliation) and a short list of
**clarity/jurisdiction notes**, none of which block the demo. They are the natural backlog.

---

## 3. What works well (clarity + sufficiency)

| Area | Finding |
|---|---|
| **Input flexibility** | Auto-detects tab / comma / pipe / multi-space delimiters; handles quoted commas; detects (and lets you toggle) a header row; auto-maps columns and lets you override every mapping. |
| **Classification** | Correctly routes deeds → chain, mortgages → current, satisfactions/releases → satisfied, assignments → modifications, judgments → civil, IRS/federal → federal liens, tax/municipal → tax liens, UCC/lis pendens/mechanics → status notes. Ordering is right: satisfaction and assignment are caught *before* generic "mortgage," and federal liens *before* the generic tax bucket. |
| **Chain assembly** | Sorts newest→oldest across both `MM/DD/YYYY` and `YYYY-MM-DD`, numbers the transfers, and auto-fills current owner from the newest deed. |
| **Human control** | Every parsed row is shown with its routing; Zach can re-route, exclude other-property rows, or fix the column map before committing. Auto-filled fields are highlighted and remain editable. Nothing commits until "Fill the form." |
| **Delaware reality** | Handles both **book/page** (New Castle) and **instrument-number-only** records (Sussex LandmarkWeb); judgments paste in from the separate Superior Court / CourtConnect search into the Civil Judgments box. |
| **Output** | Renders the exact template, watermarked DRAFT, prints to Letter PDF, auto-names the file (`NCC_<address>_<date>`), and offers JSON save/load drafts. |
| **Privacy** | Fully offline — no accounts, no network calls, data stays on the machine. Strong selling point for a title shop handling PII. |

---

## 4. Accuracy caveat (the one that matters)

**Satisfactions/releases and assignments are listed but not *reconciled* against their
mortgages.** This is the SOP flowchart's "Match with found releases/assignments" step. The
tool puts a satisfaction in the **Satisfied Mortgages** box and the original mortgage in the
**Current Mortgages** box, but it does **not** automatically remove the now-paid mortgage from
"Current." Dataset ④ demonstrates this: the 2017 WSFS mortgage was satisfied in 2021, yet it
auto-routes to **Current** and Zach must move it manually.

- **Impact:** without the manual move, an open-mortgage list can overstate active liens.
- **Mitigation today:** the review step and the editable fields let Zach correct it in
  seconds; `demo/Apex_Demo_Datasets.md` calls this out explicitly.
- **Fix (roadmap, Task 7):** auto-match a satisfaction/release to its mortgage by
  party/book-page/instrument and move or annotate it. Highest-value accuracy improvement.

---

## 5. Clarity / jurisdiction notes (minor, non-blocking)

1. **Abbreviations the classifier doesn't know default to *Skip*.** A bare `SAT` (vs.
   "Satisfaction"/"Release") or other shorthand routes to the review bucket and won't be
   filed unless re-routed (dataset ⑤). Consider expanding the abbreviation map, or surfacing
   skipped rows more loudly in the review footer.
2. **Legal description from the index is abbreviated** (e.g., "LOT 39 BLK 108 BRANDYWINE
   HUNDRED"), not full metes-and-bounds. The tool already flags "verify against the recorded
   instrument" — keep that prominent.
3. **Tax status, title opinion, and full legal are manual by design** — correct, but worth a
   one-line on-screen reminder that these are required before delivery (see roadmap: a
   pre-Print checklist gate).
4. **Order-ID prefixes cover DE counties** (NCC/KEN/SUS) and fall back to the first three
   letters elsewhere — fine for PA/NJ but not tuned.
5. **No automated gap/break detection** in the chain; gaps are a manual note (dataset ③).
   Acceptable for an abstract; a future "possible gap" hint could help.

---

## 6. Setup / Download page (Task 4 — see ROADMAP.md for detail)
- One-click **Download the tool** decodes the embedded base64 and saves a working,
  standalone `Apex_Title_Form_Filler.html`. **Verified identical** to the source file.
- No external dependencies; works offline and cross-browser.
- Recommendations (distribution hardening, not blockers) are in `docs/ROADMAP.md` §Task 4.

---

## 7. Bottom line
The two files do what they promise and are demo-ready today. Brief the satisfaction-matching
caveat to Zach as a known "your-judgment-here" step (it actually reinforces the "you stay in
control" message), and put the reconciliation auto-match at the top of the post-demo backlog.
