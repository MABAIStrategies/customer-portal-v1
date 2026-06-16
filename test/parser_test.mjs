#!/usr/bin/env node
/**
 * Apex Title Form Filler — parser test harness
 * --------------------------------------------------------------------------
 * This does NOT re-implement the parser. It extracts the real, shipped parser
 * functions out of Apex_Title_Form_Filler.html (by balanced-brace slicing) and
 * runs the 5 demo datasets through the same parse -> classify -> chain-sort
 * pipeline the browser uses, asserting the routing and ordering Zach will see.
 *
 * The parsing pipeline has no DOM dependencies, so it runs in plain Node with
 * zero installs:   node test/parser_test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(join(ROOT, "Apex_Title_Form_Filler.html"), "utf8");

/** Slice `function <name>(...) { ... }` out of the source by matching braces. */
function extractFn(src, name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start === -1) throw new Error(`function ${name} not found in HTML`);
  const braceOpen = src.indexOf("{", start);
  let depth = 0, inStr = null, esc = false;
  for (let i = braceOpen; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

// Pull the pure functions (and the CANON map literal) the browser actually ships.
const NEEDED = ["detectDelim", "splitLine", "looksHeader", "guessCanon", "parseText",
                "classify", "docFull", "sortKey"];
const canonLine = HTML.split("\n").find(l => l.includes("const CANON=")).trim();
const bundle = canonLine + "\nconst CANON_KEYS=Object.keys(CANON);\n" +
  NEEDED.map(n => extractFn(HTML, n)).join("\n") +
  `\nreturn { ${NEEDED.join(", ")}, CANON, CANON_KEYS };`;
const P = new Function(bundle)();

// Mirror the two tiny glue helpers from commit()/renderParse() so we tally the
// same way the UI does: rowObj() builds a record from the column map, and a
// route of "review" defaults to "skip" (i.e. NOT auto-filed).
function rowObj(map, row) {
  const o = {};
  map.forEach((k, i) => { if (k && k !== "skip" && row[i]) o[k] = row[i]; });
  return o;
}
function routeOf(docType) { const r = P.classify(docType); return r === "review" ? "skip" : r; }

// ── assertions ───────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  ${ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

function run(file, label) {
  const text = readFileSync(join(ROOT, "demo", file), "utf8");
  const st = P.parseText(text);
  const rows = st.hasHeader ? st.grid.slice(1) : st.grid;
  const recs = rows.map(r => rowObj(st.map, r));
  const routes = recs.map(o => routeOf(o.docType));

  const tally = {};
  routes.forEach(r => { tally[r] = (tally[r] || 0) + 1; });

  // chain sorted newest -> oldest, like commit()
  const chain = recs.filter((_, i) => routes[i] === "chain")
    .sort((a, b) => P.sortKey(b.recDate) - P.sortKey(a.recDate));

  console.log(`\n${label}  (${file})`);
  console.log(`  header detected: ${st.hasHeader} · delimiter cols: ${st.width} · rows: ${rows.length}`);
  console.log(`  routing tally: ${JSON.stringify(tally)}`);
  console.log(`  chain (newest→oldest): ${chain.map(o => `${o.grantor}→${o.grantee} (${o.recDate})`).join("  |  ")}`);
  return { st, recs, routes, tally, chain };
}

console.log("=".repeat(78));
console.log("APEX TITLE FORM FILLER — PARSER TEST  (running the shipped browser code)");
console.log("=".repeat(78));

// Dataset 1 — New Castle, Clear
{
  const { st, tally, chain } = run("dataset1_newcastle_clear.tsv", "① New Castle — Clean / Clear");
  eq("header row recognised", st.hasHeader, true);
  eq("chain transfers", tally.chain || 0, 2);
  eq("current mortgages", tally.mortCurrent || 0, 1);
  eq("no liens", (tally.lienCivil||0)+(tally.lienFederal||0)+(tally.lienTax||0)+(tally.lienNotes||0), 0);
  eq("newest deed = current owner HARPER", chain[0].grantee, "HARPER, DANIEL R & SARAH L");
}

// Dataset 2 — Kent, Clouded
{
  const { tally } = run("dataset2_kent_clouded.tsv", "② Kent — Clouded");
  eq("chain transfers", tally.chain || 0, 2);
  eq("current mortgages", tally.mortCurrent || 0, 1);
  eq("civil judgment routed", tally.lienCivil || 0, 1);
}

// Dataset 3 — Sussex, Requires Resolution (instrument-only, chain gap)
{
  const { st, tally, recs } = run("dataset3_sussex_resolution.tsv", "③ Sussex — Requires Resolution");
  eq("chain transfers", tally.chain || 0, 2);
  eq("federal lien routed (before generic tax)", tally.lienFederal || 0, 1);
  eq("lis pendens → status notes", tally.lienNotes || 0, 1);
  eq("instrument-only rows (no book/page)", recs.every(o => !o.book && !o.page), true);
}

// Dataset 4 — New Castle, Commercial / LLC (the satisfaction-matching caveat)
{
  const { tally, recs, routes } = run("dataset4_newcastle_commercial.tsv", "④ New Castle — Commercial / LLC");
  eq("chain transfers", tally.chain || 0, 1);
  eq("assignments routed", tally.mortAssign || 0, 2);
  eq("satisfaction routed", tally.mortSatisfied || 0, 1);
  // KEY CAVEAT: the already-satisfied 2017 WSFS mortgage still lands under CURRENT.
  eq("mortgages under CURRENT (incl. one already satisfied)", tally.mortCurrent || 0, 2);
  const wsfs2017 = recs.findIndex(o => o.recDate === "01/20/2017");
  eq("→ 2017 WSFS mortgage auto-routes to mortCurrent (Zach must move it)", routes[wsfs2017], "mortCurrent");
}

// Dataset 5 — Messy real-world (comma, quoted commas, other-property, abbrev)
{
  const { st, tally, recs, routes } = run("dataset5_messy_realworld.csv", "⑤ Messy real-world paste");
  eq("comma delimiter handled (header recognised)", st.hasHeader, true);
  eq("quoted comma kept inside legal", recs[0].legal, "LOT 9 BIRCHWOOD, PHASE 2");
  eq("deeds incl. other-property row → chain", tally.chain || 0, 3);
  eq("mortgage routed", tally.mortCurrent || 0, 1);
  // 'SAT' abbreviation is NOT auto-recognised → defaults to skip (manual route needed).
  const satIdx = recs.findIndex(o => o.docType === "SAT");
  eq("→ bare 'SAT' abbrev defaults to skip (needs manual routing)", routes[satIdx], "skip");
}

console.log("\n" + "=".repeat(78));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(78));
process.exit(fail ? 1 : 0);
