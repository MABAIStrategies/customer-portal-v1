# Apex Abstracts — Setup (Dead Simple)

**One address in. A finished title report out.**

Type a single Delaware address, click **Generate**, review the items flagged in
red, and download an Apex-branded PDF or Google Doc. The work that used to take
an afternoon now takes a coffee break.

**Why it's worth it:** ~2–4 hours saved per title report versus manual
abstracting. One address is all you type — the tool pulls the Recorder,
Assessment/Tax, Court, and State-Lien records and assembles your North-Star
report. Everything runs locally on your machine, so client data never leaves it.

---

## First-time setup (about 5 minutes, once)

### 1. Install Node.js

The app runs on Node.js. You only install this once.

- Go to **https://nodejs.org**
- Download the **LTS** version for your computer
- Run the installer and accept the defaults

> Not sure if you already have it? That's fine — the launcher checks for you and
> tells you what to do.

### 2. Double-click the launcher for your computer

In this folder you'll find three launchers. Use the one for your operating system:

| Your computer | Double-click this file |
|---------------|------------------------|
| **macOS**     | `start_apex.command`   |
| **Windows**   | `start_apex.bat`       |
| **Linux**     | `start_apex.sh`        |

The launcher starts the app and **opens your browser automatically**.

> **macOS note:** the very first time, you may need to right-click
> `start_apex.command` → **Open** → **Open** to approve it (this is a one-time
> macOS security prompt).

### 3. Use it

Your browser opens to **http://localhost:8787**.

1. Type a Delaware address (or a parcel number) in the search box.
2. Click **Generate**.
3. Review the items highlighted in **red** — these are the ones that need your
   oversight (open mortgages, possible other-property, chain notes, anything to
   verify). Nothing is hidden and nothing is auto-excluded; you decide.
4. Click **Download PDF** for an Apex-branded report, or **Generate Doc** for a
   Google Doc to sign off.

**Keep the launcher window open** while you work — closing it stops the app.

---

## Want a quick guided tour first?

Open **`Apex_Onboarding.html`** (double-click it). It's a self-contained,
interactive walkthrough of the whole flow — enter address → Generate → review the
red flags → download — and it works even before the app is running. The big
**Launch the app** button on that page opens http://localhost:8787 for you.

---

## Troubleshooting

- **Browser didn't open / page won't load:** make sure the launcher window is
  still open, then go to **http://localhost:8787** manually. If it still won't
  load, close the window and double-click the launcher again. If the launcher
  reports "Node.js is not installed," complete step 1 above and retry.

---

*Apex Abstracts · Zach Paris · zmparis.electric@gmail.com · 302.757.2043*
