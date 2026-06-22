# Apex Abstracts

Offline, single-file tools for Delaware title abstracting (New Castle · Kent · Sussex),
plus the extraction accuracy suite that guards them.

Everything client-facing is a self-contained `.html` file: double-click to open, works
fully offline, and no customer data ever leaves the machine. The one optional online step
is generating a Google Doc from a Drive template (see `integrations/google-doc`).

## Tools

| File | What it is |
|------|------------|
| `Apex_Title_Studio.html` | The main app. Drop the four source reports (Recorder · Tax · Court · State Lien) → **Extract** into one editable, North-Star–schema data set with per-field source tags and red **TO VERIFY** flags → review → **Generate Google Doc** for sign-off → **Generate Apex PDF** with an in-app signature. Unverified fields stay flagged and a DRAFT watermark shows until the search is certified. |
| `Apex_Title_Form_Filler.html` | The earlier lightweight tool: paste a recorder grantor/grantee index, auto-fill a Delaware Title Search Report, review/override, print to PDF. |
| `Apex_Setup_and_Download.html` | Branded landing/setup page that hands the form filler to the end user via a one-click download (the tool is embedded as base64). |
| `Apex_Demo_Presentation.html` | Branded walkthrough/explainer for demos. |

## Accuracy features (Phase 1)

The extractor routes every source-report row into the right report zone, and then:

- **Mortgage reconciliation** — each mortgage is annotated **OPEN** or **RELEASED** by
  matching it to its satisfaction (borrower + lender, following assignment aliases so an
  assigned-then-satisfied mortgage is still recognized). Nothing is hidden; unmatched
  satisfactions are flagged for review.
- **Chain analysis** — disconnected deeds are flagged as *possible other property* and
  broken links (e.g. a tax-sale break) as *possible gaps*, listed under **Notes on chain**.
  Flags never auto-exclude a row — a human always decides.

These are the last known accuracy gaps closed before Phase 2 (address-driven retrieval).

## Layout

```
Apex_*.html              the offline tools (above)
demo/                    paste-able demo datasets + the 1403/Pilottown/Maple trials
test/                    accuracy harnesses (run the *shipped* extractor; no deps)
tools/build_studio.mjs   re-inlines PDF.js into Apex_Title_Studio.html (idempotent)
vendor/pdfjs/            bundled PDF.js (keeps the Studio offline)
skills/generate-apex-pdf branded-PDF generation skill
integrations/google-doc  Apps Script + notes for the optional Google-Doc step
docs/                    TEST_REPORT, ROADMAP, ARCHITECTURE
archive/                 superseded "customer portal generator" scaffolding (not used)
```

## Develop

```bash
npm test            # run all five accuracy harnesses (Node only, no install)
npm run build       # re-inline PDF.js into Apex_Title_Studio.html
```

`npm test` runs `parser_test`, `extract_test`, and the three trial harnesses
(`trial_extract`, `trial2_extract`, `trial3_extract`), which execute the functions lifted
directly out of the shipped HTML so the tests always reflect what users run.
