// ============================================================================
// import-vitzman.mjs — עטיפת CLI סביב `src/utils/importWorkbook.js`.
//
// הרצה:  npm run import:vitzman
// פלט:   seed/vitzman.json  +  seed/discrepancies.md   (שניהם gitignored)
//
// כל הלוגיקה יושבת ב-`importWorkbook`, שהוא טהור ורץ גם בדפדפן — כדי שגרירת
// אקסל לתוך האפליקציה וההרצה מהטרמינל יעברו **באותו קוד בדיוק**. כאן רק
// קריאת הקובץ, הדפסת המבחנים והכתיבה לדיסק.
// ============================================================================

import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { importWorkbook } from "../src/utils/importWorkbook.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC = process.env.VITZMAN_SRC || resolve(ROOT, "seed/vitzman-buildings-2025.xlsx");
const OUT_JSON = resolve(ROOT, "seed/vitzman.json");
const OUT_REPORT = resolve(ROOT, "seed/discrepancies.md");

if (!existsSync(SRC)) {
  console.error(`✗ לא נמצא קובץ מקור: ${SRC}\n  הגדר VITZMAN_SRC או הנח את הקובץ ב-seed/.`);
  process.exit(1);
}

// קוראים את הבתים ומשתמשים ב-`XLSX.read` — **אותה קריאה בדיוק שהדפדפן עושה**.
// (`XLSX.readFile` אינו קיים ב-build של SheetJS ל-ESM, אבל גם אילו היה — מסלול
// אחד לשני הצדדים עדיף על שניים שיכולים להיפרד.)
const wb = XLSX.read(readFileSync(SRC), { cellFormula: true, bookFiles: true });
const { ok, checks, failed, payload, report } = importWorkbook(wb, basename(SRC));

const nf = (n) => Number(n).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v) => (typeof v === "number" ? v.toLocaleString("he-IL") : v);

console.log("\n=== מבחני התאמה ===");
for (const c of checks) {
  console.log(`  ${c.ok ? "✓" : "✗"} ${c.name}: ${fmt(c.actual)}` + (c.ok ? "" : `  (צפוי: ${fmt(c.expected)})`));
}

if (!ok) {
  console.error(`\n✗ ${failed.length} מבחני התאמה נכשלו — שום קובץ לא נכתב.`);
  process.exit(1);
}

mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), "utf8");
writeFileSync(OUT_REPORT, report, "utf8");

const active = payload.buildings.filter((b) => b.status === "active");
const income = payload.meta.sheetTotals.income;
const expenses = payload.meta.sheetTotals.expenses;
const profit = payload.meta.sheetTotals.profit;

console.log(`\n=== נכתב ===`);
console.log(`  ${OUT_JSON}`);
console.log(`    ${payload.buildings.length} בניינים (${active.length} פעילים) · ${payload.contracts.length} חוזים · ` +
            `${payload.vendors.length} ספקים · ${payload.employees.length} עובדים · ${payload.notes.length} הערות · ` +
            `${payload.feeAgreements.length} הסכמי ניהול`);
console.log(`  ${OUT_REPORT}`);
console.log(`\n  הוצאות ${nf(expenses)} ₪ · הכנסות ${nf(income)} ₪ · רווח ${nf(profit)} ₪`);
console.log(`  margin ${((profit / income) * 100).toFixed(2)}%  ·  markup ${((profit / expenses) * 100).toFixed(2)}%\n`);
