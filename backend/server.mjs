// server.mjs — local Phase-1 backend. Serves the chatbot UI and the generate API.
// No external deps (Node built-in http). Run: node server.mjs  (then open http://localhost:8787)
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateReport } from "./lib/orchestrate.mjs";
import { STYLE, runPipeline } from "../tools/pipeline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const UI = fs.readFileSync(path.join(HERE, "public", "index.html"), "utf8");
// Google Apps Script /exec Web App URL. Set GDOC_ENDPOINT to enable one-click Google Doc.
const GDOC_ENDPOINT = process.env.GDOC_ENDPOINT || "";

const send = (res, code, type, body) => { res.writeHead(code, { "Content-Type": type }); res.end(body); };
const readBody = async (req) => { let b = ""; for await (const c of req) b += c; return b; };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html"))
      return send(res, 200, "text/html; charset=utf-8", UI);
    if (req.method === "GET" && req.url === "/report.css")
      return send(res, 200, "text/css", STYLE);

    if (req.method === "GET" && req.url.startsWith("/assets/")) {
      const safe = path.normalize(req.url).replace(/^(\.\.[/\\])+/, "");
      const fp = path.join(HERE, "public", safe);
      if (fs.existsSync(fp)) {
        const ext = path.extname(fp).slice(1).toLowerCase();
        const mime = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", svg:"image/svg+xml", ico:"image/x-icon",
          js:"text/javascript; charset=utf-8", css:"text/css; charset=utf-8", json:"application/json", woff:"font/woff", woff2:"font/woff2" }[ext] || "application/octet-stream";
        return send(res, 200, mime, fs.readFileSync(fp));
      }
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      const { address } = JSON.parse((await readBody(req)) || "{}");
      if (!address) return send(res, 400, "application/json", JSON.stringify({ ok: false, error: "address required" }));
      const r = await generateReport(address);
      if (!r.ok) return send(res, 200, "application/json", JSON.stringify(r));
      // hand back the report HTML + a flag summary for the review panel
      const flags = {
        openMortgages: r.model.mortgages.filter(m => m.status === "Open").length,
        chainNotes: (r.model.chainNotes || []).length,
        otherProperty: r.model.chain.filter(c => c.flag === "otherProperty").length,
        unverified: [...["property","parcelNumber","sellersOwners","legalDescription","taxStatus"]
          .filter(k => r.model[k] && r.model[k].v && !r.model[k].verified)].length,
        source: r.source,
      };
      // Build the {{PLACEHOLDER}}->value map the Apps Script expects, from the same store.
      // (orchestrate.mjs only returns {html,model}; re-run the pipeline to lift the tokens.)
      let tokens = null;
      try { tokens = runPipeline(r.store, {}).tokens; } catch (e) { tokens = null; }
      const title = `Apex Title Report — ${r.assessor.owner || r.address}`;
      return send(res, 200, "application/json", JSON.stringify({ ok: true, address: r.address,
        owner: r.assessor.owner, parcel: r.assessor.parcel, html: r.html, flags, tokens, title,
        gdocEnabled: !!GDOC_ENDPOINT }));
    }

    if (req.method === "POST" && req.url === "/api/gdoc") {
      const { title, tokens } = JSON.parse((await readBody(req)) || "{}");
      if (!GDOC_ENDPOINT) return send(res, 200, "application/json", JSON.stringify({ ok: false, reason: "not_configured" }));
      try {
        const gr = await fetch(GDOC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ title: title || `Apex Title Report — ${new Date().toISOString().slice(0,10)}`, tokens: tokens || {} }),
        });
        const data = await gr.json();
        if (data && data.ok && data.url) return send(res, 200, "application/json", JSON.stringify({ ok: true, url: data.url, id: data.id }));
        return send(res, 200, "application/json", JSON.stringify({ ok: false, reason: "gdoc_error", error: (data && data.error) || "no url returned" }));
      } catch (e) {
        return send(res, 200, "application/json", JSON.stringify({ ok: false, reason: "unreachable", error: e.message }));
      }
    }

    send(res, 404, "text/plain", "not found");
  } catch (e) {
    send(res, 500, "application/json", JSON.stringify({ ok: false, error: e.message }));
  }
});
server.listen(PORT, () => console.log(`Apex Phase-1 backend on http://localhost:${PORT}`));
