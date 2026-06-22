# Google Doc generator — setup (≈3 minutes, one time)

This connects **Apex Title Studio**'s "Generate Google Doc for review" button to your
Google Drive. It copies a branded template, fills it with the verified data, flags any
`[TO VERIFY]` text in red, and opens the new Doc for leadership review.

It runs as **you** via Google Apps Script — no server, no service account, no cost, and the
Studio app stays a single offline HTML file with no embedded keys.

## Steps

1. Go to **https://script.google.com → New project**.
2. Delete the starter code, paste **all of `Code.gs`** from this folder, and **Save**.
3. (Optional) If you already have a hand-styled template Doc, put its ID in
   `CONFIG.TEMPLATE_ID`. Otherwise skip — the script makes one for you.
4. Run the **`setup`** function once (Run ▸ setup). Approve the permission prompt
   (Drive + Docs). Check **View ▸ Logs** for the link to your new
   *"Apex Abstracts — Title Report TEMPLATE"* Doc — restyle it however you like; just keep
   the `{{PLACEHOLDERS}}`.
5. **Deploy ▸ New deployment ▸ Web app.**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**  ← required so the app can reach it
   - Click **Deploy**, authorize, and **copy the Web app URL** (ends in `/exec`).
6. In **Apex Title Studio**, click the **⚙** next to *Generate Google Doc* and paste that
   URL. It's saved on your device. Done.

Now "Generate Google Doc for review" creates a real Doc in your Drive from the template.

## Notes
- **Optional output folder:** put a Drive folder ID in `CONFIG.OUTPUT_FOLDER_ID` to collect
  all generated reports in one place.
- **Restyling:** edit the template Doc's fonts/branding freely. The placeholders
  (`{{PROPERTY}}`, `{{CHAIN}}`, …) are the contract; the script fills them.
- **Re-deploy after editing `Code.gs`:** Deploy ▸ Manage deployments ▸ edit ▸ new version.
- **Health check:** open the `/exec` URL in a browser — it returns JSON with your template ID.
- **Fallback:** if the endpoint is unset or unreachable, the app downloads an importable
  `.doc` instead, so the workflow never blocks (works offline).

## Placeholders the app sends
`DRAFT_BANNER`, `SEARCH_DATE`, `INDEX_DATE`, `PROPERTY`, `CONDO_SUBDIVISION`, `HUNDRED`,
`PARCEL_NUMBER`, `UNIT_LOT`, `BLOCK`, `SECTION`, `SELLERS_OWNERS`, `BUYERS_BORROWERS`,
`DEED_RECORD`, `TAX_STATUS`, `LEGAL_DESCRIPTION`, `CHAIN`, `MORTGAGES`, `ASSIGNMENTS`,
`SATISFACTIONS`, `JUDGMENTS`, `FEDERAL_LIEN`, `OTHER_LIENS`.
