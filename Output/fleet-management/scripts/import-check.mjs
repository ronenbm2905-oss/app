// ============================================================================
// import-check.mjs — מריץ את **אותו** פרסור שרץ בדפדפן, מול קובץ אמיתי,
// מ-node. כלי אימות, לא חלק מהאפליקציה.
//
//   node scripts/import-check.mjs "<path.xlsx>" [sheet] [--names]
//
// ברירת המחדל **מצנזרת שמות** (מציגה רק את סיווג התא), כדי שלא ידפיסו
// בטעות שמות עובדים אמיתיים ללוג/לצילום מסך. `--names` מציג הכל, לשימוש
// מקומי בלבד.
//
// אותה חבילה (`read-excel-file`) בדיוק כמו בדפדפן — אם הבדיקה כאן עוברת,
// הפרסור בדפדפן זהה.
// ============================================================================

import readXlsxFile, { readSheetNames } from "read-excel-file/node";
import { analyzeImport } from "../src/utils/importExcel.js";
import { buildImportWrite } from "../src/utils/importBuild.js";
import { EMPTY } from "../src/constants.js";
import { resolveDriverForFine } from "../src/utils/assignments.js";

const [, , filePath, sheetArg, ...flags] = process.argv;
const showNames = flags.includes("--names") || sheetArg === "--names";
const sheetName = sheetArg && sheetArg !== "--names" ? sheetArg : null;

if (!filePath) {
  console.error('usage: node scripts/import-check.mjs "<path.xlsx>" [sheet] [--names]');
  process.exit(2);
}

const mask = (s) => {
  if (!s) return "";
  if (showNames) return s;
  const t = String(s);
  return t.length <= 2 ? "••" : `${t.slice(0, 1)}${"•".repeat(Math.min(t.length - 1, 8))}`;
};

const sheets = await readSheetNames(filePath);
const target = sheetName || sheets[0];
console.log(`קובץ: ${filePath.split(/[\\/]/).pop()}`);
console.log(`גיליונות בקובץ: ${sheets.length} · נבחר: "${target}"`);

const rows = await readXlsxFile(filePath, { sheet: target });
console.log(`שורות בגריד: ${rows.length}`);

const plan = analyzeImport(rows, EMPTY, { fileName: filePath.split(/[\\/]/).pop(), sheet: target });
if (!plan.ok) {
  console.error("הפרסור נכשל:", plan.errorKey);
  process.exit(1);
}

console.log(`\nשורת כותרת: ${plan.header.rowNumber}`);
console.log("מיפוי עמודות:", JSON.stringify(plan.header.columns));
if (plan.missingCols.length) console.log("עמודות שלא נמצאו:", plan.missingCols.join(", "));

console.log("\n— מה ייווצר —");
for (const [k, v] of Object.entries(plan.counts)) console.log(`  ${k.padEnd(24)} ${v}`);

console.log("\n— שורות שסומנו לבדיקה ידנית —");
for (const r of plan.rows.filter((x) => x.assignment?.needsReview)) {
  console.log(
    `  שורה ${String(r.rowNumber).padStart(2)} · ${r.plateRaw} · [${r.driverReasons.join(", ")}]` +
      `\n      importRaw: "${mask(r.assignment.importRaw)}"${r.status === "pool" ? "  → pool" : ""}`
  );
}

console.log("\n— ערכים שנדחו —");
for (const r of plan.rejected) {
  console.log(`  שורה ${r.rowNumber} · ${r.field} · ערך "${r.raw}" · ${r.reasonKey}`);
}

console.log("\n— שורות שדולגו —");
for (const s of plan.skipped) {
  console.log(`  שורה ${s.rowNumber} · ${s.reasonKey} · ${showNames ? s.preview : s.preview.slice(0, 40)}`);
}

console.log("\n— חברות ליסינג —");
for (const c of plan.leaseCompanies) {
  console.log(
    `  "${c.name}" (${c.action}) · וריאנטים: ${c.variants.map((v) => `"${v}"`).join(", ")} · ${c.rows.length} שורות`
  );
  if (c.contact) {
    console.log(
      `      איש קשר משורה ${c.contact.rowNumber}: ${mask(c.contact.contactName)} · ${c.contact.phone} · ${c.contact.email}`
    );
    if (c.contact.notes) console.log(`      נוסף: ${mask(c.contact.notes)}`);
  }
}

console.log("\n— הרכבים שייווצרו —");
for (const r of plan.rows) {
  const drv =
    r.driverKind === "name" ? mask(r.driverName) : r.driverKind === "freeText" ? "⚑ לבדיקה" : "—";
  console.log(
    `  ${String(r.rowNumber).padStart(2)} | ${r.plateRaw.padEnd(9)} | ${r.model.padEnd(16)} | ${drv.padEnd(12)} | ` +
      `${r.contractStart || "—"} → ${r.contractEnd || "—"} | ` +
      `${r.monthlyCost === null ? (r.monthlyCostRejected ? "✗נדחה" : "—") : r.monthlyCost} | ${r.action}`
  );
}

// -- הרצה יבשה של הכתיבה, ואז בדיקת שיוך קנס על התוצאה --------------------
const built = buildImportWrite(plan, { orgId: "check", data: EMPTY });
console.log("\n— תוצאת הבנייה —");
console.log(`  ${JSON.stringify(built.summary)}`);

const after = {
  ...EMPTY,
  leaseCompanies: built.leaseCompanies,
  vehicles: built.vehicles,
  vehiclesPrivate: built.vehiclesPrivate,
  drivers: built.drivers,
  assignments: built.assignments,
};

const sample = built.vehicles[0];
const d1 = resolveDriverForFine(after, sample.id, "2026-06-01");
console.log(
  `\n  שיוך קנס לדוגמה (${sample.plate}, 1.6.2026): status=${d1.status} · ` +
    `נהג=${d1.driverId ? mask(after.drivers.find((x) => x.id === d1.driverId)?.fullName) : "—"} · ` +
    `fromDateInferred=${d1.fromDateInferred}`
);
const reviewAsg = built.assignments.find((a) => a.needsReview);
if (reviewAsg) {
  const d2 = resolveDriverForFine(after, reviewAsg.vehicleId, "2026-06-01");
  console.log(`  שיוך על החזקה שסומנה לבדיקה: status=${d2.status} · נהג=${d2.driverId || "—"} (חייב להיות null)`);
}

// -- הרצה חוזרת: לא אמורות להיווצר כפילויות --------------------------------
const plan2 = analyzeImport(rows, after, { fileName: "rerun", sheet: target });
console.log(
  `\n— הרצה חוזרת על אותו קובץ: ייווצרו ${plan2.counts.vehiclesToCreate} רכבים, ` +
    `${plan2.counts.driversToCreate} נהגים, ${plan2.counts.assignmentsToCreate} החזקות ` +
    `(קיימים: ${plan2.counts.vehiclesExisting})`
);
