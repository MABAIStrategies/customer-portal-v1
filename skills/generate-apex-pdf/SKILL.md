---
name: generate-apex-pdf
description: Turn a reviewed, signed-off Apex title report draft into the final Apex-branded enterprise PDF. Use after a human has verified the extracted fields and applied a signature in Apex Title Studio.
---

# Skill: Generate Apex PDF

The final, human-in-the-loop step of the Apex Title Studio pipeline. It takes the
verified report model + an applied signature and produces the official, Apex-branded
**Title Search Report** PDF for delivery.

This skill is implemented **client-side inside `Apex_Title_Studio.html`** (no server, no
upload) so client PII never leaves the machine. It is exposed as the **"Generate Apex PDF"**
button on the report-preview turn.

## Preconditions (the human-in-the-loop gate)
1. Sources extracted and assembled into the North-Star model (`composeNorthStar()`).
2. Each field reviewed; the abstractor clicked the **TO VERIFY → VERIFIED** flag on every
   field confirmed against the record. Any field left unverified renders **red** and the PDF
   keeps the **"DRAFT — NOT A COMPLETED SEARCH"** banner (intentional safety behavior).
3. A signature applied via the **Add signature** modal (draw or type + printed name). The
   signature is embedded, timestamped, and locks the report as reviewed.

## What it produces
- Letter-size, print-to-PDF of the Apex-branded `.sheet` (serif body, brass header, seal,
  the North-Star sections, the two liability NOTICEs, and the signature block).
- Auto-named `Apex_<Property>_<YYYY-MM-DD>` via `fileBase()`.
- If anything is still unverified, the user is warned and the DRAFT banner is retained.

## How it works (functions in `Apex_Title_Studio.html`)
- `buildReport()` — renders the verified model + signature into the `.sheet` markup.
- `anyUnverified()` — gate that decides whether the DRAFT banner stays.
- `genPdfBtn` handler — sets the document title to `fileBase()` and calls `window.print()`;
  the `@media print` CSS hides the app chrome and prints only `#reportTurn`’s sheet.

## Upgrade path
For a true binary PDF (not browser print-to-PDF) and/or a legally-robust e-signature, swap
this skill's body for a server-side renderer (e.g. Puppeteer/`pdf-lib`) or a DocuSign /
Dropbox Sign integration. The preconditions and the report model stay identical, so the
front end does not change.
