// render_report.mjs — address-trial harness.
//
// Runs the SHIPPED Apex Title Studio pipeline (extractSource → composeNorthStar → reconcile →
// analyzeChain → buildReport) headlessly in Node and writes a standalone, Apex-branded
// North-Star report per property. The only new code is a thin per-vendor ADAPTER that maps a
// "Public Data Records — Property Report" PDF (label/value on separate lines, with Lot / Loans /
// Deeds / Tax sections) into the labeled + tab-separated-index text the shipped extractor reads.
// In Phase 2 the fine-tuned parser model replaces this adapter; the deterministic core is unchanged.
//
//   node tools/render_report.mjs
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pdfToText } from "./pdf_to_text.mjs";
import { runPipeline, STYLE } from "./pipeline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/* ---- the per-vendor adapter: Public Data Records report -> shipped source zones --------- */
const MONTHS = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  january:"01",february:"02",march:"03",april:"04",june:"06",july:"07",august:"08",september:"09",october:"10",november:"11",december:"12"};
function normDate(s) {
  if (!s) return "";
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${m[3]}`;
  m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/); if (m && MONTHS[m[1].toLowerCase()]) return `${MONTHS[m[1].toLowerCase()]}/${m[2].padStart(2,"0")}/${m[3]}`;
  m = s.match(/([A-Za-z]+)\.?\s+(\d{4})/); if (m && MONTHS[m[1].toLowerCase()]) return `${MONTHS[m[1].toLowerCase()]}/01/${m[2]}`;
  return s.trim();
}

function adapt(raw, addr) {
  const L = raw.split(/\r?\n/).map(x => x.trim());
  // value on the line after a label that stands alone (the PDF's two-line label/value pattern)
  const after = (label) => {
    for (let i = 0; i < L.length; i++) {
      if (L[i].toLowerCase().replace(/:$/,"") === label.toLowerCase()) {
        for (let j = i + 1; j < L.length; j++) if (L[j]) return L[j];
      }
    }
    return "";
  };
  const sectionLines = (head, stopRe) => {
    const out = []; let on = false;
    for (const line of L) {
      if (!on) { if (line === head) on = true; continue; }
      if (stopRe.test(line)) break;
      out.push(line);
    }
    return out;
  };

  const parcel = after("PARCEL NUMBER");
  const legal = after("LEGAL DESCRIPTION");
  const subdivision = after("SUBDIVISION NAME");
  const county = (() => { // COUNTY appears in Lot Information as its own label
    for (let i = 0; i < L.length; i++) if (L[i] === "COUNTY" && /county/i.test(L[i+1] || "") === false && L[i+1]) return L[i+1];
    return "";
  })();

  // Ownership Timeline -> ordered owners (newest first) with purchase dates/prices
  const tl = sectionLines("Ownership Timeline", /^Property Details$/);
  const owners = [];
  for (let i = 0; i < tl.length; i++) {
    if (/^(\d{4}|N\/A)\s*-\s*(Present|\d{4})$/.test(tl[i])) {
      const name = tl[i + 1] || "";
      let date = "", price = "";
      for (let j = i + 2; j < Math.min(i + 6, tl.length); j++) {
        if (/DATE OF PURCHASE/i.test(tl[j])) date = tl[j + 1] || "";
        if (/PURCHASE PRICE/i.test(tl[j])) price = tl[j + 1] || "";
      }
      if (name && !/^(DATE OF PURCHASE|PURCHASE PRICE)$/i.test(name)) owners.push({ name, date: normDate(date), price });
    }
  }
  const owner = owners[0] ? owners[0].name : after("MOST RECENT OWNER OR RESIDENT");

  // Deeds & Sales (most recent recorded conveyance, with instrument/doc type)
  const ds = sectionLines("Deeds & Sales Records", /^(Property Taxes|Building Permits)$/);
  let recentDeed = null;
  if (ds.length && !/no sales records/i.test(ds[0])) {
    const grab = (lbl) => { const k = ds.findIndex(x => x.toLowerCase() === lbl.toLowerCase()); return k >= 0 ? (ds[k + 1] || "") : ""; };
    const seller = (() => { const k = ds.findIndex(x => x === "SELLER"); if (k < 0) return ""; // skip "Individual(s)" type tags
      for (let j = k + 1; j < ds.length; j++) if (ds[j] && !/^(Individual|Limited Liability|Company|Trust|Corporation)/i.test(ds[j])) return ds[j]; return ""; })();
    const buyer = (() => { const k = ds.findIndex(x => x === "BUYER"); if (k < 0) return "";
      for (let j = k + 1; j < ds.length; j++) if (ds[j] && !/^(Individual|Limited Liability|Company|Trust|Corporation)/i.test(ds[j])) return ds[j]; return ""; })();
    recentDeed = { date: normDate(ds[0]), docType: (ds[1] || "Deed"), seller, buyer,
      instrument: grab("INSTRUMENT #") || grab("DOCUMENT #"), block: grab("BLOCK") };
  }

  // First Loan Position -> a current mortgage (no satisfaction shown in this source => OPEN)
  const ln = sectionLines("First Loan Position", /^(Home Value|Property Taxes|Historical Market Value)$/);
  let loan = null;
  if (ln.length) {
    const g = (lbl) => { const k = ln.findIndex(x => x.toLowerCase() === lbl.toLowerCase()); return k >= 0 ? (ln[k + 1] || "") : ""; };
    const lender = g("LENDER NAME");
    if (lender) loan = { lender, amount: g("LOAN AMOUNT"), date: normDate(g("RECORDING DATE")), doc: g("DOCUMENT NUMBER") };
  }

  // ---- build the chain rows (newest -> oldest) as a tab index the shipped extractor reads ----
  const TAB = "\t";
  const rows = [["Grantor","Grantee","Record Date","Doc Type","Instrument","Amount"].join(TAB)];
  const used = new Set();
  if (recentDeed && recentDeed.buyer) {
    rows.push([recentDeed.seller || (owners[1] ? owners[1].name : ""), recentDeed.buyer, recentDeed.date,
      recentDeed.docType, recentDeed.instrument, ""].join(TAB));
    used.add(0);
  }
  // older transfers from the ownership timeline (grantor = next-older owner)
  for (let i = used.size ? 1 : 0; i < owners.length; i++) {
    const grantee = owners[i].name, grantor = owners[i + 1] ? owners[i + 1].name : "";
    if (!owners[i].date && !owners[i].price) continue;
    rows.push([grantor, grantee, owners[i].date, "Deed", "", owners[i].price || ""].join(TAB));
  }
  // mortgage row (borrower = owner at the time the loan recorded; here the recent owner/borrower)
  const borrower = loan ? (owners.find(o => o.date && loan.date && o.date.slice(-4) === loan.date.slice(-4)) || {}).name || owner : "";
  if (loan) rows.push([borrower, loan.lender, loan.date, "Mortgage", loan.doc, loan.amount].join(TAB));

  const recorder = [
    `PROPERTY: ${addr}`,
    parcel ? `PARCEL NUMBER: ${parcel}` : "",
    owner ? `SELLERS/OWNERS: ${owner}` : "",
    subdivision ? `SUBDIVISION: ${subdivision}` : "",
    recentDeed && recentDeed.block ? `BLOCK: ${recentDeed.block}` : "",
    legal ? `LEGAL DESCRIPTION: ${legal}` : "",
    recentDeed ? `DEED RECORD: Instrument ${recentDeed.instrument || "—"} (${recentDeed.docType}, ${recentDeed.date})` : "",
    "",
    rows.join("\n"),
  ].filter(Boolean).join("\n");

  const assessed = after("ASSESSED VALUE") || after("TOTAL VALUE");
  const tax2025 = (() => { const k = L.findIndex(x => x === "PROPERTY TAX (2025)"); return k >= 0 ? L[k + 1] : ""; })();
  const tax = [
    `PARCEL NUMBER: ${parcel}`,
    assessed ? `ASSESSED VALUE: ${assessed}` : "",
    tax2025 ? `Most recent property tax (2025): ${tax2025}` : "",
    "Tax status: not stated in source report — obtain County tax certification to confirm current/delinquent.",
  ].filter(Boolean).join("\n");

  const liensClear = /NO SOLAR, MECHANICAL, TAX, OR TRANSACTION LIENS FOUND/i.test(raw);
  const court = "JUDGMENT: none found in source report. Confirm via Prothonotary / CourtConnect search.";
  const statelien = liensClear
    ? "No state or federal tax liens found in source report. Confirm via Delaware Division of Revenue / IRS search."
    : "State tax-lien status not stated in source report — verify.";

  return { store: { recorder, tax, court, statelien }, meta: { parcel, owner, loan, ownersCount: owners.length, liensClear } };
}

/* ---- run all three trials -------------------------------------------------------------- */
const TRIALS = [
  { slug: "604-fallon-ave", addr: "604 Fallon Ave, Wilmington, DE 19804", fileId: "APX-2026-0042" },
  { slug: "1402-stoneleigh-rd", addr: "1402 Stoneleigh Rd, Wilmington, DE 19803", fileId: "APX-2026-0043" },
  { slug: "1500-n-franklin-st", addr: "1500 N Franklin St, Wilmington, DE 19806", fileId: "APX-2026-0044" },
];
const SEARCH_DATE = "June 22, 2026";

for (const t of TRIALS) {
  const dir = path.join(ROOT, "demo/address-trials", t.slug);
  const raw = fs.readFileSync(path.join(dir, "source.txt"), "utf8");
  const { store, meta } = adapt(raw, t.addr);
  fs.writeFileSync(path.join(dir, "adapted_sources.txt"),
    Object.entries(store).map(([k, v]) => `===== ${k} =====\n${v}`).join("\n\n"));
  const { html, model } = runPipeline(store, {
    fileId: t.fileId, searchDate: SEARCH_DATE,
    indexDate: "Per source property report (prepared 06/22/2026)",
  });
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Apex Title Search Report — ${t.addr}</title><style>${STYLE}</style></head><body class="printing">${html}</body></html>`;
  fs.writeFileSync(path.join(dir, "report.html"), page);
  const open = model.mortgages.filter(m => m.status === "Open").length;
  const rel = model.mortgages.filter(m => m.status === "Released").length;
  console.log(`✓ ${t.slug}: chain ${model.chain.length}, mortgages ${model.mortgages.length} (${open} open/${rel} released), judgments ${model.judgments.length}, liens ${model.otherLiens.length + model.federalLien.length}` +
    (model.chainNotes.length ? `, chain-notes ${model.chainNotes.length}` : "") + `  →  ${path.relative(ROOT, path.join(dir, "report.html"))}`);
}
