#!/usr/bin/env node
/**
 * Inline PDF.js into Apex_Title_Studio.html so the app reads dropped PDFs
 * fully offline (no CDN). Idempotent — safe to re-run after editing the app.
 *
 *   node tools/build_studio.mjs
 *
 * Replaces the region between <!--PDFJS-INLINE--> and <!--/PDFJS-INLINE-->
 * (or, on first run, just the opening marker) with the vendored library + a
 * same-document worker script that the app turns into a Blob URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO = join(ROOT, "Apex_Title_Studio.html");
const PDF = readFileSync(join(ROOT, "vendor/pdfjs/pdf.min.js"), "utf8");
const WORKER = readFileSync(join(ROOT, "vendor/pdfjs/pdf.worker.min.js"), "utf8");

for (const [name, body] of [["pdf.min.js", PDF], ["pdf.worker.min.js", WORKER]]) {
  if (/<\/script/i.test(body)) throw new Error(`${name} contains </script> — unsafe to inline`);
}

const OPEN = "<!--PDFJS-INLINE-->", CLOSE = "<!--/PDFJS-INLINE-->";
const ST = "<scr" + "ipt>", EN = "</scr" + "ipt>";
const injection =
  OPEN + "\n" +
  ST + "\n" + PDF + "\n" + EN + "\n" +
  '<scr' + 'ipt type="text/js-worker" id="pdfWorkerSrc">\n' + WORKER + "\n" + EN + "\n" +
  CLOSE;

let html = readFileSync(STUDIO, "utf8");
if (!html.includes(OPEN)) throw new Error("marker <!--PDFJS-INLINE--> not found in Apex_Title_Studio.html");

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
if (html.includes(CLOSE)) {
  html = html.replace(new RegExp(esc(OPEN) + "[\\s\\S]*?" + esc(CLOSE)), () => injection);
} else {
  html = html.replace(OPEN, () => injection);
}

writeFileSync(STUDIO, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Inlined PDF.js into Apex_Title_Studio.html — now ${kb} KB, self-contained & offline.`);
