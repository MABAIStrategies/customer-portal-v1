#!/usr/bin/env node
/**
 * Extraction-accuracy trial #3 — 110 Maple Avenue, Dover DE 19901 (Kent).
 * "Push the limits" messy case: pipe-delimited index with ODD headers
 * (From/To/Doc Date/Kind/Liber/Folio/Reception #/Consideration), junk + blank
 * lines, mixed date formats (2-digit years + ISO), a Tax Deed (conveyance that
 * looks like a lien), messy doc codes (Mtg / Sat of Mtg / Assignment of Mtge),
 * a blank-grantor row, and an other-property row mixed in. Runs the shipped
 * extractor.   node test/trial3_extract.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(ROOT, "Apex_Title_Studio.html"), "utf8");
const dir = join(ROOT, "demo", "trial3-110-maple");
const read = f => readFileSync(join(dir, f), "utf8");

function extractFn(src, name) {
  const m = src.match(new RegExp(`function\\s+${name}\\s*\\(`));
  if (!m) throw new Error(`function ${name} not found`);
  const start = m.index, braceOpen = src.indexOf("{", start);
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let i = braceOpen; i < src.length; i++) {
    const c = src[i], next = src[i + 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && next === "/") { inBlock = false; i++; } continue; }
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === "/" && next === "/") { inLine = true; i++; continue; }
    if (c === "/" && next === "*") { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced ${name}`);
}

const SOURCES = [
  { id: "recorder", name: "Recorder of Deeds" }, { id: "tax", name: "Assessment / Tax" },
  { id: "court", name: "Prothonotary Court" }, { id: "statelien", name: "State Tax-Lien" },
];
const store = { recorder: read("1_recorder.txt"), tax: read("2_tax.txt"), court: read("3_court.txt"), statelien: read("4_state_lien.txt") };

const NEEDED = ["detectDelim","splitLine","guessCanon","looksHeader","parseText",
                "docFull","classify","sortKey","field","moneyLines","extractSource","composeNorthStar"];
const bundle = NEEDED.map(n => extractFn(HTML, n)).join("\n") + "\nreturn { composeNorthStar };";
const { composeNorthStar } = new Function("SOURCES", "store", bundle)(SOURCES, store);
const M = composeNorthStar();

const sc = (l, o) => console.log(`  ${l.padEnd(18)} : ${o.v || "—"}`);
const list = (l, a) => { console.log(`\n  ${l} (${a.length}):`); a.length ? a.forEach(it => console.log(`     • ${it.line}`)) : console.log("     — none —"); };

console.log("=".repeat(80));
console.log("EXTRACTION TRIAL #3 — 110 Maple Ave, Dover (Kent, pipe + messy/edge)");
console.log("=".repeat(80) + "\nHEADER");
sc("Property", M.property); sc("Parcel", M.parcelNumber); sc("Owner", M.sellersOwners); sc("Tax Status", M.taxStatus);
sc("Legal", { v: M.legalDescription.v ? M.legalDescription.v.slice(0, 56) + "…" : "" });
list("CHAIN (newest→oldest)", M.chain); list("MORTGAGES", M.mortgages);
list("ASSIGNMENTS", M.assignments); list("SATISFACTIONS", M.satisfied);
list("JUDGMENTS", M.judgments); list("FEDERAL TAX LIEN", M.federalLien);
list("OTHER LIENS / NOTES", M.otherLiens);

let pass = 0, fail = 0;
const ok = (l, c) => { console.log(`  ${c ? "PASS" : "FAIL"}  ${l}`); c ? pass++ : fail++; };
console.log("\nASSERTIONS");
ok("Owner = Carter", /Carter/.test(M.sellersOwners.v));
ok("Parcel = LC-00-066.00-01-15.00", M.parcelNumber.v === "LC-00-066.00-01-15.00");
ok("Tax status = Delinquent", (M.taxStatus.v||"").toLowerCase() === "delinquent");
ok("Legal captured", /BEGINNING/.test(M.legalDescription.v));
ok("Pipe index parsed: chain present", M.chain.length >= 4);
ok("Doc Date header mapped (date on every chain row)", M.chain.length>0 && M.chain.every(x=>/\d{2}\/\d{2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(x.line)));
ok("Chain newest = Carter 2018", /CARTER, JAMES R & ANGELA M/.test(M.chain[0]?.line||"") && /2018/.test(M.chain[0]?.line||""));
ok("Chain oldest = 1984 (2-digit year sorted last)", /\/84\b/.test(M.chain[M.chain.length-1]?.line||""));
ok("Tax Deed routed to CHAIN, not liens", M.chain.some(x=>/KENT COUNTY SHERIFF/i.test(x.line)) && !M.otherLiens.some(x=>/SHERIFF|Tax Deed/i.test(x.line)));
ok("3 mortgages (incl. blank-grantor row)", M.mortgages.length === 3);
ok("Blank-grantor mortgage kept (shows ?)", M.mortgages.some(x=>/\? →/.test(x.line)));
ok("1 satisfaction (Sat of Mtg abbrev)", M.satisfied.length === 1);
ok("1 assignment (Assignment of Mtge)", M.assignments.length === 1);
ok("1 judgment (no $ sign — Midland)", M.judgments.some(x=>/Midland/.test(x.line)));
ok("Federal lien (IRS)", M.federalLien.some(x=>/Internal Revenue/.test(x.line)));
ok("Other liens: lis pendens AND municipal sewer", M.otherLiens.some(x=>/Lis Pendens|Discover/i.test(x.line)) && M.otherLiens.some(x=>/sewer|Municipal/i.test(x.line)));
ok("Other-property row present (to be unchecked in app)", M.chain.some(x=>/NELSON|OAK ST/i.test(x.line)));

console.log("\n" + "=".repeat(80));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(80));
process.exit(fail ? 1 : 0);
