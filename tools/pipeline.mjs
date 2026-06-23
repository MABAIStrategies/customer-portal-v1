// pipeline.mjs — shared seam that runs the SHIPPED Apex Title Studio pipeline headlessly.
//
// Lifts the deterministic functions/consts straight out of Apex_Title_Studio.html
// (extractSource → composeNorthStar → reconcile → analyzeChain → buildReport) and the
// report <style>, then exposes runPipeline(store, opts) → { html, model } plus STYLE and
// renderPage(). Both the offline address-trial harness (render_report.mjs) and the live
// scraper backend feed the same four source-zone texts through this single brain.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HTML = fs.readFileSync(path.join(ROOT, "Apex_Title_Studio.html"), "utf8");

function liftFn(name) {
  const m = HTML.match(new RegExp(`function\\s+${name}\\s*\\(`));
  if (!m) throw new Error(`fn ${name} not found`);
  const start = m.index, open = HTML.indexOf("{", start);
  let d = 0, s = null, esc = false, lc = false, bc = false;
  for (let i = open; i < HTML.length; i++) {
    const c = HTML[i], n = HTML[i + 1];
    if (lc) { if (c === "\n") lc = false; continue; }
    if (bc) { if (c === "*" && n === "/") { bc = false; i++; } continue; }
    if (s) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === s) s = null; continue; }
    if (c === "/" && n === "/") { lc = true; i++; continue; }
    if (c === "/" && n === "*") { bc = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { s = c; continue; }
    if (c === "{") d++;
    else if (c === "}") { if (--d === 0) return HTML.slice(start, i + 1); }
  }
  throw new Error(`unbalanced ${name}`);
}
function liftArrayConst(name) {
  const m = HTML.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[`));
  if (!m) throw new Error(`const ${name} not found`);
  const start = m.index, open = HTML.indexOf("[", start);
  let d = 0, s = null, esc = false;
  for (let i = open; i < HTML.length; i++) {
    const c = HTML[i];
    if (s) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === s) s = null; continue; }
    if (c === '"' || c === "'" || c === "`") { s = c; continue; }
    if (c === "[") d++;
    else if (c === "]") { if (--d === 0) return HTML.slice(start, i + 1) + ";"; }
  }
  throw new Error(`unbalanced const ${name}`);
}

export const STYLE = HTML.slice(HTML.indexOf("<style>") + 7, HTML.indexOf("</style>"));

const FNS = ["detectDelim","splitLine","guessCanon","looksHeader","parseText","docFull","classify",
  "sortKey","field","moneyLines","extractSource","normName","shareTok","lenderReaches","reconcile",
  "analyzeChain","composeNorthStar","itemStatus","listHtml","anyUnverified","row","buildReport"];

const preamble = `
const esc=s=>(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let __CAP="";
const $=(sel)=>({ set innerHTML(v){ if(sel==="#reportwrap") __CAP=v; }, get innerHTML(){return "";}, style:{} });
${liftArrayConst("SOURCES")}
${liftArrayConst("SCALAR")}
${liftArrayConst("LISTS")}
`;
const body = preamble + FNS.map(liftFn).join("\n") + `
let SIGNATURE=null;
let MODEL=composeNorthStar();
if(opts){ for(const k in opts){ if(MODEL[k]&&"v"in MODEL[k]) MODEL[k]={v:opts[k],verified:false,source:"derived"}; } }
buildReport();
return { html:__CAP, model:MODEL };
`;
// the lifted composeNorthStar reads the free var `store` (the four source-zone texts).
export const runPipeline = new Function("store", "opts", body);

export function renderPage(html, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head><body class="printing">${html}</body></html>`;
}
