# Apex Title Form Filler — Demo Datasets

Five ready-to-paste datasets for demonstrating the Form Filler to Zach. Each is realistic
Delaware data spanning the three counties he works (New Castle, Kent, Sussex) and a range of
title conditions. Every dataset is verified by `test/parser_test.mjs` (run `node test/parser_test.mjs`).

## How to demo
1. Open `Apex_Title_Form_Filler.html`.
2. Open the matching file in `demo/`, **select all, copy**, and paste into the **Import** box.
   (Or use **Upload CSV / TSV** and pick the file directly.)
3. Click **Parse records** → review the routing table → click **Fill the form with these records**.
4. Fill the human-judgment fields noted below (tax status, opinion, etc.), then **Print / Save PDF**.

> The fields the tool **cannot** know from the index — **Tax Status**, **Title Opinion**, and the
> full **Legal Description** — are intentionally left for Zach. That's the "you stay in control" step.

---

## ① New Castle — Clean / Clear  · `dataset1_newcastle_clear.tsv`
Single family home, straightforward 40-year chain, one open mortgage, no liens.

| What it shows | Result |
|---|---|
| Chain of title | 2 transfers, newest→oldest (Greene→Harper 2017, Coastal→Greene 2004) |
| Current owner (auto) | HARPER, DANIEL R & SARAH L |
| Mortgages | 1 open (WSFS Bank, $312,000) |
| Liens | none |
| **Set manually** | Tax Status = **Current** · Opinion = **Clear** |

---

## ② Kent — Clouded  · `dataset2_kent_clouded.tsv`
Open mortgage **plus** a civil judgment against the owner; taxes delinquent.

| What it shows | Result |
|---|---|
| Chain of title | 2 transfers (Whitaker→Horizon→Miller) |
| Mortgages | 1 open (M&T Bank, $189,500) |
| Liens | 1 civil judgment (Capital One, $4,850) → **Civil Judgments** box |
| **Set manually** | Tax Status = **Delinquent** + amount/years · Opinion = **Clouded** |

---

## ③ Sussex — Requires Resolution  · `dataset3_sussex_resolution.tsv`
Sussex-style **instrument-number-only** records (no book/page), a **gap in the chain**, a
federal tax lien, and a lis pendens.

| What it shows | Result |
|---|---|
| Chain of title | 2 transfers; gap between Frank Odell (2003) and Barton→Margaret (2021) |
| Liens | Federal tax lien (IRS, $27,300) → **Federal Liens**; Lis Pendens → **Status Notes** |
| Federal-before-tax ordering | "Federal Tax Lien" routes to **Federal**, not the generic tax bucket |
| **Set manually** | Chain note documenting the 2003→2021 gap · Opinion = **Requires Resolution** |

---

## ④ New Castle — Commercial / LLC  · `dataset4_newcastle_commercial.tsv`
Commercial parcel held by an LLC, with **two assignments** of the active mortgage and a
**satisfied** older mortgage. **This dataset deliberately exposes the one caveat** (see below).

| What it shows | Result |
|---|---|
| Chain of title | 1 transfer (Riverside→Apex Holdings, Special Warranty Deed) |
| Assignments | 2 (First National→BofA→Citizens) → **Assignments / Modifications** |
| Satisfied mortgage | 1 (WSFS satisfaction, 2021) → **Satisfied Mortgages** |
| Current mortgages | **2** — the active $1.2M **and** the 2017 WSFS $900K that was *already satisfied* |
| **Set manually** | **Move the 2017 WSFS mortgage from "Current" to "Satisfied"** (the tool lists releases but does not auto-net them against their mortgage — see TEST_REPORT.md) · Opinion as warranted |

This is the honest demo: it shows the tool doing the heavy lifting **and** shows exactly where
Zach's judgment is still required — a good trust-builder in front of a client.

---

## ⑤ Messy real-world paste  · `dataset5_messy_realworld.csv`
A deliberately imperfect export to show the review step earning its keep:
**comma-delimited** with quoted commas inside a legal description, a **quitclaim into a family
trust**, an **other-property row** that belongs to a different parcel, and a bare **`SAT`**
abbreviation the classifier can't recognize.

| What it shows | Result |
|---|---|
| Delimiter flexibility | comma file parses just like the tab files |
| Quoted field | `LOT 9 BIRCHWOOD, PHASE 2` stays intact (comma not treated as a column break) |
| Quitclaim to trust | routed into the chain correctly |
| Other-property row | "UNIT 5 RIVERVIEW CONDOMINIUM" appears in the table → **uncheck it** before filling |
| Unknown abbrev | bare `SAT` defaults to **Skip** → **re-route it to "Mortgage — satisfied"** manually |
| **Set manually** | uncheck the condo row; re-route the `SAT` row; then fill |

---

### Verified routing (from `node test/parser_test.mjs`, running the shipped parser)
| Dataset | chain | mortCurrent | mortAssign | mortSatisfied | lienCivil | lienFederal | lienNotes | skip |
|---|---|---|---|---|---|---|---|---|
| ① NCC clear | 2 | 1 | — | — | — | — | — | — |
| ② Kent clouded | 2 | 1 | — | — | 1 | — | — | — |
| ③ Sussex resolution | 2 | — | — | — | — | 1 | 1 | — |
| ④ NCC commercial | 1 | 2¹ | 2 | 1 | — | — | — | — |
| ⑤ messy | 3² | 1 | — | — | — | — | — | 1³ |

¹ includes the already-satisfied 2017 mortgage (move manually).
² includes the other-property row (uncheck manually).
³ the bare `SAT` row (re-route manually).
