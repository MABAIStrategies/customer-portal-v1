# Extraction trial — 1403 Stoneleigh Road, Wilmington DE 19803

Genuine-looking **fake** New Castle County records for a single property, used to stress-test
the Apex Title Studio extraction (the parsing that fills the four zones). Brandywine Hundred,
**40+ year** chain (1983 → 2026).

## The four source reports (paste each into its zone in the app)
| File | Drop into zone | Contains |
|---|---|---|
| `1_recorder.txt` | **Recorder of Deeds** | Labeled header (property/parcel/owner/deed/full metes-and-bounds legal) **+ a 40-year grantor/grantee index** (4 deeds, 5 mortgages, 4 satisfactions, 2 assignments, 1 easement) |
| `2_tax.txt` | **Assessment / Tax** | Parcel, assessed value, **tax status = Current**, Hundred, school, sewer |
| `3_court.txt` | **Prothonotary Court** | One open civil judgment (Discover Bank) |
| `4_state_lien.txt` | **State Tax-Lien** | State lien = none; one open **federal** tax lien (IRS) |

## Expected extraction (verified by `node test/trial_extract.mjs`)
- **Header:** Property, Parcel `06-114.00-027`, Hundred Brandywine, Subdivision Stoneleigh §C,
  Unit/Lot 27, Block 114, Owner Harper, Deed `20160712-0048217`, **full legal description**.
- **Chain of title (4, newest→oldest):** Nguyen→Harper (2016) · Caldwell→Nguyen (2004) ·
  Whitmore→Caldwell (1994) · Stoneleigh Builders→Whitmore (1983).
- **Mortgages (5)**, **Satisfactions (4)**, **Assignments (2)** — each routed from the single
  mixed index by document type.
- **Judgments (1):** Discover Bank. **Federal tax lien (1):** IRS. **Tax status:** Current.

## What this trial caught (and we fixed)
The metes-and-bounds **legal description** is comma-heavy. The original table-isolation pulled
any comma-dense line into the index block, which flipped delimiter detection to "comma" and
**dropped the entire chain of title** (0 deeds/mortgages). Fixed by isolating the table with a
single consistent delimiter (**tab > pipe > comma**) so prose can't corrupt a tab-separated
recorder index. See `Apex_Title_Studio.html` `extractSource()` step (a).

## Note (known, by design)
Satisfactions are listed separately and **not auto-reconciled** against their mortgages — the
abstractor nets them (e.g. the 2016 WSFS mortgage was satisfied in 2021; the 2021 Rocket loan
is the current lien). This is the documented "match releases" judgment step.
