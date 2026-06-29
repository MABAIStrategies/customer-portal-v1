# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Apex Abstracts is a Delaware title-abstracting toolset. The core deliverable is a single-file offline HTML app (`Apex_Title_Studio.html`) plus a lightweight Node backend that serves a chatbot-style UI where a user types a Delaware address and gets a professional Apex-branded title report.

Customer: Zach Paris, a licensed Delaware title abstractor (New Castle, Kent, Sussex counties).

## Commands

```bash
npm test                    # all 6 accuracy harnesses (no install needed — pure Node)
npm run build               # re-inline PDF.js into Apex_Title_Studio.html (idempotent)
cd backend && npm start     # start the hosted backend on http://localhost:8787
cd backend && npm install   # install backend deps (cheerio only)
```

Individual test harnesses (each is standalone, no test framework):
```bash
node test/parser_test.mjs       # 22 assertions — parser (detectDelim, classify, sortKey, etc.)
node test/extract_test.mjs      # 8 assertions — Studio extractor on 905 Shallcross example
node test/trial_extract.mjs     # trial 1: 1403 Stoneleigh (40-yr chain, mortgage reconciliation)
node test/trial2_extract.mjs    # trial 2: 24 Pilottown
node test/trial3_extract.mjs    # trial 3: 110 Maple (chain gaps, other-property flags)
node test/attom_test.mjs        # ATTOM API mapping against offline fixture
```

CI runs `npm test` on Node 18/20/22 (`.github/workflows/node.js.yml`). No `npm install` needed at root — tests have zero dependencies.

## Architecture: the "function lifting" pattern

This is the most important thing to understand. The repo has a single source of truth for extraction logic: **`Apex_Title_Studio.html`**. The backend and all tests extract functions from this HTML file at runtime using balanced-brace parsing.

```
Apex_Title_Studio.html          ← THE source of truth (all pipeline functions live here)
        │
        ├──▶ tools/pipeline.mjs       lifts functions via liftFn(), exposes runPipeline()
        │         │
        │         ├──▶ backend/server.mjs         imports runPipeline for /api/generate
        │         └──▶ backend/lib/orchestrate.mjs  imports runPipeline for report generation
        │
        └──▶ test/*.mjs               each test lifts functions independently via extractFn()
```

`tools/pipeline.mjs` reads the HTML file at module load, regex-matches function declarations, then uses balanced-brace counting to slice out the complete function body. It constructs a `new Function("store", "opts", body)` that runs the full pipeline headlessly. **This means `Apex_Title_Studio.html` is a runtime dependency of the backend server.**

Key pipeline functions (all defined inside the HTML's IIFE):
- `extractSource(text, sourceType)` → parses one source report into records + fields
- `composeNorthStar()` → merges all four sources into the North-Star report model
- `reconcile(model)` → matches satisfactions to mortgages (OPEN/RELEASED annotation)
- `analyzeChain(model)` → flags chain gaps and other-property deeds
- `buildReport()` → renders the Apex-branded HTML report

When editing pipeline functions, you are editing `Apex_Title_Studio.html` directly. After changes, run `npm test` to verify all harnesses still pass, then `npm run build` to re-inline PDF.js.

## Backend data flow

```
address → orchestrate.mjs retrieve()   (first available wins, each falls through on error)
              │
              ├─ BATCHDATA_API_TOKEN set? → batchdata.mjs (licensed; BatchData MCP lookup_property)
              ├─ ATTOM_API_KEY set?       → attom.mjs (licensed API)
              └─ else                     → parcel.mjs (live NCC assessor scrape, public, no login)
              │
              ▼
         recordToZones() → { recorder, tax, court, statelien } (four text blocks)
              │
              ▼
         runPipeline(store, opts) → { html, model, tokens }
              │
              ▼
         server.mjs /api/generate → JSON { ok, html, flags, tokens, owner, parcel }
```

`backend/lib/http.mjs` is a minimal cookie-jar HTTP client for ASP.NET WebForms portals (the NCC assessor). It handles hidden-field postback, redirect following, and automatic retry on 429/503/247 throttle responses.

## Two package.json files

- **Root `package.json`**: no dependencies. `npm test` runs the accuracy suite. `npm run build` re-inlines PDF.js.
- **`backend/package.json`**: `cheerio` only. `npm start` runs the server. This is what the Dockerfile installs.

## Deployment

The app is a persistent Node server (not serverless — serverless breaks `http.createServer`, file paths, in-memory state). Deployed via Docker on Render (see `render.yaml`, `Dockerfile`, `DEPLOY.md`). The `Dockerfile` copies the whole repo because the server reads `Apex_Title_Studio.html` from the root at startup.

Live: https://apex-abstracts.onrender.com (free tier, sleeps after 15 min idle).

## Environment variables (all optional)

| Var | Effect |
|-----|--------|
| `BATCHDATA_API_TOKEN` | Licensed BatchData data via the BatchData MCP (`lookup_property`); preferred source, activates automatically when set. Note: BatchData carries a *brief* legal only — no metes-and-bounds and no recorded-deed image, so full courses-and-distances still come from the deed itself (attach it to the client packet). |
| `ATTOM_API_KEY` | Licensed ATTOM data; used if BatchData isn't set |
| `GDOC_ENDPOINT` | Apps Script `/exec` URL for one-click Google Doc generation |
| `PORT` | Server port (default 8787; injected by host) |

## Safety invariants

- Every extracted value starts **unverified** with a red `[TO VERIFY]` flag. Reports carry a `DRAFT — NOT A COMPLETED SEARCH` watermark until all flags are cleared. Never change this default.
- Reconciliation and chain analysis **flag, never hide**. A satisfied mortgage is annotated RELEASED but stays visible. A disconnected deed gets a warning chip but is never auto-excluded.
- Court judgments and state liens are surfaced as manual-verify notes ("not auto-retrieved") — the report never implies a completed search for something it didn't fetch.

## Constraints

- `demo/address-trials/` is gitignored — contains third-party PII from consumer property reports. Never commit.
- Credentialed-portal scraping (PAX recorder login, CourtConnect with F5 WAF) is shelved on ToS grounds. The free public NCC assessor is fine. ATTOM is the licensed path.
- The `Apex_Title_Form_Filler.html` is a dormant reference — do not delete it; `test/parser_test.mjs` depends on it.

## Google Doc integration

`integrations/google-doc/Code.gs` is an Apps Script Web App that creates a Google Doc from a Drive template with `{{PLACEHOLDER}}` tokens. The Studio app POSTs tokens as `text/plain` (avoids CORS preflight). When the endpoint is unreachable, `downloadDoc()` generates an offline `.doc` fallback. Dollar signs in replacement values must be escaped (`$` → `$$`) in `replaceText` calls.
