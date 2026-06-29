// SOURCE — BatchData (licensed; the chosen successor to ATTOM), accessed through BatchData's
// MCP server. Two parts: mapBatchData() is PURE (unit-tested offline against a fixture built to
// BatchData's CONFIRMED field schema); lookupBatchData() calls the MCP `lookup_property` tool over
// a single deterministic JSON-RPC request — NO LLM in the loop, so it fits Zach's one-click search.
//
// Transport:  POST https://mcp.batchdata.com   (Bearer <BATCHDATA_API_TOKEN>)
//             body  {jsonrpc, method:"tools/call", params:{name:"lookup_property", arguments:{…}}}
//             reply Server-Sent-Events: a single `data: {jsonrpc,result|error}` line.
// Datasets are whatever is enabled for MCP on the account, plus the extras we request.
//
// Field paths below are CONFIRMED from BatchData's own metadata tools (list_property_dataset_fields
// for core/deed/mortgage-liens), not guessed:
//   owner.fullName | owner.names.{first,middle,last,full} · ids.apn · address.* · tax.taxDelinquentYear
//   legal.legalDescription (BRIEF legal — NOT metes-and-bounds; BatchData has no metes-and-bounds
//     field and no recorded-deed image, so full courses-and-distances still come from the deed itself)
//   deedHistory[].{sellers,buyers,recordingDate,saleDate,documentNumber,recordingBook,recordingPage,salePrice,documentType}
//   mortgageHistory[].{borrowers,lenderName,loanAmount,recordingDate,loanType} + openLien.mortgages[] (open set)
//     + sale.{lastSale,priorSale}.mortgages[].{documentNumber,bookNumber,pageNumber} (doc refs)
//   involuntaryLien.liens[].{lienType,documentType,judgementAmount,lienAmount,filingDate,recordingDate,
//     documentNumber,bookNumber,pageNumber,parties[].{fullName,roleType}}

const MCP_URL = "https://mcp.batchdata.com";
const DATASETS = ["core", "deed", "mortgage-liens", "owner", "valuation"];

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

// ---- MCP transport (deterministic single tool call) ----------------------------------------

// pull the JSON-RPC result object out of an SSE / JSON MCP reply, then the property record inside it
function parseMcpProperty(raw) {
  let rpc = null;
  for (const line of String(raw || "").split(/\r?\n/)) {
    const s = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!s || s[0] !== "{") continue;
    try { const o = JSON.parse(s); if (o.result || o.error) { rpc = o; break; } } catch { /* keep scanning */ }
  }
  if (!rpc) { try { rpc = JSON.parse(raw); } catch { return { error: "unparseable MCP reply" }; } }
  if (rpc.error) return { error: rpc.error.message || "MCP error" };
  const r = rpc.result || {};
  if (r.isError) {
    const msg = (r.content && r.content[0] && r.content[0].text) || "MCP tool error";
    return { error: msg };
  }
  // payload may be structuredContent, or JSON inside a text content block
  let payload = r.structuredContent;
  if (!payload && r.content) {
    for (const c of r.content) { if (c.type === "text" && c.text) { try { payload = JSON.parse(c.text); break; } catch { payload = c.text; } } }
  }
  if (!payload) return { error: "empty MCP result" };
  const props = get(payload, ["results.properties", "properties"]);
  if (Array.isArray(props) && props.length) return { property: props[0] };
  if (payload.property) return { property: payload.property };
  if (payload.address || payload.deedHistory || payload.ids) return { property: payload };
  return { error: "no property in MCP result" };
}

// address "606 S Franklin St, Wilmington, DE 19805" -> MCP lookup_property arguments.
// Prefers FIPS+APN when the caller already has them (exact match, no address ambiguity).
function lookupArgs(addr, opts = {}) {
  if (opts.fips && opts.apn) return { property_county_fips: String(opts.fips), property_apn: String(opts.apn), datasets: DATASETS };
  const parts = String(addr || "").split(",").map(s => s.trim()).filter(Boolean);
  const street = parts[0] || "";
  let city = "", state = "", zip = "";
  const tail = parts.slice(1).join(", ");
  const m = tail.match(/^(.*?)[, ]+([A-Za-z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) { city = m[1].trim(); state = m[2].toUpperCase(); zip = m[3]; }
  else { city = parts[1] || ""; const sz = (parts[2] || tail).match(/([A-Za-z]{2})\s*(\d{5})/); if (sz) { state = sz[1].toUpperCase(); zip = sz[2]; } }
  return { property_street: street, property_city: city, property_state: state, property_zip: zip, datasets: DATASETS };
}

export async function lookupBatchData(addr, opts = {}, fetchImpl) {
  const token = process.env.BATCHDATA_API_TOKEN;
  if (!token) return { source: "batchdata", error: "BATCHDATA_API_TOKEN not set", address: addr };
  const body = {
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "lookup_property", arguments: lookupArgs(addr, opts) },
  };
  let raw;
  try {
    const res = await (fetchImpl || fetch)(MCP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    });
    raw = await res.text();
    if (!res.ok && !raw) return { source: "batchdata", error: `BatchData MCP HTTP ${res.status}`, address: addr };
  } catch (e) {
    return { source: "batchdata", error: `BatchData MCP request failed: ${e.message}`, address: addr };
  }
  const parsed = parseMcpProperty(raw);
  if (parsed.error) return { source: "batchdata", error: `BatchData: ${parsed.error}`, address: addr };
  return { ...mapBatchData(parsed.property), address: addr };
}
