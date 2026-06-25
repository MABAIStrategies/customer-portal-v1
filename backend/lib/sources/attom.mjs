// SOURCE — ATTOM Property API (licensed; replaces credentialed county scraping).
// Two parts: mapAttom() is PURE (unit-tested offline against a fixture); lookupAttom()
// does the live fetches (needs ATTOM_API_KEY) then maps. Returns the same normalized
// record shape the orchestrator already understands, so the shipped pipeline is unchanged.
//
// Docs: https://api.gateway.attomdata.com/propertyapi/v1.0.0/  (apikey header)

const BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const num = (v) => (v == null || v === "" ? "" : String(v));

function ownerName(owner) {
  if (!owner) return "";
  const one = (o) => o && clean(`${o.lastname || ""}${o.firstnameandmi ? ", " + o.firstnameandmi : ""}`);
  return [one(owner.owner1), one(owner.owner2)].filter(Boolean).join(" & ");
}
function isoToMDY(d) {
  const m = clean(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : clean(d);
}

// expandedprofile + saleshistory (expandedhistory) JSON -> normalized record.
// Defensive: ATTOM tiers vary; pull what's present, degrade gracefully, never invent.
export function mapAttom(profile, history) {
  const p = (profile && profile.property && profile.property[0]) || {};
  const id = p.identifier || {}, addr = p.address || {}, sum = p.summary || {}, lot = p.lot || {};
  const asmt = p.assessment || {};

  const deedHistory = [], mortgages = [];
  const hist = (history && history.property && history.property[0] && history.property[0].salehistory) || [];
  for (const h of hist) {
    const saleDate = isoToMDY(h.saleTransDate || (h.amount && h.amount.salerecdate) || "");
    const amount = num(h.amount && (h.amount.saleamt ?? h.amount.saleAmt));
    deedHistory.push({
      grantor: clean(h.grantor || (h.saleAmountData && h.saleAmountData.grantor) || ""),
      grantee: clean(h.grantee || (h.saleAmountData && h.saleAmountData.grantee) || ""),
      saleDate, amount: amount ? `$${amount}` : "",
      doc: clean(h.documentnum || (h.saleAmountData && h.saleAmountData.instrumentnumber) || ""),
      book: clean(h.recordingbook || ""), page: clean(h.recordingpage || ""),
    });
    const mt = h.mortgage || (h.saleAmountData && h.saleAmountData.mortgage);
    if (mt && (mt.amount || mt.lender)) mortgages.push({
      borrower: clean(h.grantee || ""), lender: clean(mt.lender || mt.lenderlastname || ""),
      amount: mt.amount ? `$${num(mt.amount)}` : "", date: isoToMDY(mt.date || saleDate), doc: clean(mt.documentnum || ""),
    });
  }
  // a current mortgage may also live on the assessment block
  const am = asmt.mortgage && (asmt.mortgage.FirstConcurrent || asmt.mortgage.title || asmt.mortgage);
  if (am && am.amount && !mortgages.length) mortgages.push({
    borrower: ownerName(p.owner), lender: clean(am.lender || ""), amount: `$${num(am.amount)}`,
    date: isoToMDY(am.date || ""), doc: clean(am.documentnum || ""),
  });

  return {
    source: "attom",
    owner: ownerName(p.owner),
    parcel: clean(id.apn || ""),
    address: clean(addr.oneLine || `${addr.line1 || ""} ${addr.line2 || ""}`),
    subdivision: clean(lot.subdname || ""),
    lot: clean(lot.lotnum || ""),
    legal: clean(sum.legal1 || (lot.subdname ? `${lot.subdname}${lot.lotnum ? " LOT " + lot.lotnum : ""}` : "")),
    assessmentTotal: num(asmt.assessed && (asmt.assessed.assdttlvalue ?? asmt.assessed.assdTtlValue)),
    // ATTOM gives the tax bill, not delinquency status — never assert "Current".
    taxStatus: "not stated in ATTOM data — obtain County tax certification to confirm current/delinquent",
    deedHistory, mortgages,
  };
}

async function attomGet(pathName, params, fetchImpl) {
  const key = process.env.ATTOM_API_KEY;
  if (!key) throw new Error("ATTOM_API_KEY not set");
  const qs = new URLSearchParams(params).toString();
  const res = await (fetchImpl || fetch)(`${BASE}/${pathName}?${qs}`, {
    headers: { apikey: key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ATTOM ${pathName} HTTP ${res.status}`);
  return res.json();
}

// address like "226 N Star Road, Newark DE" -> ATTOM address1/address2
function splitAddress(addr) {
  const [a1, ...rest] = addr.split(",");
  return { address1: clean(a1), address2: clean(rest.join(",")) };
}

export async function lookupAttom(addr, fetchImpl) {
  const { address1, address2 } = splitAddress(addr);
  const [profile, history] = await Promise.all([
    attomGet("property/expandedprofile", { address1, address2 }, fetchImpl).catch(() => null),
    attomGet("saleshistory/expandedhistory", { address1, address2 }, fetchImpl).catch(() => null),
  ]);
  if (!profile) return { source: "attom", error: "no ATTOM match", address: addr };
  return { ...mapAttom(profile, history), address: addr };
}
