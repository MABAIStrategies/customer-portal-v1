// run_demo.mjs — LIVE address → Apex North-Star report.
//
// Phase-1 engine (in-sandbox path): takes a bare address, scrapes the public NCC
// sources live, maps them into the four shipped source-zone texts, and runs the SAME
// deterministic pipeline the app ships (via tools/pipeline.mjs) to render an
// Apex-branded report. The recorder (PAX) mortgage/satisfaction layer runs on a
// browser-capable host (see lib/sources/recorder.mjs) and is flagged pending here.
//
//   node run_demo.mjs
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Session } from "./lib/http.mjs";
import { lookupParcel } from "./lib/sources/parcel.mjs";
import { runPipeline, renderPage } from "../tools/pipeline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });

const pad = (d) => {
  const m = (d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}` : (d || "");
};
const yr = (d) => { const m = (d || "").match(/(\d{4})/); return m ? +m[1] : 0; };

// assessor record -> the four shipped source-zone texts
function toStore(addr, r) {
  const TAB = "\t";
  // deed history: assessor lists grantee + book/page + date + amount (oldest-first).
  // grantor of each transfer = grantee of the next-older deed.
  const deeds = [...(r.deedHistory || [])].sort((a, b) => yr(a.saleDate) - yr(b.saleDate));
  const rows = [["Grantor", "Grantee", "Record Date", "Doc Type", "Instrument", "Amount"].join(TAB)];
  deeds.forEach((d, i) => {
    const grantor = i > 0 ? deeds[i - 1].grantee : "";
    const instr = d.book ? `Bk ${d.book}/Pg ${d.page}` : "";
    rows.push([grantor, d.grantee, pad(d.saleDate), "Deed", instr, d.amount || ""].join(TAB));
  });

  const recorder = [
    `PROPERTY: ${r.address || addr}`,
    r.parcel ? `PARCEL NUMBER: ${r.parcel}` : "",
    r.owner ? `SELLERS/OWNERS: ${r.owner}` : "",
    r.subdivision ? `SUBDIVISION: ${r.subdivision}` : "",
    r.lot ? `LOT: ${r.lot}` : "",
    `LEGAL DESCRIPTION: Lot ${r.lot || "—"}, ${r.subdivision || "—"} (per NCC assessor; full metes-and-bounds to be confirmed from the recorded deed)`,
    "",
    rows.join("\n"),
    "",
    "MORTGAGE: Recorder (PAX) open-mortgage/satisfaction search pending — retrieved on the browser-capable backend; confirm before delivery.",
  ].filter(Boolean).join("\n");

  const tax = [
    `PARCEL NUMBER: ${r.parcel}`,
    r.assessmentTotal ? `ASSESSED VALUE: $${r.assessmentTotal}` : "",
    `Tax status: ${r.taxStatus} (NCC assessor county/school balance as of search date)`,
  ].filter(Boolean).join("\n");

  const court = "JUDGMENT: Prothonotary / CourtConnect civil-judgment search pending — run by owner name before delivery.";
  const statelien = "State and federal tax-lien search pending — DE Division of Revenue (state) and county Recorder (federal) before delivery.";
  return { recorder, tax, court, statelien };
}

const ADDRESSES = [
  { slug: "22-winburne-dr", addr: "22 Winburne Drive, New Castle DE", fileId: "APX-2026-0045" },
  { slug: "226-n-star-rd", addr: "226 N Star Road, Newark DE", fileId: "APX-2026-0046" },
  { slug: "1400-thornhill-dr", addr: "1400 Thornhill Drive, Newark DE", fileId: "APX-2026-0047" },
];
const SEARCH_DATE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

for (const a of ADDRESSES) {
  try {
    const r = await lookupParcel(a.addr, new Session());
    if (r.error) { console.log(`✗ ${a.slug}: assessor lookup failed (${r.error})`); continue; }
    const store = toStore(a.addr, r);
    const { html, model } = runPipeline(store, {
      fileId: a.fileId, searchDate: SEARCH_DATE,
      indexDate: "Live NCC assessor (Parcel Search) as of search date",
    });
    const file = path.join(OUT, `${a.slug}.html`);
    fs.writeFileSync(file, renderPage(html, `Apex Title Search Report — ${a.addr}`));
    const open = model.mortgages.filter(m => m.status === "Open").length;
    console.log(`✓ ${a.slug}: owner ${JSON.stringify(r.owner)} parcel ${r.parcel} | chain ${model.chain.length}, mortgages ${model.mortgages.length} (${open} open), tax "${r.taxStatus}"  →  out/${a.slug}.html`);
  } catch (e) {
    console.log(`✗ ${a.slug}: ${e.message}`);
  }
}
