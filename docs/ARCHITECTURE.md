# Apex Title Studio — Architecture

The evolution of the Apex tooling from a single-purpose form filler into an LLM-style
workflow app. This documents Phase 1 (shipped here), the swap points designed in, and the
Phase 2 backend.

## The workflow we're automating
A Delaware title abstract requires gathering records from **four sources** and assembling
them into one report:

1. **Recorder of Deeds** — chain of title, mortgages, satisfactions, assignments, easements
2. **County Assessment / Tax** — tax status, delinquencies, water/sewer (municipal) liens
3. **Prothonotary Court** — civil judgments against the owner(s)
4. **State Tax-Lien** search — Delaware state tax liens

The gold-standard output ("North Star", from `Search Services Example.docx`) is a richer
report than the original template — HUNDRED, PARCEL, UNIT/LOT/BLOCK, full metes-and-bounds
legal description, DIRECT CONVEYANCES, MORTGAGE/ASSIGNMENT, JUDGMENT, FEDERAL TAX LIEN,
MECHANICS LIEN, US BANKRUPTCY, and liability NOTICEs.

## Phase 1 — `Apex_Title_Studio.html` (shipped, offline)
A single-file, offline LLM-style web app.

```
 ┌─ Sources drawer ─┐     ┌──────────── Workspace thread ────────────┐
 │ 1 Recorder       │     │  intro + address bar (Phase 2)           │
 │ 2 Tax            │ ──▶ │  [Extract] ─▶ editable North-Star data    │
 │ 3 Court          │     │            with red TO-VERIFY flags       │
 │ 4 State lien     │     │  [Generate Google Doc] (review)          │
 └──────────────────┘     │  [Build preview] ─▶ Apex report           │
                          │  [Add signature] ─▶ [Generate Apex PDF]   │
                          └──────────────────────────────────────────┘
```

Pipeline functions (all in the file's IIFE):
- **Reused parser** (`detectDelim`, `splitLine`, `guessCanon`, `looksHeader`, `parseText`,
  `docFull`, `classify`, `sortKey`) — lifted verbatim from `Apex_Title_Form_Filler.html`,
  proven DOM-free by `test/parser_test.mjs`. Handles tabular recorder indexes.
- **Extraction layer (the swap point):**
  - `extractSource(text, sourceType) → {records[], fields{}}` — isolates any delimited
    table and parses it with the reused parser, **and** reads labeled fields
    (`field()`) and narrative money/lien lines (`moneyLines()`) from rich reports.
  - `composeNorthStar() → model` — merges all four sources into one North-Star model where
    every value carries `{v, verified, source}`. Chain sorted newest→oldest.
- **Safety behavior:** every extracted value starts **unverified** and renders red as
  **"[TO VERIFY]"**; the report keeps a **"DRAFT — NOT A COMPLETED SEARCH"** banner until the
  abstractor clears every flag. Mirrors `Title_Search_Report_905_Shallcross_DRAFT.docx`.
- **Outputs:** `genGoogleDoc()` (review doc) → `buildReport()` (Apex preview) →
  `generate-apex-pdf` skill (branded PDF + in-app signature).

### The single online dependency — Google Doc
Creating a Google Doc from Apex's Drive template needs Apex's Google connection. Phase 1
ships the **offline-safe default**: `genGoogleDoc()` builds a Google-Docs-importable `.doc`
(red-flagged) and opens Google Docs for a one-click upload. The durable replacement is a thin
**Apps Script / Google Docs API** bound to Apex's Drive that populates the template directly —
drop-in, no UI change.

### The extraction swap point (future fine-tuned model)
`extractSource()` is deliberately the only place that "understands" a report. Today it is
deterministic (parser + label/narrative heuristics). It is designed to be replaced by a
**single-purpose fine-tuned small model** (e.g. Gemma-3 e2b / Qwen3-1.7B) trained to parse
these reports — call its endpoint inside `extractSource()` and the entire UI, the North-Star
model, the doc/PDF steps, and the tests stay unchanged.

## Phase 2 — auto-retrieval (design; needs a backend)
"Type an address → Go" pulls the four sources automatically, then runs the same pipeline.

- **Data source: licensed aggregator by address** (the PropertyChecker-style source the
  `905 Shallcross` draft already uses) + the genuinely public NCC Document Search /
  CourtConnect. **Legal, no county-portal ToS breach, no stored county logins.**
- **Backend:** Node/Express (already in `package.json`), a job queue, and secret management.
  Reuse the repo's existing bones: `src/lib/integrations/` (GoHighLevel + Stripe adapter
  stubs), `src/lib/{validator,renderer}.js`, `db/schema.sql`, `better-sqlite3`. For any
  cloud reasoning/QA step use the **latest Claude**; the on-device expert parser is the
  separately-trained small open model above.
- Keep the DRAFT/verify-flag discipline until an abstractor certifies — automation drafts,
  humans sign.

## Tests
- `node test/parser_test.mjs` — 22/22, the reused parser.
- `node test/extract_test.mjs` — 8/8, the Studio extractor on the 905 Shallcross example
  (table isolation, label reads, "none" dropping, junk-row protection, tax status).

## Fully offline (PDF reading included)
The deliverable is a single HTML file that works **with or without internet** — important for
use in county offices / on the road. PDF.js is **vendored** (`vendor/pdfjs/`, Apache-2.0) and
**inlined** into `Apex_Title_Studio.html` by `tools/build_studio.mjs`, including a
same-document worker the app turns into a Blob URL. There are **no CDN or network calls** at
runtime; the only optional online action is opening Google Docs for the review upload (the
`.doc` itself is generated offline).

Rebuild after editing the app: `node tools/build_studio.mjs` (idempotent).

## Files
- `Apex_Title_Studio.html` — the Phase 1 app (self-contained, PDF.js inlined).
- `tools/build_studio.mjs` — inlines vendored PDF.js for offline PDF reading.
- `vendor/pdfjs/` — Mozilla PDF.js v3.11.174 (Apache-2.0) + NOTICE.
- `skills/generate-apex-pdf/SKILL.md` — the final PDF step.
- `test/extract_test.mjs`, `test/parser_test.mjs` — extraction + parser harnesses.
- Reuse: `Apex_Title_Form_Filler.html` (parser), `src/`, `db/`, `package.json` (Phase 2).
