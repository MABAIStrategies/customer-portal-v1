// Offline mapping test for the BatchData source. Verifies mapBatchData() normalizes a property
// record in BatchData's CONFIRMED schema (deedHistory / mortgageHistory / openLien / involuntaryLien
// / legal.legalDescription) into the record shape the orchestrator consumes — no network, no balance.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mapBatchData } from "../backend/lib/sources/batchdata.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fx = JSON.parse(readFileSync(join(ROOT, "test/fixtures/batchdata_606_s_franklin.json"), "utf8"));
const r = mapBatchData(fx);

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; };

console.log("=".repeat(70));
console.log("APEX — BATCHDATA SOURCE MAPPING TEST (offline, confirmed schema)");
console.log("=".repeat(70));

ok("owner from owner.fullName", r.owner === "Acacia Jolene Blassengale");
ok("parcel = ids.apn", r.parcel === "26-042.10-114");
ok("address one-line", /606 S Franklin St/i.test(r.address) && /Wilmington/i.test(r.address));
ok("subdivision = legal.subdivisionName", r.subdivision === "WILMINGTON");
ok("lot = legal.lotNumber", r.lot === "8");
ok("brief legal captured (legal.legalDescription)", /WILMINGTON/.test(r.legal) && !/BEGINNING/.test(r.legal));
ok("assessment total", r.assessmentTotal === "45200");
ok("tax status honest (no delinquency flagged -> not asserted Current)", /No delinquency flagged/i.test(r.taxStatus) && !/^Current$/i.test(r.taxStatus));

ok("deed history has 3 transfers (sellers/buyers)", r.deedHistory.length === 3);
ok("newest deed grantor=PROPERTIES 81, grantee=Blassengale", /PROPERTIES 81/.test(r.deedHistory[0].grantor) && /BLASSENGALE/.test(r.deedHistory[0].grantee));
ok("deed dates normalized to MM/DD/YYYY", /^\d{2}\/\d{2}\/\d{4}$/.test(r.deedHistory[0].saleDate));
ok("deed salePrice carries $", r.deedHistory[0].amount === "$215000");
ok("deed documentNumber captured", r.deedHistory[0].doc === "20230327-0019021");

ok("3 mortgages mapped from mortgageHistory", r.mortgages.length === 3);
ok("Keystone mortgage flagged OPEN via openLien", r.mortgages.find(m => /Keystone/.test(m.lender))?.open === true);
ok("old Bruzda/WSFS mortgage NOT open", r.mortgages.find(m => /WSFS/.test(m.lender))?.open === false);
ok("Keystone open lien shows assignment to Planet Home", /Planet Home/.test(r.mortgages.find(m => /Keystone/.test(m.lender))?.assignedTo || ""));
ok("mortgage doc number pulled from sale.lastSale.mortgages", r.mortgages.find(m => /Keystone/.test(m.lender))?.doc === "20230327-0019025");

ok("involuntary lien classified as judgment", r.liens.judgment.length === 1);
ok("judgment line has plaintiff v. defendant + amount + doc", /Planet Home Lending, LLC v\. Acacia Jolene Blassengale/.test(r.liens.judgment[0]) && /\$169781\.7/.test(r.liens.judgment[0]) && /N26L-01-062/.test(r.liens.judgment[0]));

// full-legal path: if BatchData ever returns a metes-and-bounds body, it is captured verbatim
const full = mapBatchData({ legal: { legalDescription: "BEGINNING at a point on the Southeasterly side of Franklin Street; thence South 28 degrees 30 minutes 00 seconds West 52.50 feet... TOGETHER with the use of a 3' Wide Alley." } });
ok("full metes-and-bounds captured verbatim when present", /BEGINNING/.test(full.legal) && /degrees/.test(full.legal));

// federal/state/mechanics classification
const liensFx = mapBatchData({ involuntaryLien: { liens: [
  { lienType: "Federal Tax Lien", lienAmount: 14905, recordingDate: "2018-02-01", documentNumber: "X1", parties: [{ fullName: "Internal Revenue Service", roleType: "Plaintiff" }, { fullName: "John Doe", roleType: "Defendant" }] },
  { lienType: "State Tax Lien", lienAmount: 3540, recordingDate: "2023-08-14", documentNumber: "X2", parties: [{ fullName: "State of Delaware", roleType: "Plaintiff" }] },
  { lienType: "Mechanic's Lien", lienAmount: 4200, recordingDate: "2023-09-05", documentNumber: "X3", parties: [{ fullName: "Coastal Builders LLC", roleType: "Plaintiff" }] }
] } });
ok("federal/state/mechanics liens classified into their buckets", liensFx.liens.federal.length === 1 && liensFx.liens.state.length === 1 && liensFx.liens.mechanics.length === 1);

// graceful degradation
const empty = mapBatchData({});
ok("empty input degrades safely", empty.owner === "" && empty.deedHistory.length === 0 && empty.mortgages.length === 0 && !empty.error);

console.log("\n" + "=".repeat(70));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(70));
process.exit(fail ? 1 : 0);
