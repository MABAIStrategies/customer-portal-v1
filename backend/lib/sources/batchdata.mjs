// SOURCE — BatchData Property API (licensed; the Phase-1 successor to ATTOM).
// Two parts: mapBatchData() is PURE (unit-tested offline against a fixture); lookupBatchData()
// does the live POST (needs BATCHDATA_API_TOKEN) then maps. Returns the SAME normalized record
// shape the orchestrator already understands, so the shipped pipeline is unchanged.
//
// Endpoint: POST https://api.batchdata.com/api/v1/property/lookup/all-attributes
// Auth:     Authorization: Bearer <BATCHDATA_API_TOKEN>   (confirmed reaching billing on 2026-06-27)
// Docs:     https://help.batchdata.io/  (Datasets & Custom Projections, Dec 2025)
//
// IMPORTANT — the response field paths below are mapped DEFENSIVELY across the documented and the
// likely BatchData shapes (the account had a zero balance at build time → "Insufficient balance",
// so no live response was available to pin the exact paths). get() tries several candidate paths
// per field and degrades gracefully; nothing is ever invented. When the token has balance, capture
// ONE live response into test/fixtures/batchdata_*.json and trim these candidate lists to the real
// paths — the map is structured so that is a 5-minute edit, not a rewrite.

const BASE = "https://api.batchdata.com/api/v1";

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const num = (v) => (v == null || v === "" ? "" : String(v).replace(/[^0-9.]/g, ""));

// first non-empty value among several dot-paths, e.g. get(p, ["legal.description","legalDescription"])
function get(obj, paths) {
  for (const path of (Array.isArray(paths) ? paths : [paths])) {
    let cur = obj, ok = true;
    for (const k of path.split(".")) { if (cur == null) { ok = false; break; } cur = cur[k]; }
    if (ok && cur != null && cur !== "") return cur;
  }
  return "";
}

// "2023-03-24..." or "2023-03-24T00:00:00Z" -> 03/24/2023; passes through MM/DD/YYYY untouched
function toMDY(d) {
  const s = clean(d);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return s;
}

// owner.names (array of strings or {first,middle,last,fullName}) | owner.fullName | owner.name
function ownerName(p) {
  const o = p.owner || {};
  if (Array.isArray(o.names) && o.names.length) {
    return o.names.map(n => typeof n === "string" ? clean(n)
      : clean(n.fullName || [n.last || n.lastName, [n.first || n.firstName, n.middle || n.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", ")))
      .filter(Boolean).join(" & ");
  }
  return clean(o.fullName || o.name || get(p, ["owner.owner1.fullName", "ownerName"]) || "");
}

// one BatchData property object -> normalized record (the shape recordToZones() consumes)
export function mapBatchData(property) {
  const p = property || {};
  const addr = p.address || {};

  // deed / sale history -> chain of title
  const deedSrc = p.deedHistory || p.deeds || get(p, ["deed.history", "deed.transactions", "sale.history"]) || [];
  const deedHistory = (Array.isArray(deedSrc) ? deedSrc : []).map(d => {
    const amt = num(get(d, ["saleAmount", "amount", "price", "transferAmount", "salePrice"]));
    return {
      grantor: clean(get(d, ["grantor", "grantorName", "seller", "sellerName"])),
      grantee: clean(get(d, ["grantee", "granteeName", "buyer", "buyerName", "ownerName"])),
      saleDate: toMDY(get(d, ["recordingDate", "saleDate", "documentDate", "transferDate", "date"])),
      amount: amt ? `$${amt}` : "",
      doc: clean(get(d, ["documentNumber", "instrumentNumber", "docNumber", "recordingDocumentNumber"])),
      book: clean(get(d, ["book", "recordingBook", "bookNumber"])),
      page: clean(get(d, ["page", "recordingPage", "pageNumber"])),
    };
  }).filter(d => d.grantor || d.grantee || d.doc);

  // mortgages (mortgage-liens dataset)
  const mortSrc = p.mortgages || p.openMortgages || get(p, ["mortgage.history"]) ||
    get(p, ["mortgageLiens.mortgages", "openLien.mortgages"]) || (p.mortgage ? [p.mortgage] : []);
  const mortgages = (Array.isArray(mortSrc) ? mortSrc : []).map(m => {
    if (!m) return null;
    const amt = num(get(m, ["amount", "loanAmount", "originalAmount", "openBalance"]));
    return {
      borrower: clean(get(m, ["borrower", "borrowerName", "mortgagor"])) || ownerName(p),
      lender: clean(get(m, ["lender", "lenderName", "mortgagee"])),
      amount: amt ? `$${amt}` : "",
      date: toMDY(get(m, ["recordingDate", "date", "originationDate", "documentDate"])),
      doc: clean(get(m, ["documentNumber", "instrumentNumber", "docNumber"])),
    };
  }).filter(m => m && (m.lender || m.amount));

  // involuntary liens / judgments (mortgage-liens dataset) — surfaced ONLY when actually present,
  // so an empty/uncommissioned dataset never displaces the honest "run manually" disclaimers.
  const lienSrc = p.liens || p.involuntaryLiens || get(p, ["mortgageLiens.liens"]) || [];
  const liens = (Array.isArray(lienSrc) ? lienSrc : []).map(l => {
    if (!l) return null;
    const type = clean(get(l, ["type", "lienType", "category"])) || "Lien";
    const amt = num(get(l, ["amount", "lienAmount"]));
    const who = clean(get(l, ["creditor", "lienholder", "plaintiff", "filedBy"]));
    const date = toMDY(get(l, ["recordingDate", "date", "filingDate"]));
    const doc = clean(get(l, ["documentNumber", "instrumentNumber", "caseNumber"]));
    return { type, amount: amt ? `$${amt}` : "", who, date, doc,
      line: `${type}${who ? `: ${who}` : ""}${amt ? ` $${amt}` : ""}${date ? `, recorded ${date}` : ""}${doc ? ` (${doc})` : ""}` };
  }).filter(Boolean);

  // legal: prefer a TRUE full/long legal if BatchData returns one (recordToZones will detect the
  // metes-and-bounds body and use it verbatim); otherwise pass the brief legal and let the
  // orchestrator wrap it in the standard Delaware deed shell.
  const fullLegal = clean(get(p, ["legal.description", "legal.legalDescription", "legal.metesAndBounds", "legal.fullLegal", "legalDescription"]));
  const subdivision = clean(get(p, ["legal.subdivision", "subdivision", "lot.subdivision"]));
  const lot = clean(get(p, ["legal.lot", "legal.lotNumber", "lotNumber", "lot.lotNumber"]));

  return {
    source: "batchdata",
    owner: ownerName(p),
    parcel: clean(get(p, ["apn", "parcelNumber", "ids.apn", "legal.apn", "assessor.apn", "assessment.apn", "address.apn"])),
    address: clean(get(p, ["address.formattedAddress", "address.fullAddress"]) ||
      [addr.street, addr.city, addr.state, addr.zip || addr.zipcode].filter(Boolean).join(", ")),
    subdivision, lot,
    legal: fullLegal,
    assessmentTotal: num(get(p, ["assessment.assessedValue", "assessment.totalValue", "assessment.totalAssessedValue", "tax.assessedValue", "valuation.assessedValue"])),
    // BatchData supplies the tax bill/assessment, not a delinquency status — never assert "Current".
    taxStatus: "not stated in BatchData data — obtain County tax certification to confirm current/delinquent",
    deedHistory, mortgages, liens,
  };
}

// "606 S Franklin St, Wilmington, DE 19805" -> { street, city, state, zip }
function splitAddress(addr) {
  const parts = String(addr || "").split(",").map(s => s.trim()).filter(Boolean);
  const street = parts[0] || "";
  let city = "", state = "", zip = "";
  const tail = parts.slice(1).join(", ");
  const m = tail.match(/^(.*?)[, ]+([A-Za-z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) { city = m[1].trim(); state = m[2].toUpperCase(); zip = m[3]; }
  else {
    city = parts[1] || "";
    const sz = (parts[2] || tail).match(/([A-Za-z]{2})\s*(\d{5})/);
    if (sz) { state = sz[1].toUpperCase(); zip = sz[2]; }
  }
  return { street, city, state, zip };
}

export async function lookupBatchData(addr, fetchImpl) {
  const token = process.env.BATCHDATA_API_TOKEN;
  if (!token) return { source: "batchdata", error: "BATCHDATA_API_TOKEN not set", address: addr };
  const a = splitAddress(addr);
  const body = { requests: [{ address: { street: a.street, city: a.city, state: a.state, zip: a.zip } }] };
  let json = null;
  try {
    const res = await (fetchImpl || fetch)(`${BASE}/property/lookup/all-attributes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && json.status && (json.status.message || json.status.text)) || `HTTP ${res.status}`;
      return { source: "batchdata", error: `BatchData: ${msg}`, address: addr };
    }
  } catch (e) {
    return { source: "batchdata", error: `BatchData request failed: ${e.message}`, address: addr };
  }
  const props = get(json, ["results.properties", "properties"]) || [];
  if (!Array.isArray(props) || !props.length) return { source: "batchdata", error: "no BatchData match", address: addr };
  return { ...mapBatchData(props[0]), address: addr };
}
