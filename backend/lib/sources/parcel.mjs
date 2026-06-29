// SOURCE 1 — New Castle County Parcel Search (assessor). Public, no login.
// address/parcel -> owner, parcel #, subdivision, assessment, tax status, deed history.
import { Session, clean } from "../http.mjs";

const URL0 = "https://www3.newcastlede.gov/parcel/search/";
const P = "ctl00$ctl00$ContentPlaceHolder1$ContentPlaceHolder1$";
const GRID = "#ctl00_ctl00_ContentPlaceHolder1_ContentPlaceHolder1__GridViewResults tr";
const SUFFIX = /\b(ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|BLVD|PL|PLACE|WAY|CIR|CIRCLE|TER|TERRACE|PIKE|HWY|HIGHWAY|SQ|ROW)\b\.?/gi;

// "22 Winburne Drive, New Castle DE" -> { number:"22", token:"WINBURNE", city:"NEW CASTLE" }
export function parseAddress(addr) {
  const [streetPart, ...rest] = addr.split(",");
  const m = streetPart.trim().match(/^(\d+)\s+(.*)$/);
  const number = m ? m[1] : "";
  let name = (m ? m[2] : streetPart).toUpperCase().replace(SUFFIX, "").trim();
  // distinctive token = longest word that isn't a bare direction
  const token = name.split(/\s+/).filter(w => !/^[NSEW]$/.test(w)).sort((a, b) => b.length - a.length)[0] || name;
  const city = rest.join(",").toUpperCase().replace(/\bDE\b|\bDELAWARE\b|\d{5}(-\d{4})?/g, "").replace(/[,]/g, " ").trim();
  return { number, name, token, city };
}

function fmtParcel(p) { // 1002910050 -> 10-029.10-050
  return /^\d{10}$/.test(p) ? `${p.slice(0,2)}-${p.slice(2,5)}.${p.slice(5,7)}-${p.slice(7)}` : p;
}

function pick(txt, re) { const m = txt.match(re); return m ? clean(m[1]) : ""; }

function parseDetail($) {
  const txt = clean($("body").text());
  const taxCounty = pick(txt, /County Balance Due:\s*\$([\d.,]+)/);
  const taxSchool = pick(txt, /School Balance Due:\s*\$([\d.,]+)/);
  const delinquent = [taxCounty, taxSchool].some(v => v && parseFloat(v.replace(/,/g, "")) > 0);
  // deed history table (header has "Sale Date")
  const deeds = [];
  $("table").each((_, t) => {
    const head = clean($(t).find("tr").first().text());
    if (!/Sale Date/i.test(head) || !/Deed/i.test(head)) return;
    $(t).find("tr").slice(1).each((_, tr) => {
      const c = $(tr).find("td").map((_, td) => clean($(td).text())).get();
      if (c.length >= 4) {
        // columns: Grantee | Deed(book page) | Multi? | Sale Date | Sale Amount
        const grantee = c[0];
        const deed = (c[1] || "").split(/\s+/);
        deeds.push({
          grantee,
          book: deed[0] || "", page: deed[1] || "",
          saleDate: c[c.length - 2], amount: c[c.length - 1],
        });
      }
    });
  });
  return {
    parcel: fmtParcel(pick(txt, /Parcel #\s*(\d{10})/)),
    address: pick(txt, /Property Address:\s*(.+?)\s+Subdivision:/),
    subdivision: pick(txt, /Subdivision:\s*(.+?)\s+Owner:/),
    owner: pick(txt, /Owner:\s*(.+?)\s+Owner Address:/),
    ownerAddress: pick(txt, /Owner Address:\s*(.+?)\s+Municipal/),
    lot: pick(txt, /Lot #:\s*(\S+)/),
    propertyClass: pick(txt, /Property Class:\s*(.+?)\s+Lot Size/),
    assessmentTotal: pick(txt, /Current Assessment.*?Total:\s*(\d+)/),
    taxStatus: delinquent ? `Delinquent (county $${taxCounty}, school $${taxSchool})` : "Current",
    deedHistory: deeds.filter(d => d.grantee || d.book),
  };
}

// In-memory result cache + polite pacing so a live demo never trips the assessor's
// rate-limit (it returns a 247 throttle under rapid/repeated hits). Cache makes repeated
// lookups of the same address instant; the gate serializes lookups with a minimum gap.
const _cache = new Map();           // normalized address -> resolved record
let _chain = Promise.resolve(), _lastAt = 0;
const MIN_GAP_MS = 900;
function _paced(fn) {
  const run = _chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - _lastAt);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    try { return await fn(); } finally { _lastAt = Date.now(); }
  });
  _chain = run.catch(() => {});     // keep the gate alive even if a lookup throws
  return run;
}

// Street-only search (no house number) used to suggest nearby parcels when an exact
// address doesn't resolve — turns a dead-end "no match" into a "did you mean…" list.
// (The county filters by exact house number server-side, so a wrong/missing number
// returns zero rows even when the street is right.)
async function streetCandidates(session, a) {
  if (!a.token) return [];
  const page = await session.get(URL0);
  const results = await session.postForm(URL0, {
    [P + "ContainsStartsWith"]: "_RadioButtonStartsWith",
    [P + "_TextBoxStreetNumber"]: "",
    [P + "StreetName"]: "_RadioButtonStreetNameContains",
    [P + "_TextBoxStreetName"]: a.token,
    [P + "_TextBoxCity"]: "",
    [P + "_ButtonSearch"]: "Search",
  }, page);
  const want = parseInt(a.number, 10) || 0;
  const seen = new Set(), cands = [];
  results.$(GRID).each((_, tr) => {
    const cells = results.$(tr).find("td").map((_, td) => clean(results.$(td).text())).get();
    const link = results.$(tr).find("a[href*='LinkButtonDetails']").attr("href");
    if (!link || cells.length < 3) return;
    const address = cells.find(c => /^\d/.test(c) && new RegExp(a.token, "i").test(c)) || "";
    if (!address || seen.has(address)) return;
    seen.add(address);
    const m = address.match(/^(\d+)/);
    cands.push({ number: m ? +m[1] : null, address, owner: cells[cells.length - 1] || "", search: address + ", DE" });
  });
  // closest house numbers first so the most likely match is at the top
  cands.sort((x, y) => Math.abs((x.number || 0) - want) - Math.abs((y.number || 0) - want));
  return cands.slice(0, 8);
}

// retry the whole lookup with a fresh session if the portal returns an empty/partial
// result (it occasionally does under rapid sequential requests). When the exact address
// can't be matched, gather nearby same-street candidates so the caller can suggest them.
export async function lookupParcel(addr, session) {
  const key = String(addr || "").trim().toUpperCase();
  if (_cache.has(key)) return _cache.get(key);
  const a = parseAddress(addr);
  const result = await _paced(async () => {
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1200 * attempt));
      last = await _lookupOnce(addr, new Session());
      if (!last.error && last.owner && last.parcel) return last;
      // Exact match failed. Check the street directly (fresh session) before retrying —
      // if the street resolves, the house number is just wrong and retries won't help,
      // so return the nearby candidates immediately (also avoids tripping the throttle).
      try {
        const cands = await streetCandidates(new Session(), a);
        if (cands.length) { last.candidates = cands; return last; }
      } catch (e) { /* candidate lookup is best-effort — never block the error path */ }
    }
    return last;
  });
  if (result && !result.error && result.owner) _cache.set(key, result);  // cache only good hits
  return result;
}

async function _lookupOnce(addr, session = new Session()) {
  const a = parseAddress(addr);

  async function attempt(streetMode, name) {
    const page = await session.get(URL0);
    const results = await session.postForm(URL0, {
      [P + "ContainsStartsWith"]: "_RadioButtonStartsWith",
      [P + "_TextBoxStreetNumber"]: a.number,
      [P + "StreetName"]: streetMode,
      [P + "_TextBoxStreetName"]: name,
      [P + "_TextBoxCity"]: "",
      [P + "_ButtonSearch"]: "Search",
    }, page);
    let target = null;
    results.$(GRID).each((_, tr) => {
      const cells = results.$(tr).find("td").map((_, td) => clean(results.$(td).text())).get();
      const link = results.$(tr).find("a[href*='LinkButtonDetails']").attr("href");
      if (!link) return;
      const addrCell = cells.find(c => new RegExp(`^${a.number}\\b`).test(c)) || "";
      if (addrCell && new RegExp(a.token, "i").test(addrCell)) {
        const m = link.match(/__doPostBack\('([^']+)'/);
        if (m && !target) target = m[1];
      }
    });
    return { results, target };
  }

  // StartsWith(full street name) is precise; fall back to Contains(token) for named directions
  let r = await attempt("_RadioButtonStreetNameStartsWith", a.name);
  if (!r.target) r = await attempt("_RadioButtonStreetNameContains", a.token);
  if (!r.target) return { address: addr, parsed: a, error: "no matching parcel row", rows: r.results.$(GRID).length };

  const detail = await session.postForm(URL0, { __EVENTTARGET: r.target, __EVENTARGUMENT: "" }, r.results);
  return { address: addr, source: "assessor", ...parseDetail(detail.$) };
}
