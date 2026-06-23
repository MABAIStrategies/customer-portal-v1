// SOURCE 1 — New Castle County Parcel Search (assessor). Public, no login.
// address/parcel -> owner, parcel #, subdivision, assessment, tax status, deed history.
import { Session, clean } from "../http.mjs";

const URL0 = "https://www3.newcastlede.gov/parcel/search/";
const P = "ctl00$ctl00$ContentPlaceHolder1$ContentPlaceHolder1$";
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

export async function lookupParcel(addr, session = new Session()) {
  const a = parseAddress(addr);
  const page = await session.get(URL0);
  // search by street number + distinctive street-name token (Contains handles named directions like "North Star")
  const results = await session.postForm(URL0, {
    [P + "ContainsStartsWith"]: "_RadioButtonStartsWith",
    [P + "_TextBoxStreetNumber"]: a.number,
    [P + "StreetName"]: "_RadioButtonStreetNameContains",
    [P + "_TextBoxStreetName"]: a.token,
    [P + "_TextBoxCity"]: "",
    [P + "_ButtonSearch"]: "Search",
  }, page);
  // find the results row matching our street number, capture its Details postback target
  let target = null, rowOwner = "", rowParcel = "";
  results.$("#ctl00_ctl00_ContentPlaceHolder1_ContentPlaceHolder1__GridViewResults tr").each((_, tr) => {
    const cells = results.$(tr).find("td").map((_, td) => clean(results.$(td).text())).get();
    const link = results.$(tr).find("a[href*='LinkButtonDetails']").attr("href");
    if (link && cells.join(" ").includes(`${a.number} `) && new RegExp(a.token, "i").test(cells.join(" "))) {
      const m = link.match(/__doPostBack\('([^']+)'/);
      if (m && !target) { target = m[1]; rowParcel = cells[0]; rowOwner = cells[cells.length - 1]; }
    }
  });
  if (!target) return { address: addr, parsed: a, error: "no matching parcel row", rows: results.$("#ctl00_ctl00_ContentPlaceHolder1_ContentPlaceHolder1__GridViewResults tr").length };
  const detail = await session.postForm(URL0, { __EVENTTARGET: target, __EVENTARGUMENT: "" }, results);
  return { address: addr, source: "assessor", ...parseDetail(detail.$) };
}
