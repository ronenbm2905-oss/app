// ============================================================================
// entities.js — מדריכי מחיקה ועריכה לישויות משותפות. פונקציות טהורות.
//
// ספק אחד משרת 82 בניינים; עובד אחד אחראי על 50. מחיקה של ישות כזו אינה
// פעולה מקומית — היא משאירה עשרות רשומות שמצביעות על מזהה שלא קיים.
//
// העיקרון זהה ל-`canDeleteEntry` ב-`pricing.js`: **הפונקציה מחזירה סיבה, לא
// זורקת.** המסך מציג את הסיבה ומשבית את הכפתור, במקום למחוק ואז לגלות.
// ============================================================================

/**
 * כמה חוזים משתמשים בספק, ובכמה בניינים.
 *
 * ⚠ מזהה ריק (`null`/`""`) מתאים ל**שום** רשומה. בלי השורה הזו, `vendorUsage(null)`
 * היה סופר את כל החוזים שאין להם ספק — רובם — ומדווח על שימוש שלא קיים.
 */
export function vendorUsage(vendorId, contracts) {
  if (!vendorId) return { contractCount: 0, buildingCount: 0 };
  const used = (contracts || []).filter((c) => c.vendorId === vendorId);
  return { contractCount: used.length, buildingCount: new Set(used.map((c) => c.buildingId)).size };
}

export function canDeleteVendor(vendorId, contracts) {
  const u = vendorUsage(vendorId, contracts);
  if (u.contractCount > 0) {
    return {
      ok: false,
      reason: `הספק משויך ל-${u.contractCount} חוזים ב-${u.buildingCount} בניינים. ` +
        `החלף אותו בבניינים האלה לפני המחיקה.`,
      usage: u,
    };
  }
  return { ok: true, reason: null, usage: u };
}

/** כמה בניינים משויכים לעובד. מזהה ריק — כמו בספק — אינו מתאים לאיש. */
export const employeeUsage = (employeeId, buildings) => ({
  buildingCount: employeeId
    ? (buildings || []).filter((b) => b.assignedEmployeeId === employeeId).length
    : 0,
});

export function canDeleteEmployee(employeeId, buildings) {
  const u = employeeUsage(employeeId, buildings);
  if (u.buildingCount > 0) {
    return {
      ok: false,
      reason: `העובד אחראי על ${u.buildingCount} בניינים. שייך אותם לעובד אחר לפני המחיקה, ` +
        `או סמן אותו כלא-פעיל במקום למחוק.`,
      usage: u,
    };
  }
  return { ok: true, reason: null, usage: u };
}

/**
 * מחיקת בניין. אין מניעה טכנית, אבל **יש מה לאבד** — לכן מוחזר מה ייעלם
 * איתו, כדי שהמסך יציג את זה לפני האישור ולא אחרי.
 */
export function buildingDeletionImpact(buildingId, data) {
  return {
    contracts: (data.contracts || []).filter((c) => c.buildingId === buildingId).length,
    feeAgreements: (data.feeAgreements || []).filter((f) => f.buildingId === buildingId).length,
    inspections: (data.inspections || []).filter((i) => i.buildingId === buildingId).length,
    notes: (data.notes || []).filter((n) => n.buildingId === buildingId).length,
  };
}

/** כל הרשומות התלויות בבניין — למחיקה מלאה בלי לייתם שורות. */
export const buildingDependentIds = (buildingId, data) => ({
  contracts: (data.contracts || []).filter((c) => c.buildingId === buildingId).map((x) => x.id),
  feeAgreements: (data.feeAgreements || []).filter((f) => f.buildingId === buildingId).map((x) => x.id),
  inspections: (data.inspections || []).filter((i) => i.buildingId === buildingId).map((x) => x.id),
  notes: (data.notes || []).filter((n) => n.buildingId === buildingId).map((x) => x.id),
});

/**
 * כתובת חייבת להיות ייחודית ולא ריקה — היא עדיין מה שבני אדם מזהים לפיו,
 * גם אחרי שהמפתח הפך ל-`id`. שתי שורות עם אותה כתובת הן בדיוק הבלבול
 * שהמערכת נבנתה כדי למנוע.
 */
export function validateAddress(address, buildingId, buildings, addressKey) {
  const trimmed = String(address || "").trim();
  if (!trimmed) return { ok: false, reason: "כתובת ריקה" };
  const key = addressKey(trimmed);
  const clash = (buildings || []).find((b) => b.id !== buildingId && addressKey(b.address) === key);
  if (clash) return { ok: false, reason: `כבר קיים בניין בכתובת ״${clash.address}״` };
  return { ok: true, reason: null };
}
