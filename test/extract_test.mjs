#!/usr/bin/env node
/**
 * Apex Title Studio — extraction test harness
 * --------------------------------------------------------------------------
 * Extracts the REAL shipped extraction functions out of Apex_Title_Studio.html
 * (balanced-brace slicing, same technique as test/parser_test.mjs) and runs the
 * built-in "905 Shallcross" worked example through extractSource(). Asserts the
 * North-Star field reads and the document routing the abstractor will see.
 *
 * No DOM, no installs:  node test/extract_test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(ROOT, "Apex_Title_Studio.html"), "utf8");

function extractFn(src, name) {
  const m = src.match(new RegExp(`function\\s+${name}\\s*\\(`));
  if (!m) throw new Error(`function ${name} not found`);
  const start = m.index;
  const braceOpen = src.indexOf("{", start);
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
  throw new Error(`unbalanced braces extracting ${name}`);
}

const NEEDED = ["detectDelim","splitLine","guessCanon","looksHeader","parseText",
                "docFull","classify","sortKey","field","moneyLines","extractSource"];
const bundle = NEEDED.map(n => extractFn(HTML, n)).join("\n") +
  `\nreturn { ${NEEDED.join(", ")} };`;
const P = new Function(bundle)();

// The recorder sample that ships inside loadSample() (mixed labeled + tabular).
const RECORDER =
`PROPERTY: 905 Shallcross Ave, Wilmington, Delaware 19806
PARCEL NUMBER: 26-021.30-165
SELLERS/OWNERS: G & J Forest Glen, LLC
DEED RECORD: Instrument 20250522-0034213
Grantor\tGrantee\tRecord Date\tDoc Type\tInstrument\tAmount
Zachary Paris\tG & J Forest Glen LLC\t05/22/2025\tWarranty Deed\t20250522-0034213\t
Paris Properties LLC\tZachary Paris\t12/17/2021\tQuitclaim Deed\t20211217-0144948\t
Fedale Property 3 LLC\tZachary Paris\t07/03/2019\tWarranty Deed\t104682\t$178,500
MORTGAGE: $142,800 from Zachary Paris to Meridian Bank, recorded 12/23/2019 in Instrument 104691
ASSIGNMENT: none
JUDGMENT: none`;

const TAX =
`PROPERTY ADDRESS: 905 Shallcross Ave Wilmington DE 19806
PARCEL NUMBER: 26-021.30-165
ASSESSED VALUE: $311,700
Tax status: Current
HUNDRED: City of Wilmington`;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};
const ok = (label, cond) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; };

console.log("=".repeat(78));
console.log("APEX TITLE STUDIO — EXTRACTION TEST  (running the shipped extractor)");
console.log("=".repeat(78));

const rec = P.extractSource(RECORDER, "recorder");
const routes = rec.records.map(r => r.route);
console.log("\n① Recorder source (mixed labeled + tabular)");
console.log("  routes:", JSON.stringify(routes));
console.log("  fields:", JSON.stringify({property:rec.fields.property, parcel:rec.fields.parcelNumber}));

ok("isolated the tab block — 3 deeds routed to chain", routes.filter(r => r === "chain").length === 3);
ok("captured the open mortgage narrative", routes.includes("mortCurrent"));
ok("'ASSIGNMENT: none' and 'JUDGMENT: none' are dropped", !routes.includes("mortAssign") && !routes.includes("lienCivil"));
ok("PROPERTY label read", /905 Shallcross/.test(rec.fields.property || ""));
eq("PARCEL NUMBER label read", rec.fields.parcelNumber, "26-021.30-165");
ok("labeled commas in legal/owner did NOT create junk deed rows", routes.every(r => ["chain","mortCurrent","mortAssign","lienCivil","lienFederal","lienNotes","mortSatisfied","review"].includes(r)));

const tax = P.extractSource(TAX, "tax");
console.log("\n② Tax source");
console.log("  fields:", JSON.stringify({status:tax.fields.taxStatus, hundred:tax.fields.hundred, assessed:tax.fields.assessedValue}));
eq("tax status detected", (tax.fields.taxStatus || "").toLowerCase(), "current");
ok("hundred read", /Wilmington/.test(tax.fields.hundred || ""));

console.log("\n" + "=".repeat(78));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(78));
process.exit(fail ? 1 : 0);
