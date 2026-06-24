// server.mjs — local Phase-1 backend. Serves the chatbot UI and the generate API.
// No external deps (Node built-in http). Run: node server.mjs  (then open http://localhost:8787)
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateReport } from "./lib/orchestrate.mjs";
import { STYLE } from "../tools/pipeline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const UI = fs.readFileSync(path.join(HERE, "public", "index.html"), "utf8");

const send = (res, code, type, body) => { res.writeHead(code, { "Content-Type": type }); res.end(body); };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html"))
      return send(res, 200, "text/html; charset=utf-8", UI);
    if (req.method === "GET" && req.url === "/report.css")
      return send(res, 200, "text/css", STYLE);

    if (req.method === "POST" && req.url === "/api/generate") {
      let body = ""; for await (const c of req) body += c;
      const { address } = JSON.parse(body || "{}");
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
      return send(res, 200, "application/json", JSON.stringify({ ok: true, address: r.address,
        owner: r.assessor.owner, parcel: r.assessor.parcel, html: r.html, flags }));
    }
    send(res, 404, "text/plain", "not found");
  } catch (e) {
    send(res, 500, "application/json", JSON.stringify({ ok: false, error: e.message }));
  }
});
server.listen(PORT, () => console.log(`Apex Phase-1 backend on http://localhost:${PORT}`));
