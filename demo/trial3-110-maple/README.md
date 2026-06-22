# Extraction trial #3 — 110 Maple Avenue, Dover DE 19901 (Kent)

The "push the limits" run. Genuine-looking **fake** Kent County records designed to break the
parser with every messy thing at once.

## What makes it nasty
- **Pipe-delimited** index with **non-standard headers**: `From / To / Doc Date / Kind /
  Liber / Folio / Reception # / Consideration`.
- **Junk + blank lines** inside the paste (`Results 1-11 of 11`, an empty row).
- **Mixed date formats**: 2-digit years (`03/14/84`), ISO (`2003-06-30`), standard (`06/15/2018`).
- A **Tax Deed** — a conveyance whose type contains the word "TAX" (must not be filed as a lien).
- Messy doc codes: `Deed-Warranty`, `Mtg`, `Sat of Mtg`, `Assignment of Mtge`, `Quit Claim Deed`.
- A **blank-grantor** mortgage row, and an **other-property** deed (150 Oak St) mixed in.
- Tax status phrased oddly (`Status: DELINQUENT (balance forwarded…)`), a judgment with **no
  `$` sign**, a **municipal sewer lien**, and a **federal tax lien**.

## Expected extraction (verified by `node test/trial3_extract.mjs`, 17/17)
- **Chain: 5 deeds**, correctly sorted newest→oldest (2018 → 2015 → 2009 → 2003 → 1984), incl.
  the **Tax Deed** in the chain. The **NELSON / 150 Oak St** row is a different parcel — it
  appears so you can **uncheck it in the app's review step**.
- **Mortgages 3** (incl. the blank-grantor row, shown as `? → …`), **Satisfaction 1**,
  **Assignment 1**.
- **Judgment 1** (Midland, no `$`). **Federal lien 1** (IRS). **Other liens 2** (lis pendens +
  municipal sewer). **Tax status: Delinquent.** Parcel + Hundred + full legal captured.

## What this trial caught (and we fixed)
1. **`Doc Date` header wasn't recognized** → dates were lost and the chain came out unsorted.
   Fix: `guessCanon()` now maps `Doc Date` / `Document Date` / `Recording Date` / etc. to the
   record-date column.
2. **`Tax Deed` was filed as a tax lien** (its type contains "TAX"). Fix: `classify()` no
   longer routes a document to the tax-lien bucket if its type contains "DEED" — so a Tax Deed
   is a conveyance (chain), while a true Tax Lien still routes to liens.

Both in `Apex_Title_Studio.html`.

## Still manual, by design
- The **other-property row** is excluded by you in the review table (the tool can't know which
  parcel a row belongs to without a parcel column).
- **Chain-gap detection** and **satisfaction↔mortgage reconciliation** remain abstractor judgment.
