// Offline mapping test for the ATTOM source. Verifies mapAttom() normalizes a documented
// ATTOM expandedprofile + expandedhistory response into the record shape the orchestrator
// consumes — no network, no API key. Live behavior is covered separately once a key exists.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mapAttom } from "../backend/lib/sources/attom.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fx = JSON.parse(readFileSync(join(ROOT, "test/fixtures/attom_226_n_star.json"), "utf8"));
const r = mapAttom(fx.profile, fx.history);

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; };

console.log("=".repeat(70));
console.log("APEX — ATTOM SOURCE MAPPING TEST (offline fixture)");
console.log("=".repeat(70));

ok("owner combines owner1 + owner2", r.owner === "WILSON, KEITH A & LANE, TAMMY M");
ok("parcel = APN", r.parcel === "08-023.20-089");
ok("address one-line", /226 NORTH STAR RD/.test(r.address));
ok("subdivision", r.subdivision === "NORTH STAR SEC A");
ok("legal captured", /NORTH STAR/.test(r.legal));
ok("assessment total", r.assessmentTotal === "628000");
ok("tax status is honest (not asserted Current)", /not stated in ATTOM/i.test(r.taxStatus));
ok("deed history has 3 transfers", r.deedHistory.length === 3);
ok("newest deed grantee = Wilson", /WILSON/.test(r.deedHistory[0].grantee));
ok("deed dates normalized to MM/DD/YYYY", /^\d{2}\/\d{2}\/\d{4}$/.test(r.deedHistory[0].saleDate));
ok("deed amount carries $", r.deedHistory[0].amount === "$390000");
ok("at least one mortgage mapped", r.mortgages.length >= 1);
ok("mortgage lender + amount", /WSFS/.test(r.mortgages[0].lender) && r.mortgages[0].amount === "$390000");

// graceful degradation: empty/partial input must not throw
const empty = mapAttom({}, {});
ok("empty input degrades safely", empty.owner === "" && empty.deedHistory.length === 0 && !empty.error);

console.log("\n" + "=".repeat(70));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(70));
process.exit(fail ? 1 : 0);
