// ============================================================================
// cloud.test.mjs — שכבת הנתונים מול Firestore אמיתי (אמולטור).
//
// הרצה:  npm run test:cloud       (דורש Java)
//
// ⚠ smoke בודק שהתוכניות **נכונות**; כאן נבדק שהן **עוברות**. שלושה דברים
// נשברים רק מול מסד אמיתי ולא בבדיקה טהורה:
//   · מגבלת 500 הפעולות ל-batch — הייבוא כותב 3,335 מסמכים.
//   · `undefined` בשדה מפיל את הכתיבה כולה, בשקט, בלי חריגה בקוד שלנו.
//   · מחיקה-ואז-כתיבה באותה מנה — הסדר קובע אם הרשומה שרדה.
//
// בלי seed הבדיקה **מדולגת ומדווחת**, לא עוברת בשקט.
// ============================================================================

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalize } from "../src/schema.js";
import { ENTITY_COLLECTIONS } from "../src/constants.js";
import { chunkOps, planReplaceAll, planApplyBatch, planRemoveMany } from "../src/utils/cloudWrites.js";
import { indexContracts, indexFees, portfolioTotals } from "../src/utils/profitability.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = resolve(ROOT, "seed/vitzman.json");
const ORG = "vitzman";

let pass = 0, fail = 0, skipped = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); return true; }
  fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  return false;
};
const eq = (name, actual, expected, tol = 0.005) => {
  const good = typeof expected === "number" && typeof actual === "number"
    ? Math.abs(actual - expected) <= tol : Object.is(actual, expected);
  return ok(name, good, good ? "" : `קיבלנו ${JSON.stringify(actual)}, ציפינו ${JSON.stringify(expected)}`);
};

/**
 * ⚠ הבדיקה רצה **דרך הכללים**, כמשתמש מורשה — לא בעקיפתם. כך היא בודקת גם
 * שהכללים עומדים ב-3,335 מסמכים: כל כתיבה מפעילה `get()` על מסמך הארגון,
 * ואם זה היה יקר מדי או שגוי, זה היה מתגלה כאן ולא אצל רונן.
 */
const env = await initializeTestEnvironment({
  projectId: "vitzman-cloud-test",
  firestore: {
    rules: readFileSync(resolve(ROOT, "firestore.rules"), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "orgs", ORG), { members: ["ronen@example.com"] });
});
const db = env.authenticatedContext("u_ronen", { email: "ronen@example.com", email_verified: true }).firestore();

/** בדיוק מה ש-`useData.runOps` עושה — אותו קוד חיתוך, אותה סמנטיקה. */
async function runOps(ops) {
  for (const group of chunkOps(ops)) {
    const batch = writeBatch(db);
    for (const op of group) {
      const ref = doc(db, "orgs", ORG, op.collection, op.id);
      if (op.op === "delete") batch.delete(ref);
      else batch.set(ref, op.data, { merge: op.op === "merge" });
    }
    await batch.commit();
  }
}
async function readAll() {
  const out = {};
  for (const name of ENTITY_COLLECTIONS) {
    const snap = await getDocs(collection(db, "orgs", ORG, name));
    out[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }
  return normalize(out);
}

if (!existsSync(SEED)) {
  skipped++;
  console.log(`  ⊘ כל בדיקות הענן — דולג: seed/vitzman.json לא קיים`);
} else {
  const seed = normalize(JSON.parse(readFileSync(SEED, "utf8")));

  console.log("\n--- ייבוא מלא: 3,335 מסמכים דרך מנות של 450 ---");
  const ops = planReplaceAll(seed, normalize({}));
  const groups = chunkOps(ops);
  ok(`${ops.length} פעולות נחתכו ל-${groups.length} מנות`, groups.length > 1);
  const t0 = Date.now();
  await runOps(ops);
  console.log(`    (${((Date.now() - t0) / 1000).toFixed(1)} שניות)`);

  const back = await readAll();
  for (const name of ENTITY_COLLECTIONS) {
    eq(`${name}: ${seed[name].length} נכתבו ונקראו`, back[name].length, seed[name].length);
  }

  console.log("\n--- ⚠ המספרים חייבים לשרוד את המסע לענן וחזרה ---");
  const idx = indexContracts(back.contracts);
  const fees = indexFees(back.feeAgreements);
  const totals = portfolioTotals(back.buildings, idx, "2026-09-01", fees);
  eq("הכנסה 1,088,983 ₪", totals.income, 1088983);
  eq("הוצאה 940,050.08 ₪", totals.cost, 940050.08);
  eq("רווח 148,932.92 ₪", totals.profit, 148932.92);

  console.log("\n--- ⚠ null שורד; undefined היה מפיל את הכתיבה ---");
  const nulls = back.contracts.filter((c) => c.amount === null).length;
  ok(`${nulls} חוזים עם amount=null (״הוועד משלם ישירות״)`, nulls > 0,
    "אם זה 0 — הערך הומר בדרך, וההוצאה מנופחת");
  ok("אף חוזה לא איבד את vendorId=null",
    back.contracts.every((c) => "vendorId" in c));

  console.log("\n--- שיוך מרוכז: 39 בניינים בפעולה אחת ---");
  const targets = back.buildings.filter((b) => b.status === "active").slice(0, 39);
  await runOps(planApplyBatch("buildings", {
    updates: targets.map((b) => ({ id: b.id, patch: { areaManager: "אבי" } })),
    creates: [],
  }));
  const after = await readAll();
  eq("כולם קיבלו את מנהל האיזור",
    targets.filter((t) => after.buildings.find((b) => b.id === t.id)?.areaManager === "אבי").length, 39);
  ok("⚠ ושאר השדות לא נדרסו — merge ולא set",
    after.buildings.find((b) => b.id === targets[0].id)?.address === targets[0].address,
    "set היה מוחק את הכתובת, הסטטוס והשיוך");

  console.log("\n--- מחיקת בניין: cascade חוצה-אוספים ---");
  const victim = after.buildings.find((b) => after.contracts.some((c) => c.buildingId === b.id));
  const dep = {
    contracts: after.contracts.filter((c) => c.buildingId === victim.id).map((x) => x.id),
    feeAgreements: after.feeAgreements.filter((f) => f.buildingId === victim.id).map((x) => x.id),
    notes: after.notes.filter((n) => n.buildingId === victim.id).map((x) => x.id),
    buildings: [victim.id],
  };
  await runOps(planRemoveMany(dep));
  const gone = await readAll();
  ok("הבניין נמחק", !gone.buildings.some((b) => b.id === victim.id));
  ok("⚠ ואפס רשומות יתומות",
    ![...gone.contracts, ...gone.feeAgreements, ...gone.notes].some((x) => x.buildingId === victim.id));

  console.log("\n--- ייבוא חוזר: מחליף, לא מוסיף ---");
  await runOps(planReplaceAll(seed, gone));
  const again = await readAll();
  eq("הבניין המחוק חזר", again.buildings.length, seed.buildings.length);
  eq("ומספר החוזים זהה — לא הוכפל", again.contracts.length, seed.contracts.length);
  const t2 = portfolioTotals(again.buildings, indexContracts(again.contracts), "2026-09-01", indexFees(again.feeAgreements));
  eq("והרווח חזר לעצמו", t2.profit, 148932.92);
}

await env.cleanup();
console.log(`\n${"=".repeat(50)}\n  עברו ${pass} · נכשלו ${fail} · דולגו ${skipped}`);
if (failures.length) { console.log("\n  כשלונות:"); for (const f of failures) console.log(`    ✗ ${f}`); }
console.log(`${"=".repeat(50)}\n`);
process.exit(fail ? 1 : 0);
