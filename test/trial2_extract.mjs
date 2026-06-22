#!/usr/bin/env node
/**
 * Extraction-accuracy trial #2 — 24 Pilottown Road, Lewes DE 19958 (Sussex).
 * Harder shape: comma-delimited (CSV) recorder index WITH a comma-heavy legal
 * description (delimiter-collision), doc-type abbreviations (MTG/ASGN), an
 * estate deed, trust in/out, mechanics lien + lis pendens (in the index), and
 * a state tax lien + municipal lien (narrative). Runs the shipped extractor.
 *
 *   node test/trial2_extract.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(ROOT, "Apex_Title_Studio.html"), "utf8");
const dir = join(ROOT, "demo", "trial2-24-pilottown");
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
                "docFull","classify","sortKey","field","moneyLines","extractSource","normName","shareTok","lenderReaches","reconcile","analyzeChain","composeNorthStar"];
const bundle = NEEDED.map(n => extractFn(HTML, n)).join("\n") + "\nreturn { composeNorthStar };";
const { composeNorthStar } = new Function("SOURCES", "store", bundle)(SOURCES, store);
const M = composeNorthStar();

const sc = (l, o) => console.log(`  ${l.padEnd(18)} : ${o.v || "—"}`);
const list = (l, a) => { console.log(`\n  ${l} (${a.length}):`); a.length ? a.forEach(it => console.log(`     • ${it.line}`)) : console.log("     — none —"); };

console.log("=".repeat(80));
console.log("EXTRACTION TRIAL #2 — 24 Pilottown Road, Lewes (Sussex, CSV + prose legal)");
console.log("=".repeat(80) + "\nHEADER");
sc("Property", M.property); sc("Parcel #", M.parcelNumber); sc("Hundred", M.hundred);
sc("Owner", M.sellersOwners); sc("Tax Status", M.taxStatus);
sc("Legal", { v: M.legalDescription.v ? M.legalDescription.v.slice(0, 60) + "…" : "" });
list("CHAIN (newest→oldest)", M.chain); list("MORTGAGES", M.mortgages);
list("ASSIGNMENTS", M.assignments); list("SATISFACTIONS", M.satisfied);
list("JUDGMENTS", M.judgments); list("FEDERAL TAX LIEN", M.federalLien);
list("OTHER LIENS / NOTES", M.otherLiens);

let pass = 0, fail = 0;
const ok = (l, c) => { console.log(`  ${c ? "PASS" : "FAIL"}  ${l}`); c ? pass++ : fail++; };
console.log("\nASSERTIONS");
ok("Owner = Marcus Ellison", /Ellison/.test(M.sellersOwners.v));
ok("Parcel = 335-8.00-112.00", M.parcelNumber.v === "335-8.00-112.00");
ok("Tax status = Delinquent", (M.taxStatus.v||"").toLowerCase() === "delinquent");
ok("Legal captured (not corrupted by CSV)", /BEGINNING/.test(M.legalDescription.v));
ok("Chain = 4 deeds (CSV survived the prose legal)", M.chain.length === 4);
ok("Chain newest = 2022 → Ellison", /ELLISON, MARCUS T/.test(M.chain[0]?.line||"") && /2022/.test(M.chain[0]?.line||""));
ok("Chain oldest = 1981", /1981/.test(M.chain[M.chain.length-1]?.line||""));
ok("2 mortgages", M.mortgages.length === 2);
ok("1 satisfaction", M.satisfied.length === 1);
ok("1 assignment (ASGN abbrev recognized)", M.assignments.length === 1);
ok("1 civil judgment (Capital One)", M.judgments.some(x=>/Capital One/.test(x.line)));
ok("Other liens incl. mechanics", M.otherLiens.some(x=>/Mechanic/i.test(x.line)));
ok("Other liens incl. lis pendens", M.otherLiens.some(x=>/Lis Pendens|Discover/i.test(x.line)));
ok("Other liens incl. STATE tax lien", M.otherLiens.some(x=>/State of Delaware|State tax/i.test(x.line)));
ok("Other liens incl. municipal/sewer", M.otherLiens.some(x=>/sewer|Municipal/i.test(x.line)));

console.log("\nRECONCILIATION & CHAIN FLAGS (Features A & B)");
const openM = M.mortgages.filter(m=>m.status==="Open");
const relM  = M.mortgages.filter(m=>m.status==="Released");
ok("1 mortgage OPEN (Rocket 2022)", openM.length===1 && /ROCKET/.test(openM[0].line));
ok("1 mortgage RELEASED (2013 WSFS)", relM.length===1 && /WSFS/.test(relM[0].line));
ok("0 unmatched satisfactions", M.satisfied.every(s=>s.flag!=="unmatched"));
ok("Chain clean: 0 other-property flags", M.chain.every(c=>c.flag!=="otherProperty"));
ok("Chain clean: 0 gap notes", (M.chainNotes||[]).length===0);

console.log("\n" + "=".repeat(80));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(80));
process.exit(fail ? 1 : 0);
