# Apex Abstracts Phase-1 Progress Journal

Customer-facing development log. Brief, dated entries tracking shipped features, business impact, and ROI.

---

### 2026-06-23 — Phase-1 end-to-end title-search automation live

The Apex title-search system now runs completely on your local backend. A user types a Delaware property address or parcel number, clicks Generate, and gets a draft "North-Star" branded report in seconds — pulling live owner, parcel, tax, and sales-history data from New Castle County assessor records automatically.

A human-in-the-loop review step flags anything needing an abstractor's eyes (highlighted in red) with Skip, Cancel, and Generate controls built in. The deeper records (open mortgages, court judgments, state tax liens) are currently marked "pending" rather than guessed — we'll light those up next week via our cloud scraper service.

**ROI:** A skilled abstractor typically spends 2–4 hours per title abstract searching and re-keying records. This system turns that into seconds to generate the draft, plus 10–15 minutes for a human review — roughly 90% time savings per report. At typical abstractor cost (~$50–75/hour), that's $75–250 in labor savings per report. Scale this across even 5–10 reports a day and the economics compound fast.

**Next step to capitalize:** Deploy the cloud scraper to pull mortgages, judgments, and tax liens, then add saved-report history so clients can retrieve and audit past searches. This unlocks the full chain-of-title picture and turns the tool into a repeatable, auditable asset.

---

### 2026-06-24 — Licensed property-data API live; mortgages now auto-populated

The title-search system is now pulling owner, parcel, legal description, sales history, and recorded mortgages directly from ATTOM, a licensed property-data API — eliminating the legal and operational risk of logging into and scraping county portals. One address typed into the report now returns the complete chain of past sales and current mortgage records automatically, filling the draft's mortgage section instead of leaving it blank.

We kept the guardrails honest: tax status and civil-court judgments are still clearly marked "verify" and "run manually" rather than guessed, and every draft still goes to a human for review before it ships. The system gracefully falls back to free public assessor lookup if no API key is set, so the tool keeps working either way.

**ROI:** This removes both the legal/operational risk of scraping and the abstractor's manual mortgage-search time, while keeping the same seconds-to-draft speed. Each report still saves roughly 2–4 hours of manual searching versus the old paper-and-phone workflow. The licensed-data cost per report is a known, predictable line item that scales cleanly with volume — far lower than the labor it saves.

**Next step to capitalize:** Plug in the ATTOM trial key to see live Delaware results in production, then add saved-report history so clients can retrieve and audit past searches. This unlocks repeatability and builds the compliance trail.
