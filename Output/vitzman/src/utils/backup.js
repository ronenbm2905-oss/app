// ============================================================================
// backup.js — גיבוי, שחזור וייצוא. פונקציות טהורות + הורדה בדפדפן.
//
// ----------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ----------------------------------------------------------------------------
// כל הנתונים יושבים ב-localStorage של דפדפן אחד. ניקוי היסטוריית גלישה, מעבר
// למחשב אחר, או חלון פרטי — וחודשים של הזנת ביקורות ושינויי מחיר נעלמים **בלי
// אזהרה ובלי דרך חזרה**. זו לא תקלה תיאורטית: כבר קרה בפרויקט אחר בצוות
// שה-localStorage התאפס באמצע עבודה.
//
// שתי הכרעות:
//
// 1. **הגיבוי הוא המצב המלא, לא ייצוא מסונן.** קובץ שאפשר לטעון חזרה ולקבל
//    בדיוק את מה שהיה. ייצוא ל-CSV הוא דבר אחר — הוא לקריאה ולדוחות, ואי אפשר
//    לשחזר ממנו. שניהם קיימים, ולא מתחזים זה לזה.
//
// 2. **השחזור מאמת לפני שהוא דורס.** טעינת קובץ שאינו גיבוי תקין הייתה מוחקת
//    את הכל. `validateBackup` בודקת מבנה ומחזירה סיבה מדויקת.
// ============================================================================

import { SCHEMA_VERSION, ENTITY_COLLECTIONS, EXPENSE_CATEGORIES, CATEGORY_BY_ID } from "../constants.js";
import { round2 } from "./money.js";
import { todayISO, fmtDate } from "./dates.js";
import { buildingProfit, indexContracts, indexFees, buildingCost } from "./profitability.js";
import { indexInspections, buildingInspections, INSPECTION_STATUS_LABEL } from "./inspections.js";
import { INSPECTION_TYPES, INSPECTION_TYPE_LABEL, BUILDING_STATUS_LABEL } from "../constants.js";

export const BACKUP_KIND = "vitzman-backup";

/** עוטף את המצב בחותמת שמאפשרת לזהות אותו בוודאות בשחזור. */
export function makeBackup(data) {
  return {
    kind: BACKUP_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(ENTITY_COLLECTIONS.map((c) => [c, (data[c] || []).length])),
    data,
  };
}

/**
 * אימות קובץ גיבוי לפני שחזור.
 * @returns {{ ok: boolean, reason: string|null, data: object|null, counts: object|null }}
 */
export function validateBackup(raw) {
  const bad = (reason) => ({ ok: false, reason, data: null, counts: null });
  if (!raw || typeof raw !== "object") return bad("הקובץ אינו JSON תקין");

  // גם גיבוי מלא וגם פלט הייבוא (`seed/vitzman.json`) מתקבלים — שניהם מצב שלם.
  const data = raw.kind === BACKUP_KIND ? raw.data : raw;
  if (!data || typeof data !== "object") return bad("הקובץ לא מכיל נתונים");
  if (!Array.isArray(data.buildings)) return bad("הקובץ לא מכיל רשימת בניינים — זה כנראה לא גיבוי");
  if (!data.buildings.length) return bad("הגיבוי ריק מבניינים");

  const counts = Object.fromEntries(ENTITY_COLLECTIONS.map((c) => [c, (data[c] || []).length]));
  return { ok: true, reason: null, data, counts };
}

/** שם קובץ עם תאריך, כדי ששני גיבויים לא ידרסו זה את זה בתיקיית ההורדות. */
export const backupFilename = (asOf = todayISO()) => `vitzman-backup-${asOf}.json`;

// ============================================================================
// ייצוא לקריאה — CSV
// ============================================================================

/**
 * ⚠ **BOM בראש הקובץ.** בלעדיו אקסל בעברית קורא UTF-8 כ-Windows-1255 ומציג
 * ג׳יבריש. הלקח נצרב ב-project-budget; אותה בדיקה נועלת אותו גם כאן.
 */
export const BOM = "﻿";

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => BOM + rows.map((r) => r.map(csvCell).join(",")).join("\n");

/** דוח רווחיות: שורה לכל בניין, עמודה לכל קטגוריה. */
export function profitabilityCsv(data, asOf = todayISO()) {
  const ci = indexContracts(data.contracts);
  const fi = indexFees(data.feeAgreements);
  const active = data.buildings.filter((b) => b.status === "active");
  const empById = new Map(data.employees.map((e) => [e.id, e.name]));

  const header = [
    "כתובת", "סטטוס", "עובד אחראי", "דמי ניהול", "סה\"כ הוצאות", "רווח",
    "margin %", "markup %", ...EXPENSE_CATEGORIES.map((c) => c.name),
  ];
  const rows = active.map((b) => {
    const p = buildingProfit(b, ci, asOf, fi);
    const byCat = new Map(p.detail.byCategory.map((r) => [r.categoryId, r.amount]));
    return [
      b.address,
      BUILDING_STATUS_LABEL[b.status],
      empById.get(b.assignedEmployeeId) || "",
      p.income, p.cost, p.profit,
      p.margin == null ? "" : round2(p.margin * 100),
      p.markup == null ? "" : round2(p.markup * 100),
      ...EXPENSE_CATEGORIES.map((c) => (byCat.has(c.id) ? byCat.get(c.id) ?? "" : "")),
    ];
  });
  return toCsv([header, ...rows]);
}

/** דוח ביקורות: שורה לכל בניין×סוג, עם הסטטוס והמועד הבא. */
export function inspectionsCsv(data, asOf = todayISO()) {
  const idx = indexInspections(data.inspections);
  const active = data.buildings.filter((b) => b.status === "active");
  const empById = new Map(data.employees.map((e) => [e.id, e.name]));
  const header = ["כתובת", "עובד אחראי", "סוג ביקורת", "מצב", "בוצעה", "מועד הבא", "תדירות (חודשים)"];
  const rows = [];
  for (const b of active) {
    for (const row of buildingInspections(b, idx, asOf)) {
      rows.push([
        b.address, empById.get(b.assignedEmployeeId) || "",
        INSPECTION_TYPE_LABEL[row.type], INSPECTION_STATUS_LABEL[row.status],
        row.lastDate ? fmtDate(row.lastDate) : "",
        row.nextDue ? fmtDate(row.nextDue) : "",
        row.intervalMonths,
      ]);
    }
  }
  return toCsv([header, ...rows]);
}

/** היסטוריית מחירים: כל שורת מחיר של כל חוזה + דמי הניהול. */
export function priceHistoryCsv(data) {
  const addr = new Map(data.buildings.map((b) => [b.id, b.address]));
  const vend = new Map(data.vendors.map((v) => [v.id, v.name]));
  const header = ["כתובת", "סוג", "קטגוריה", "ספק", "סכום", "בתוקף מ-"];
  const rows = [];
  for (const c of data.contracts) {
    rows.push([
      addr.get(c.buildingId) || "", "הוצאה",
      CATEGORY_BY_ID[c.categoryId]?.name || c.categoryId,
      vend.get(c.vendorId) || "",
      c.amount ?? "", c.effectiveFrom ? fmtDate(c.effectiveFrom) : "מאז ומעולם",
    ]);
  }
  for (const f of data.feeAgreements || []) {
    rows.push([
      addr.get(f.buildingId) || "", "הכנסה", "דמי ניהול", "",
      f.amount, f.effectiveFrom ? fmtDate(f.effectiveFrom) : "מאז ומעולם",
    ]);
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "he"));
  return toCsv([header, ...rows]);
}

// ============================================================================
// הורדה בדפדפן — הצד היחיד שאינו טהור
// ============================================================================
export function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // שחרור מיידי דולף בחלק מהדפדפנים לפני שההורדה התחילה; טיק אחד מספיק.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
