#!/usr/bin/env node
/**
 * Extraction-accuracy trial — 1403 Stoneleigh Road, Wilmington DE 19803
 * --------------------------------------------------------------------------
 * Runs the REAL shipped extractor (extractSource + composeNorthStar, lifted
 * out of Apex_Title_Studio.html) over the four genuine-looking source reports
 * in demo/trial-1403-stoneleigh/, and prints the North-Star model field by
 * field so we can audit exactly what the four zones receive.
 *
 *   node test/trial_extract.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(ROOT, "Apex_Title_Studio.html"), "utf8");
const dir = join(ROOT, "demo", "trial-1403-stoneleigh");
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

// Sources + a store the shipped composeNorthStar() expects (same ids/order as the app).
const SOURCES = [
  { id: "recorder", name: "Recorder of Deeds" },
  { id: "tax", name: "Assessment / Tax" },
  { id: "court", name: "Prothonotary Court" },
  { id: "statelien", name: "State Tax-Lien" },
];
const store = { recorder: read("1_recorder.txt"), tax: read("2_tax.txt"), court: read("3_court.txt"), statelien: read("4_state_lien.txt") };

const NEEDED = ["detectDelim","splitLine","guessCanon","looksHeader","parseText",
                "docFull","classify","sortKey","field","moneyLines","extractSource","composeNorthStar"];
const bundle = NEEDED.map(n => extractFn(HTML, n)).join("\n") + "\nreturn { composeNorthStar };";
const { composeNorthStar } = new Function("SOURCES", "store", bundle)(SOURCES, store);

const M = composeNorthStar();

// ---- print the model field by field ----
const sc = (label, o) => console.log(`  ${label.padEnd(20)} : ${o.v || "—"}   ${o.v ? `[src: ${o.source||"?"}]` : ""}`);
const list = (label, arr) => {
  console.log(`\n  ${label} (${arr.length}):`);
  if (!arr.length) { console.log("     — none —"); return; }
  arr.forEach(it => console.log(`     • ${it.line}`));
};

console.log("=".repeat(80));
console.log("EXTRACTION TRIAL — 1403 Stoneleigh Road  (shipped extractSource + composeNorthStar)");
console.log("=".repeat(80));
console.log("\nHEADER / SCALAR FIELDS");
sc("Property", M.property); sc("Parcel #", M.parcelNumber); sc("Hundred", M.hundred);
sc("Condo/Subdivision", M.condoSubdivision); sc("Unit/Lot", M.unitLot); sc("Block", M.block);
sc("Sellers/Owners", M.sellersOwners); sc("Deed Record", M.deedRecord); sc("Tax Status", M.taxStatus);
console.log(`  Legal Description    : ${M.legalDescription.v ? M.legalDescription.v.slice(0,70) + "…" : "—"}`);

list("CHAIN OF TITLE (newest→oldest)", M.chain);
list("MORTGAGES", M.mortgages);
list("ASSIGNMENTS", M.assignments);
list("SATISFACTIONS", M.satisfied);
list("JUDGMENTS", M.judgments);
list("FEDERAL TAX LIEN", M.federalLien);
list("OTHER LIENS / NOTES", M.otherLiens);

// ---- assertions ----
let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; };
console.log("\nACCURACY ASSERTIONS");
ok("Owner = Harper (from Recorder)", /Harper/.test(M.sellersOwners.v));
ok("Parcel = 06-114.00-027", M.parcelNumber.v === "06-114.00-027");
ok("Hundred = Brandywine", /Brandywine/.test(M.hundred.v));
ok("Tax status = Current", (M.taxStatus.v||"").toLowerCase() === "current");
ok("Legal description captured (metes & bounds)", /BEGINNING/.test(M.legalDescription.v));
ok("Chain has 4 deeds (40-yr)", M.chain.length === 4);
ok("Chain newest first (Harper 2016 on top)", /HARPER/.test(M.chain[0]?.line||""));
ok("Chain oldest last (1983)", /1983/.test(M.chain[M.chain.length-1]?.line||""));
ok("5 mortgages routed", M.mortgages.length === 5);
ok("4 satisfactions routed", M.satisfied.length === 4);
ok("2 assignments routed", M.assignments.length === 2);
ok("Civil judgment routed (Discover)", M.judgments.some(x=>/Discover/.test(x.line)));
ok("Federal tax lien routed (IRS)", M.federalLien.some(x=>/Internal Revenue|IRS/.test(x.line)));

console.log("\n" + "=".repeat(80));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(80));
process.exit(fail ? 1 : 0);
