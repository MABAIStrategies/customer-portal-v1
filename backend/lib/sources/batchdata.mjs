// SOURCE — BatchData (licensed; the chosen successor to ATTOM). Two parts: mapBatchData() is PURE
// (unit-tested offline against a fixture); lookupBatchData() does ONE deterministic REST POST — no
// LLM, no OAuth handshake — so it fits Zach's one-click, server-side search.
//
// Transport:  POST https://api.batchdata.com/api/v1/property/lookup/all-attributes
//             header  Authorization: Bearer <BATCHDATA_API_TOKEN>   (the server-side API token)
//             body    {requests:[{address:{street,city,state,zip}}]}  (or {apn,countyFipsCode})
//             reply   {status, results:{properties:[ … ]}}
// (BatchData's MCP exposes the SAME data, but it now gates on interactive OAuth that can't run
//  unattended; the REST endpoint is the correct machine-to-machine path and was confirmed live.)
//
// Field paths below are CONFIRMED from a live response + BatchData's metadata tools, not guessed:
//   owner.fullName | owner.names.{first,middle,last,full} · ids.apn · address.* · tax.taxDelinquentYear
//   legal.legalDescription (BRIEF legal — NOT metes-and-bounds; BatchData has no metes-and-bounds
//     field and no recorded-deed image, so full courses-and-distances still come from the deed itself)
//   deedHistory[].{sellers,buyers,recordingDate,saleDate,documentNumber,recordingBook,recordingPage,salePrice,documentType}
//   mortgageHistory[].{borrowers,lenderName,loanAmount,recordingDate,loanType} + openLien.mortgages[] (open set)
//     + sale.{lastSale,priorSale}.mortgages[].{documentNumber,bookNumber,pageNumber} (doc refs)
//   involuntaryLien.liens[].{lienType,documentType,judgementAmount,lienAmount,filingDate,recordingDate,
//     documentNumber,bookNumber,pageNumber,parties[].{fullName,roleType}}

const REST_URL = "https://api.batchdata.com/api/v1/property/lookup/all-attributes";

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const numStr = (v) => (v == null || v === "" ? "" : String(v).replace(/[^0-9.]/g, ""));

// first non-empty value among dot-paths, e.g. get(p, ["legal.legalDescription"])
function get(obj, paths) {
  for (const path of (Array.isArray(paths) ? paths : [paths])) {
    let cur = obj, ok = true;
    for (const k of path.split(".")) { if (cur == null) { ok = false; break; } cur = cur[k]; }
    if (ok && cur != null && cur !== "") return cur;
  }
  return "";
}

// "2023-03-24" / "2023-03-24T..." -> 03/24/2023; MM/DD/YYYY passes through
function toMDY(d) {
  const s = clean(d);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[2]}/${iso[3]}/${iso[1]}` : s;
}

// BatchData name fields come as a string, an array of strings, or {first,middle,last,full}/{fullName}
function asName(v) {
  if (!v) return "";
  if (typeof v === "string") return clean(v);
  if (Array.isArray(v)) return v.map(asName).filter(Boolean).join(" & ");
  return clean(v.full || v.fullName ||
    [v.last || v.lastName, [v.first || v.firstName, v.middle || v.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", "));
}

function ownerName(p) {
  const o = p.owner || {};
  return clean(o.fullName) || asName(o.names) || asName(o.name) || "";
}

// money like 172812 / "172812.00" -> "$172812" (the report layer adds thousands separators)
const money = (v) => { const n = numStr(v); return n ? `$${n}` : ""; };

// classify an involuntary lien into the report's discrete search categories
function lienCategory(lienType, documentType) {
  const s = `${lienType || ""} ${documentType || ""}`.toLowerCase();
  if (/bankrupt/.test(s)) return "bankruptcy";
  if (/federal|irs|internal revenue/.test(s)) return "federal";
  if (/state tax|division of revenue|state of /.test(s)) return "state";
  if (/mechanic/.test(s)) return "mechanics";
  if (/ucc|financing statement/.test(s)) return "ucc";
  if (/judg|lis pendens|civil/.test(s)) return "judgment";
  return "other";
}

function partyByRole(parties, re) {
  const hit = (parties || []).find(x => re.test(String(x.roleType || "")));
  return hit ? clean(hit.fullName) : "";
}

// one BatchData property object -> normalized record (the shape recordToZones() consumes)
export function mapBatchData(property) {
  const p = property || {};
  const addr = p.address || {};

  // chain of title (deedHistory)
  const deedHistory = (Array.isArray(p.deedHistory) ? p.deedHistory : []).map(d => ({
    grantor: asName(get(d, ["sellers", "grantor"])),
    grantee: asName(get(d, ["buyers", "grantee"])),
    saleDate: toMDY(get(d, ["recordingDate", "saleDate", "documentDate"])),
    amount: money(get(d, ["salePrice"])),
    doc: clean(get(d, ["documentNumber"])),
    book: clean(get(d, ["recordingBook"])),
    page: clean(get(d, ["recordingPage"])),
    docType: clean(get(d, ["documentType"])) || "Deed",
  })).filter(d => d.grantor || d.grantee || d.doc);

  // open-lien set (lender|amount) to flag which mortgages are still open, + assignment targets
  const openSet = new Set();
  const assignBy = {};
  for (const m of (get(p, ["openLien.mortgages"]) || [])) {
    const key = `${clean(m.lenderName).toLowerCase()}|${numStr(m.loanAmount)}`;
    openSet.add(key);
    const assn = clean(m.assignedLenderName);
    if (assn) assignBy[key] = assn;
  }
  // doc refs for mortgages live on the sale.*.mortgages records
  const saleMorts = [...(get(p, ["sale.lastSale.mortgages"]) || []), ...(get(p, ["sale.priorSale.mortgages"]) || [])];
  const docFor = (lender, amt) => {
    const hit = saleMorts.find(s => clean(s.lenderName).toLowerCase() === clean(lender).toLowerCase() && numStr(s.loanAmount) === numStr(amt));
    return hit ? clean(hit.documentNumber) : "";
  };

  const mortgages = (Array.isArray(p.mortgageHistory) ? p.mortgageHistory : []).map(m => {
    const lender = clean(get(m, ["lenderName"]));
    const amt = get(m, ["loanAmount"]);
    const key = `${lender.toLowerCase()}|${numStr(amt)}`;
    return {
      borrower: asName(get(m, ["borrowers"])),
      lender,
      amount: money(amt),
      date: toMDY(get(m, ["recordingDate", "documentDate", "saleDate"])),
      doc: docFor(lender, amt),
      loanType: clean(get(m, ["loanType"])),
      open: openSet.has(key),
      assignedTo: assignBy[key] || "",
    };
  }).filter(m => m.lender || m.amount);

  // involuntary liens (judgments, federal/state tax liens, mechanics, etc.) -> categorized line strings
  const liens = { judgment: [], federal: [], state: [], mechanics: [], ucc: [], bankruptcy: [], other: [] };
  for (const l of (get(p, ["involuntaryLien.liens"]) || [])) {
    const cat = lienCategory(l.lienType, l.documentType);
    const plaintiff = partyByRole(l.parties, /plaintiff|creditor|lienor|claimant/i);
    const defendant = partyByRole(l.parties, /defendant|debtor|owner/i);
    const amt = money(get(l, ["judgementAmount", "lienAmount"]));
    const date = toMDY(get(l, ["recordingDate", "filingDate"]));
    const doc = clean(get(l, ["documentNumber"])) || (get(l, ["bookNumber"]) ? `Bk ${clean(l.bookNumber)}/Pg ${clean(l.pageNumber || "—")}` : "");
    const type = clean(l.lienType || l.documentType) || "Lien";
    const vs = plaintiff && defendant ? `${plaintiff} v. ${defendant}` : (plaintiff || defendant);
    const line = `${vs ? vs + ", " : ""}${type}${amt ? ` in the amount of ${amt}` : ""}${date ? `, recorded ${date}` : ""}${doc ? ` (${doc})` : ""}`;
    (liens[cat] || liens.other).push(line);
  }

  // tax: BatchData flags delinquency via tax.taxDelinquentYear; never assert "Current" without a cert.
  const delq = get(p, ["tax.taxDelinquentYear"]);
  const taxStatus = delq
    ? `Delinquent (per BatchData, tax year ${delq}) — confirm amount with a County tax certification`
    : "No delinquency flagged in BatchData — confirm current/delinquent with a County tax certification";

  return {
    source: "batchdata",
    owner: ownerName(p),
    parcel: clean(get(p, ["ids.apn", "apn", "parcelNumber"])),
    address: clean(get(p, ["address.formattedAddress"]) ||
      [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")),
    subdivision: clean(get(p, ["legal.subdivisionName", "legal.subdivision"])),
    lot: clean(get(p, ["legal.lotNumber"])),
    // BRIEF legal only — recordToZones wraps it in the Delaware deed shell and flags metes-and-bounds.
    legal: clean(get(p, ["legal.legalDescription"])),
    assessmentTotal: numStr(get(p, ["assessment.totalAssessedValue", "assessment.totalMarketValue"])),
    taxStatus,
    deedHistory, mortgages, liens,
  };
}

// ---- transport: BatchData REST property lookup (machine-to-machine) -------------------------
// The one-click search runs on the server, unattended — so it uses the REST endpoint with the
// server-side API token. (BatchData's MCP exposes the SAME data but now gates on interactive
// OAuth, which cannot run headless; confirmed live that REST returns the full record set.)

// when a lookup returns several candidates, prefer the one whose street/number matches the request
function pickProperty(props, addr) {
  if (!Array.isArray(props) || !props.length) return null;
  if (props.length === 1) return props[0];
  const want = String(addr || "").toLowerCase();
  const num = (want.match(/^\s*(\d+)/) || [])[1];
  let best = props[0], bestScore = -1;
  for (const p of props) {
    const hn = String(get(p, ["address.houseNumber"]) || "");
    const st = String(get(p, ["address.street"]) || "").toLowerCase();
    let sc = 0;
    if (num && hn === num) sc += 2;
    if (st && want.includes(st)) sc += 1;
    if (sc > bestScore) { bestScore = sc; best = p; }
  }
  return best;
}

// address "606 S Franklin St, Wilmington, DE 19805" -> REST request body.
// Prefers FIPS+APN when the caller already has them (exact match, no address ambiguity).
function lookupBody(addr, opts = {}) {
  if (opts.fips && opts.apn) return { requests: [{ apn: String(opts.apn), countyFipsCode: String(opts.fips) }] };
  const parts = String(addr || "").split(",").map(s => s.trim()).filter(Boolean);
  const street = parts[0] || "";
  let city = "", state = "", zip = "";
  const tail = parts.slice(1).join(", ");
  const m = tail.match(/^(.*?)[, ]+([A-Za-z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) { city = m[1].trim(); state = m[2].toUpperCase(); zip = m[3]; }
  else { city = parts[1] || ""; const sz = (parts[2] || tail).match(/([A-Za-z]{2})\s*(\d{5})/); if (sz) { state = sz[1].toUpperCase(); zip = sz[2]; } }
  return { requests: [{ address: { street, city, state, zip } }] };
}

export async function lookupBatchData(addr, opts = {}, fetchImpl) {
  const token = process.env.BATCHDATA_API_TOKEN;
  if (!token) return { source: "batchdata", error: "BATCHDATA_API_TOKEN not set", address: addr };
  let json = null;
  try {
    const res = await (fetchImpl || fetch)(REST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(lookupBody(addr, opts)),
    });
    json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && json.status && (json.status.message || json.status.text)) || `HTTP ${res.status}`;
      return { source: "batchdata", error: `BatchData: ${msg}`, address: addr };
    }
  } catch (e) {
    return { source: "batchdata", error: `BatchData request failed: ${e.message}`, address: addr };
  }
  const prop = pickProperty(get(json, ["results.properties", "properties"]) || [], addr);
  if (!prop) return { source: "batchdata", error: "no BatchData match", address: addr };
  return { ...mapBatchData(prop), address: addr };
}
