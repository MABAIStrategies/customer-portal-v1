// pdf_to_text.mjs — extract plain text from a PDF using the SAME offline engine the app
// uses (vendor/pdfjs, v3.11.174), running headless in Node. No external deps, no network.
//
//   import { pdfToText } from "./tools/pdf_to_text.mjs";
//   const txt = await pdfToText("/path/to/file.pdf");
//
// or:  node tools/pdf_to_text.mjs <file.pdf>
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let _lib = null;
async function pdfjs() {
  if (_lib) return _lib;
  // The UMD bundle exposes the full API (incl. GlobalWorkerOptions) on `.default`.
  const mod = await import(pathToFileURL(path.join(ROOT, "vendor/pdfjs/pdf.min.js")).href);
  const L = mod.default && mod.default.getDocument ? mod.default : mod;
  L.GlobalWorkerOptions.workerSrc = path.join(ROOT, "vendor/pdfjs/pdf.worker.min.js");
  _lib = L;
  return L;
}

// Join one page's text items into lines, using pdf.js y-coordinates so the layout survives
// (the in-browser extractPdf() relies on the visual order; we reconstruct rows the same way).
function itemsToText(items) {
  const rows = [];
  let cur = null, lastY = null;
  for (const it of items) {
    const y = it.transform ? Math.round(it.transform[5]) : null;
    if (lastY === null || (y !== null && Math.abs(y - lastY) > 3)) {
      cur = [];
      rows.push(cur);
      lastY = y;
    }
    if (it.str) cur.push(it.str);
  }
  return rows.map(r => r.join(" ").replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

export async function pdfToText(file) {
  const L = await pdfjs();
  const data = new Uint8Array(fs.readFileSync(file));
  const pdf = await L.getDocument({ data, isEvalSupported: false, useSystemFonts: false }).promise;
  try {
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      out.push(itemsToText(tc.items));
    }
    return out.join("\n");
  } finally {
    await pdf.destroy();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = process.argv[2];
  if (!f) { console.error("usage: node tools/pdf_to_text.mjs <file.pdf>"); process.exit(1); }
  pdfToText(f).then(t => process.stdout.write(t + "\n"));
}
