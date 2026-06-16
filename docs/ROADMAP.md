# Apex Abstracts — Roadmap & Recommendations (Tasks 3–7)

Strategic answers and a build order for everything beyond the two shipped HTML files. Scope
for the current cycle was **testing + demo data + this roadmap only**; nothing below is built
yet. Decisions already made with the owner: **automation = GoHighLevel-native**, **scraper =
co-pilot assist only**.

---

## Task 3 — Do we need a container (Docker) around these two files?

**No. Do not containerize the client-facing tool.** Both files are single, offline,
double-click HTML documents with zero dependencies. Their entire value proposition is "save
it to your Desktop, open it in any browser, works offline forever, nothing leaves your
machine." A Docker container would:
- force Zach to install/run a runtime and hit `localhost` instead of double-clicking a file,
- break the offline/portable promise and the "no data leaves your computer" privacy story,
- add maintenance and an attack surface for **zero** functional gain.

**Where containers *do* earn their place — later, and only server-side:** if/when we build
the GoHighLevel-adjacent automation worker or the co-pilot scraper service, *those* backend
pieces are good Docker candidates (reproducible Playwright/Chromium env, scheduled jobs,
secret management). That is infrastructure Zach never touches — not a wrapper around the tool.

### What actually reduces Zach's manual work (the real intent of Task 3)
Ranked by leverage ÷ effort:
1. **Auto-match satisfactions/releases to mortgages** (the §Task 7 accuracy fix) — removes
   the one manual reconciliation step.
2. **Co-pilot input assist** (Task 6) — pre-fill the county portal search and pull the
   exported results into the paste box, removing re-typing.
3. **Post-processing automation** (Task 5) — review/sign → branded delivery → CRM logging →
   follow-ups, so Zach stops hand-driving the back half of every order.
4. **Pre-Print verification checklist** — stops a report going out missing tax status /
   opinion / legal.

---

## Task 4 — Will the one-click download hold up?

**Yes — verified.** The setup page embeds the form filler as a base64 blob, decodes it to a
Blob, and downloads it as `Apex_Title_Form_Filler.html`. We decoded that payload and
**SHA-256-matched it byte-for-byte** to the actual tool file. Zach clicks **Download the
tool** and gets a complete, working, standalone tool — no install, no account, no network.

**It is "secured" in the senses that matter for this product:** no backend to breach, no
credentials, no data transmission, runs in the browser sandbox. The data-never-leaves-the-
machine property is itself the security story for a shop handling owner PII.

**Distribution hardening (recommended, not blockers):**
- **Host the setup page over HTTPS** (e.g., a simple static host) so the download has a
  trustworthy origin and isn't flagged by the browser.
- **Visible version/build stamp + checksum** on both files, so Zach (and we) can confirm he's
  on the current build — a distributed offline file is otherwise impossible to track.
- **A lightweight "check for updates" link** (opens the hosted setup page) since we can't
  push updates to a file already on his Desktop.
- **Email deliverability:** many mail filters strip or quarantine `.html` attachments. If we
  ever email the tool, send a **link to the hosted setup page** (or a `.zip`) rather than the
  raw `.html`.
- **Optional:** a one-line integrity self-check in the tool footer.

---

## Task 5 — Wraparound automation (GoHighLevel-native)

Goal: take work off Zach on **both sides** of the form filler. Leads come in and follow-ups
go out inside **GoHighLevel (GHL)**, which is already the CRM of record, so we build natively
there (GHL Workflows/Triggers + its email/SMS) and only reach for glue (Make/Zapier) at the
one seam GHL can't see: the offline HTML tool.

### Before the form filler
1. **Instant lead autoresponse (<2-hour SLA).** Trigger: inbound lead via email or a GHL
   form/inbound webhook. Action: GHL Workflow sends an autoresponse in Zach's voice + tone,
   tags the contact, and creates an Opportunity in the pipeline. *Rationale: missed leads go
   cold fast; sub-2-hour first-touch is the difference between winning and losing the order.*
   - Build: GHL Workflow (trigger → email/SMS → tag → create opportunity). Draft 2–3 voice
     templates with Zach; keep them as GHL email templates.
2. **Daily buyer-research digest.** A scheduled job analyzes historical orders / relationships
   / county activity, scores prospects, and **alerts Zach to any candidate ≥80% confidence.**
   - Build: scheduled worker (server-side; good Docker candidate) → writes scored leads into
     GHL as tasks/opportunities and emails a daily digest. Start rules-based (repeat clients,
     recent activity, geography), add scoring later. Keep the "what data, what model" decision
     for its own cycle.

### After the form filler
3. **Notify Zach to review & sign.** When a report is completed, the tool exports the report
   (PDF + a small JSON/order-log record). A watcher posts it into GHL and fires a "Ready for
   review" task/notification.
4. **On sign → Apex-branded client delivery.** Once Zach approves/signs, a GHL Workflow sends
   the professionally-templated, Apex-branded email with the report to the client.
5. **Log everything in GHL.** Contact, order, and the signed document recorded against the
   opportunity; pipeline stage advanced.
6. **Follow-up sequence.** If the client doesn't respond, automated follow-ups at **1 / 3 / 7
   days**, all logged, auto-stopping on reply. Native GHL Workflow with wait steps.

### The one integration seam to design deliberately
The form filler is **offline by design** and GHL lives in the cloud — they don't talk
natively. Bridge it without breaking the offline promise:
- **Option A (lightest):** add an **"Export order record"** action to the tool that produces
  a JSON + PDF; Zach drops it into a watched folder / uploads it once, and a Make/Zapier
  scenario or GHL inbound webhook ingests it.
- **Option B:** a small **"Send to Apex"** button that POSTs the order JSON to a GHL inbound
  webhook (this *does* send data off-machine — make it explicit and opt-in, since it changes
  the privacy story).
Recommend **Option A** to preserve "nothing leaves your computer" as the default.

**Connectors available when we build (not wired this cycle):** GoHighLevel (via the
Windsor.ai connector), Gmail, and Make/Zapier as optional glue at the seam.

---

## Task 6 — Is a Delaware scraper worth building?

**Worth it as a *co-pilot assist* only — not a headless bulk scraper.** Public land/court
records are not copyrightable, but **automated access can still breach a portal's Terms of
Use**, and where a site has logins/subscriptions or CAPTCHAs, automated/bypassing access
raises CFAA-type risk. The cost/benefit and legal exposure differ sharply by portal:

| Portal | Access | Co-pilot stance |
|---|---|---|
| **New Castle County Document Search** (`newcastlede.gov/144`) | Public, free, no login | Pre-fill the search URL / open it; parse an **exported/downloaded** result into the paste box. |
| **NCC parcel / tax** (`newcastlede.gov`) | Public | Same — open & assist. |
| **Delaware CourtConnect — judgments** (`courtconnect.courts.delaware.gov`) | Public, free | Open & assist; this is the civil-judgment source the report expects. |
| **Kent County GovOS** (`kent.de.ds.search.govos.com`) | Public search, but commercial/subscription layers & ToS | **Manual.** Open the portal for Zach; do not automate behind it. |
| **Sussex County LandmarkWeb** (`deeds.sussexcountyde.gov`) | Guest search; ToS commonly restricts automated access | **Manual.** Open & assist only. |

**Recommended co-pilot scope (no ToS violation, still saves real time):**
1. From a parcel/owner/address, **build and open the correct county search URL** pre-filled.
2. Let Zach run the search and **export/download** the results (CSV/print) himself.
3. **Auto-parse that export into the form filler** (the import box already does this).
- No headless crawling of the protected portals, no auth/CAPTCHA bypass, no bulk hammering.

**Before going beyond co-pilot** (e.g., automating the public NCC/CourtConnect endpoints
headlessly), get a **formal per-portal ToS review** and add rate-limiting + identification.
The Playwright/PyMuPDF script in `apex_abstracts__scraper_phase.md` is a reasonable *starting
skeleton* for that future server-side worker, but its selectors are placeholders and it
should not be pointed at the subscription portals.

**Net:** the paste/CSV import already removes most re-typing; the co-pilot adds URL pre-fill
and export-parsing for a large practical win at near-zero legal risk. Full automation is not
worth the exposure or the maintenance treadmill of dynamic government portals right now.

---

## Task 7 — High-leverage gaps (big improvement, low overhead)

1. **Auto-match satisfactions/releases & assignments to their mortgages/liens.** The single
   biggest accuracy win; closes the SOP "match releases" step (see TEST_REPORT §4). Match by
   party + book/page + instrument; move/annotate the satisfied item.
2. **Pre-Print verification checklist gate.** A short confirm step (tax status set? legal
   description verified? opinion chosen?) before Print, so nothing ships incomplete.
3. **E&O / liability disclaimer language.** Make explicit on the report that it is a title
   **abstract**, not a title **opinion or title insurance** — protects Apex.
4. **Persisted completed-order log (CSV/JSON).** Feeds both the GHL handoff (Task 5) and the
   daily research digest; gives Apex a searchable history with zero extra effort.
5. **Branding + version polish.** Logo, real contact details, and a visible version/build
   stamp (also supports Task 4 update-tracking).
6. **Expand the doc-type abbreviation map** + surface skipped rows more loudly in the review
   footer (so a stray `SAT`/shorthand isn't silently dropped).

---

## Suggested build order (post-demo)
1. Satisfaction/assignment auto-matching + verification checklist (accuracy & trust).
2. Order-log export + GHL "after" automation (review/sign → branded delivery → logging → follow-ups).
3. Co-pilot input assist (URL pre-fill + export parsing) for the public DE sources.
4. GHL "before" automation (instant autoresponse; then the daily research digest).
5. Distribution hardening (hosted HTTPS setup page, version stamp, update check).

## Repo hygiene (proposed, not executed)
This repo still contains the archived **customer-portal-generator** scaffolding
(`src/`, `db/`, `templates/`, `output/`, and a Next.js/sqlite/stripe `package.json`/
`README.md`) unrelated to the Apex tool. Recommend moving it into an `archive/` folder (or a
separate branch) and rewriting `README.md` around the Apex Title Form Filler, so the repo
reads as the product it now is. Non-destructive; awaiting go-ahead before touching it.
