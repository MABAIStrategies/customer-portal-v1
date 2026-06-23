// orchestrate.mjs — address -> normalized source store -> shipped pipeline -> { model, html }.
//
// SOURCE MAP (Phase 1):
//   assessor  : live over plain HTTP (lib/sources/parcel.mjs)            [verified here]
//   recorder  : Cloudflare Browser-Rendering Worker (PAX login+search)   [deploy-gated]
//   court     : Cloudflare Browser-Rendering Worker (CourtConnect)       [deploy-gated]
//   revenue   : Cloudflare Browser-Rendering Worker (DE Revenue)         [deploy-gated]
// The Worker URL is read from CF_WORKER_URL; until it's set, the browser-driven
// sources return honest "pending" notes so the report never fabricates a lien.
import { Session } from "./http.mjs";
import { lookupParcel } from "./sources/parcel.mjs";
import { runPipeline } from "../../tools/pipeline.mjs";

const pad = (d) => { const m = (d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${m[3]}` : (d || ""); };
const yr = (d) => { const m = (d || "").match(/(\d{4})/); return m ? +m[1] : 0; };

// assessor record -> recorder/tax source-zone text the shipped extractor reads
function assessorToZones(addr, r, browser) {
  const TAB = "\t";
  const deeds = [...(r.deedHistory || [])].sort((a, b) => yr(a.saleDate) - yr(b.saleDate));
  const rows = [["Grantor", "Grantee", "Record Date", "Doc Type", "Instrument", "Amount"].join(TAB)];
  deeds.forEach((d, i) => {
    const grantor = i > 0 ? deeds[i - 1].grantee : "";
    rows.push([grantor, d.grantee, pad(d.saleDate), "Deed", d.book ? `Bk ${d.book}/Pg ${d.page}` : "", d.amount || ""].join(TAB));
  });
  const recorder = [
    `PROPERTY: ${r.address || addr}`,
    r.parcel && `PARCEL NUMBER: ${r.parcel}`,
    r.owner && `SELLERS/OWNERS: ${r.owner}`,
    r.subdivision && `SUBDIVISION: ${r.subdivision}`,
    r.lot && `LOT: ${r.lot}`,
    `LEGAL DESCRIPTION: Lot ${r.lot || "—"}, ${r.subdivision || "—"} (per NCC assessor; full metes-and-bounds to be confirmed from the recorded deed)`,
    "",
    rows.join("\n"),
    "",
    browser.recorder || "MORTGAGE: Recorder (PAX) open-mortgage/satisfaction search pending — runs on the Cloudflare Browser-Rendering worker; confirm before delivery.",
  ].filter(Boolean).join("\n");
  const tax = [
    `PARCEL NUMBER: ${r.parcel}`,
    r.assessmentTotal && `ASSESSED VALUE: $${r.assessmentTotal}`,
    `Tax status: ${r.taxStatus} (NCC assessor county/school balance as of search date)`,
  ].filter(Boolean).join("\n");
  return { recorder, tax,
    court: browser.court || "JUDGMENT: Prothonotary / CourtConnect civil-judgment search pending — runs on the Cloudflare Browser-Rendering worker.",
    statelien: browser.statelien || "State and federal tax-lien search pending — DE Division of Revenue (state) + county Recorder (federal) on the worker." };
}

// call the deployed Cloudflare Browser-Rendering worker for the browser-driven sources
async function browserSources(owner, parcel) {
  const url = process.env.CF_WORKER_URL;
  if (!url) return {};
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, parcel, sources: ["recorder", "court", "revenue"] }) });
    if (!res.ok) return {};
    return await res.json(); // { recorder, court, statelien } as source-zone text
  } catch { return {}; }
}

export async function generateReport(address, opts = {}) {
  const assessor = await lookupParcel(address, new Session());
  if (assessor.error) return { ok: false, stage: "assessor", error: assessor.error, address };
  const browser = await browserSources(assessor.owner, assessor.parcel);
  const store = assessorToZones(address, assessor, browser);
  const SEARCH_DATE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const { html, model } = runPipeline(store, {
    fileId: opts.fileId || `APX-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`,
    searchDate: SEARCH_DATE, indexDate: "Live NCC assessor (Parcel Search) as of search date",
  });
  return { ok: true, address, assessor, store, model, html, browserWired: !!process.env.CF_WORKER_URL };
}
