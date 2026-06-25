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
import { lookupAttom } from "./sources/attom.mjs";
import { runPipeline } from "../../tools/pipeline.mjs";

const pad = (d) => { const m = (d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${m[3]}` : (d || ""); };
const yr = (d) => { const m = (d || "").match(/(\d{4})/); return m ? +m[1] : 0; };

// normalized record (ATTOM or assessor) -> the four shipped source-zone texts.
// ATTOM carries explicit grantor/grantee + mortgages; the assessor carries grantee-only
// deed history (grantor derived from the next-older owner) and no mortgages.
function recordToZones(addr, r) {
  const TAB = "\t";
  const deeds = [...(r.deedHistory || [])].sort((a, b) => yr(a.saleDate) - yr(b.saleDate));
  const rows = [["Grantor", "Grantee", "Record Date", "Doc Type", "Instrument", "Amount"].join(TAB)];
  deeds.forEach((d, i) => {
    const grantor = d.grantor || (i > 0 ? deeds[i - 1].grantee : "");
    const instr = d.doc || (d.book ? `Bk ${d.book}/Pg ${d.page}` : "");
    rows.push([grantor, d.grantee, pad(d.saleDate), "Deed", instr, d.amount || ""].join(TAB));
  });
  // real mortgage rows when the source has them (ATTOM); else an honest "confirm" note
  const morts = r.mortgages || [];
  morts.forEach(m => rows.push([m.borrower || r.owner, m.lender, pad(m.date), "Mortgage", m.doc || "", m.amount || ""].join(TAB)));
  const isAttom = r.source === "attom";
  const legal = r.legal
    ? `LEGAL DESCRIPTION: ${r.legal}${isAttom ? " (per ATTOM; confirm full metes-and-bounds from the recorded deed)" : ""}`
    : `LEGAL DESCRIPTION: Lot ${r.lot || "—"}, ${r.subdivision || "—"} (per NCC assessor; confirm full metes-and-bounds from the recorded deed)`;
  const recorder = [
    `PROPERTY: ${r.address || addr}`,
    r.parcel && `PARCEL NUMBER: ${r.parcel}`,
    r.owner && `SELLERS/OWNERS: ${r.owner}`,
    r.subdivision && `SUBDIVISION: ${r.subdivision}`,
    r.lot && `LOT: ${r.lot}`,
    legal,
    "",
    rows.join("\n"),
    morts.length ? "" : `MORTGAGE: no open mortgage found in ${isAttom ? "ATTOM data" : "assessor data"} — confirm against the recorder before delivery.`,
  ].filter(Boolean).join("\n");
  const tax = [
    `PARCEL NUMBER: ${r.parcel}`,
    r.assessmentTotal && `ASSESSED VALUE: $${r.assessmentTotal}`,
    `Tax status: ${r.taxStatus}`,
  ].filter(Boolean).join("\n");
  return {
    recorder, tax,
    court: "JUDGMENT: civil-judgment search not auto-retrieved — run the Prothonotary / CourtConnect search manually before delivery.",
    statelien: "State/federal tax-lien search not auto-retrieved — run DE Division of Revenue (state) + county Recorder (federal) manually before delivery.",
  };
}

// pick the retrieval source: ATTOM (licensed) when keyed, else the live assessor scrape (fallback)
async function retrieve(address) {
  if (process.env.ATTOM_API_KEY) {
    const a = await lookupAttom(address);
    if (!a.error) return a;
    // fall through to assessor if ATTOM has no match
  }
  const assessor = await lookupParcel(address, new Session());
  return assessor.error ? { error: assessor.error } : assessor;
}

export async function generateReport(address, opts = {}) {
  const rec = await retrieve(address);
  if (rec.error) return { ok: false, stage: "retrieve", error: rec.error, address };
  const store = recordToZones(address, rec);
  const SEARCH_DATE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const { html, model } = runPipeline(store, {
    fileId: opts.fileId || `APX-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`,
    searchDate: SEARCH_DATE,
    indexDate: rec.source === "attom" ? "Licensed ATTOM property data as of search date" : "Live NCC assessor (Parcel Search) as of search date",
  });
  return { ok: true, address, assessor: rec, source: rec.source || "assessor", store, model, html };
}
