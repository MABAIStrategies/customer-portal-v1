// Offline mapping test for the BatchData source. Verifies mapBatchData() normalizes a documented
// BatchData property/lookup response into the record shape the orchestrator consumes — no network,
// no balance needed. Live behavior is covered once the token has balance (drop a recorded response
// into test/fixtures/ and confirm the field paths).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mapBatchData } from "../backend/lib/sources/batchdata.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fx = JSON.parse(readFileSync(join(ROOT, "test/fixtures/batchdata_606_s_franklin.json"), "utf8"));
const r = mapBatchData(fx.results.properties[0]);

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; };

console.log("=".repeat(70));
console.log("APEX — BATCHDATA SOURCE MAPPING TEST (offline fixture)");
console.log("=".repeat(70));

ok("owner from owner.names", r.owner === "Acacia Jolene Blassengale");
ok("parcel = APN", r.parcel === "26-042.10-114");
ok("address one-line", /606 S Franklin St/i.test(r.address) && /Wilmington/i.test(r.address));
ok("subdivision captured", r.subdivision === "WILMINGTON");
ok("lot captured (feeds the deed shell)", r.lot === "8");
ok("assessment total", r.assessmentTotal === "45200");
ok("tax status is honest (not asserted Current)", /not stated in BatchData/i.test(r.taxStatus));

ok("deed history has 3 transfers", r.deedHistory.length === 3);
ok("newest deed grantee = Blassengale", /BLASSENGALE/.test(r.deedHistory[0].grantee));
ok("deed dates normalized to MM/DD/YYYY", /^\d{2}\/\d{2}\/\d{4}$/.test(r.deedHistory[0].saleDate));
ok("deed amount carries $", r.deedHistory[0].amount === "$215000");
ok("deed document number captured", r.deedHistory[0].doc === "20230327-0019021");

ok("two mortgages mapped", r.mortgages.length === 2);
ok("mortgage lender + amount (Keystone $172,812)", /Keystone/.test(r.mortgages[0].lender) && r.mortgages[0].amount === "$172812");
ok("HUD second mortgage with cents", /Housing and Urban/.test(r.mortgages[1].lender) && r.mortgages[1].amount === "$8453.62");

ok("involuntary lien/judgment surfaced", r.liens.length === 1 && /Planet Home Lending/.test(r.liens[0].line));

// brief-legal case: this fixture carries only subdivision/lot → legal stays empty so the
// orchestrator renders the Delaware deed shell rather than echoing a half-legal.
ok("brief-only legal left empty for the deed shell", r.legal === "");

// full-legal case: when BatchData DOES return a metes-and-bounds body, it is captured verbatim
// (recordToZones detects BEGINNING…/degrees and uses it as-is).
const full = mapBatchData({
  legal: { description: "BEGINNING at a point on the Southeasterly side of Franklin Street at 60 feet wide, said point being a common corner for lands herein described and lands now or formerly of Linda J. Bruzda; thence South 28 degrees 30 minutes 00 seconds West 52.50 feet... TOGETHER with the use of a 3' Wide Alley in Common with Others." }
});
ok("full metes-and-bounds captured verbatim when present", /BEGINNING/.test(full.legal) && /degrees/.test(full.legal));

// graceful degradation: empty/partial input must not throw
const empty = mapBatchData({});
ok("empty input degrades safely", empty.owner === "" && empty.deedHistory.length === 0 && empty.mortgages.length === 0 && !empty.error);

console.log("\n" + "=".repeat(70));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(70));
process.exit(fail ? 1 : 0);
