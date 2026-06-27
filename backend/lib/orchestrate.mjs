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
  // Legal description in the abstractor's vernacular. Aggregator sources (assessor / ATTOM /
  // BatchData) carry only a BRIEF legal (lot/subdivision) — never the full courses-and-distances.
  // So unless a source actually returns a metes-and-bounds body (BEGINNING…degrees…), render the
  // standard Delaware deed shell and flag the metes-and-bounds for transcription from the recorded
  // vesting deed. Matches the North-Star legal inflection without fabricating courses.
  const srcLabel = r.source === "attom" ? "ATTOM data" : r.source === "batchdata" ? "BatchData" : "NCC assessor records";
  const vest = [...(r.deedHistory || [])].sort((a, b) => yr(b.saleDate) - yr(a.saleDate))[0];
  const deedRef = vest ? (vest.book ? `Bk ${vest.book}/Pg ${vest.page}` : (vest.doc || vest.instrument || "")) : (r.deedRecord || "");
  const lotPhrase = [r.lot && `Lot ${r.lot}`, r.subdivision].filter(Boolean).join(", ") || (r.parcel ? `Parcel ${r.parcel}` : "the subject parcel");
  const hasFullLegal = r.legal && /\bBEGINNING\b|\bdegrees\b|°/i.test(r.legal);
  const legalBody = hasFullLegal
    ? r.legal
    : `ALL THAT CERTAIN lot, piece or parcel of land, with the buildings and improvements thereon erected, situate in New Castle County and State of Delaware, being known as ${lotPhrase}${r.legal ? ` (${r.legal})` : ""}, as identified in ${srcLabel}; the full metes-and-bounds description — courses, distances, and any "TOGETHER WITH" easements or rights-of-way — must be transcribed verbatim from the recorded vesting deed${deedRef ? ` (${deedRef})` : ""} and is not reproduced from ${srcLabel}. [TO VERIFY — transcribe full legal from the recorded instrument]`;
  const legal = `LEGAL DESCRIPTION: ${legalBody}`;
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
  // Use the recognized section labels so each un-retrieved search surfaces an HONEST disclaimer
  // in its own report section (never a silent "NONE FOUND", which would imply a completed search).
  return {
    recorder, tax,
    court: "JUDGMENT: civil-judgment search not auto-retrieved — run the Prothonotary / CourtConnect (Superior Court & Court of Common Pleas) search manually before delivery.",
    statelien: [
      "FEDERAL TAX LIEN: not auto-retrieved — run the New Castle County Recorder of Deeds federal tax-lien index manually before delivery.",
      "STATE TAX LIEN: not auto-retrieved — run the Delaware Division of Revenue lien/judgment search manually before delivery.",
    ].join("\n"),
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
  return assessor.error ? { error: assessor.error, candidates: assessor.candidates } : assessor;
}

export async function generateReport(address, opts = {}) {
  const rec = await retrieve(address);
  if (rec.error) return { ok: false, stage: "retrieve", error: rec.error, candidates: rec.candidates, address };
  const store = recordToZones(address, rec);
  const SEARCH_DATE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const { html, model } = runPipeline(store, {
    fileId: opts.fileId || `APX-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`,
    searchDate: SEARCH_DATE,
    indexDate: rec.source === "attom" ? "Licensed ATTOM property data as of search date" : "Live NCC assessor (Parcel Search) as of search date",
  });
  return { ok: true, address, assessor: rec, source: rec.source || "assessor", store, model, html };
}
