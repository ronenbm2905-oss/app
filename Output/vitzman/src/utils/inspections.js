// ============================================================================
// inspections.js — מנוע הביקורות התקופתיות. פונקציות טהורות בלבד.
//
// ----------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ----------------------------------------------------------------------------
// בגיליון המקור היו ארבע עמודות תאריך — גילוי אש, כיבוי אש, ניקוי מאגרים,
// טיפול גנרטור — ולא מולא בהן **אף תא, באף אחד מ-131 הבניינים**. מישהו הבין
// שצריך לעקוב, בנה את העמודות, ושם נעצר.
//
// ולכן ההכרעה המרכזית כאן היא לא בחישוב אלא בעיצוב: המצב ההתחלתי הוא 524 תאים
// ריקים. מסך שרק צובע אותם באדום לא ישנה כלום — הוא רק יהפוך את החוסר לרעש
// שמתרגלים אליו. `pendingEntry` ו-`bulkRecord` קיימים כדי שהמסך יהיה **מסך
// הזנה**, ולא מסך דיווח.
//
// ----------------------------------------------------------------------------
// שלוש הכרעות
// ----------------------------------------------------------------------------
// 1. **״מעולם לא תועד״ אינו ״פג תוקף״.** שני מצבים שונים לחלוטין: אחד אומר
//    ״הבדיקה לא בוצעה או שלא רשמנו״, השני אומר ״בוצעה, ועבר זמנה״. ערבובם
//    מייצר רשימה של 524 פריטים אדומים שאי אפשר לעבוד איתה.
//
// 2. **התדירויות הן ברירות מחדל הניתנות לעקיפה, ומסומנות ככאלה.** הן נגזרות
//    מהנוהג המקובל (שנתי לגילוי/כיבוי אש ולמאגרים, חצי-שנתי לגנרטור) —
//    **לא מקביעה משפטית**. `intervalMonths` על הרשומה גובר. אימות מול הדין
//    ומול דרישות המבטח הוא שער עדי, לא הקוד הזה.
//
// 3. **חלון ההתראה נגזר מהתדירות ולא קבוע.** 60 יום לפני מועד שנתי הם התראה
//    סבירה; לפני מועד חצי-שנתי הם שליש מהמחזור. לכן `min(60, interval/4)`.
// ============================================================================

import { addMonths, daysBetween, todayISO, isISODate } from "./dates.js";
import { INSPECTION_TYPES, INSPECTION_INTERVAL_MONTHS } from "../constants.js";

export const INSPECTION_STATUS = ["never", "overdue", "dueSoon", "ok"];
export const INSPECTION_STATUS_LABEL = {
  never: "מעולם לא תועד",
  overdue: "פג תוקף",
  dueSoon: "מתקרב",
  ok: "בתוקף",
};
/** סדר טיפול: פג תוקף קודם למעולם-לא-תועד, כי שם ידוע שהייתה בדיקה ופגה. */
export const STATUS_ORDER = { overdue: 0, never: 1, dueSoon: 2, ok: 3 };

export const intervalFor = (type, record) =>
  Number(record?.intervalMonths) > 0
    ? Number(record.intervalMonths)
    : INSPECTION_INTERVAL_MONTHS[type] ?? 12;

/** חלון ההתראה בימים — נגזר מהתדירות, לא קבוע. */
export const warnWindowDays = (intervalMonths) => Math.min(60, Math.round((intervalMonths * 30) / 4));

/**
 * מצב ביקורת אחת.
 *
 * @returns {{ type, status, lastDate, nextDue, daysUntil, intervalMonths, record }}
 */
export function inspectionStatus(type, record, asOf = todayISO()) {
  const intervalMonths = intervalFor(type, record);
  const lastDate = isISODate(record?.lastDate) ? record.lastDate : null;

  if (!lastDate) {
    return { type, status: "never", lastDate: null, nextDue: null, daysUntil: null, intervalMonths, record: record || null };
  }
  // `nextDueDate` ידני גובר על החישוב — יש ספקים שקובעים מועד משלהם.
  const nextDue = isISODate(record?.nextDueDate) ? record.nextDueDate : addMonths(lastDate, intervalMonths);
  const daysUntil = daysBetween(asOf, nextDue);
  const status = daysUntil < 0 ? "overdue" : daysUntil <= warnWindowDays(intervalMonths) ? "dueSoon" : "ok";
  return { type, status, lastDate, nextDue, daysUntil, intervalMonths, record };
}

/** מפתח → רשומה, לגישה בלי סריקה חוזרת של כל המערך. */
export function indexInspections(inspections) {
  const idx = new Map();
  for (const i of inspections) {
    if (!i.buildingId || !i.type) continue;
    idx.set(`${i.buildingId}::${i.type}`, i);
  }
  return idx;
}

/** ארבע השורות של בניין אחד, תמיד — גם כשאין לו אף רשומה. */
export function buildingInspections(building, inspectionIndex, asOf = todayISO()) {
  return INSPECTION_TYPES.map((type) =>
    inspectionStatus(type, inspectionIndex.get(`${building.id}::${type}`), asOf)
  );
}

/** המצב החמור ביותר מבין ארבע הביקורות של בניין — לתצוגה ברמת שורה. */
export function worstStatus(rows) {
  return rows.reduce((worst, r) => (STATUS_ORDER[r.status] < STATUS_ORDER[worst] ? r.status : worst), "ok");
}

/**
 * סיכום התיק כולו.
 *
 * `never` ו-`overdue` נספרים בנפרד **בכוונה** — ראה הכרעה 1 למעלה.
 * `coverage` הוא המספר שאומר אם פרוסה 2 באמת עובדת: כמה מהתאים תועדו בכלל.
 */
export function inspectionSummary(buildings, inspections, asOf = todayISO()) {
  const idx = indexInspections(inspections);
  const counts = { never: 0, overdue: 0, dueSoon: 0, ok: 0 };
  const byType = Object.fromEntries(
    INSPECTION_TYPES.map((t) => [t, { never: 0, overdue: 0, dueSoon: 0, ok: 0 }])
  );
  const items = [];

  for (const b of buildings) {
    for (const row of buildingInspections(b, idx, asOf)) {
      counts[row.status] += 1;
      byType[row.type][row.status] += 1;
      items.push({ ...row, buildingId: b.id, address: b.address, assignedEmployeeId: b.assignedEmployeeId });
    }
  }

  const total = buildings.length * INSPECTION_TYPES.length;
  const recorded = total - counts.never;
  return {
    total,
    recorded,
    coverage: total ? recorded / total : null,
    counts,
    byType,
    items,
    /** סדר הטיפול: פג תוקף (הישן ביותר קודם) → מעולם → מתקרב → תקין. */
    queue: [...items].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.daysUntil ?? 0) - (b.daysUntil ?? 0) ||
        a.address.localeCompare(b.address, "he")
    ),
  };
}

/**
 * מה יוזן בהזנה מרוכזת — **בלי לגעת במצב**.
 *
 * מחזיר `updates` (רשומות קיימות שיעודכנו) ו-`creates` (רשומות חדשות), כדי
 * שהמסך יוכל להראות ״זה מה שיקרה״ לפני האישור. פעולה על עשרות בניינים בלחיצה
 * אחת חייבת להיות ניתנת לבדיקה מראש.
 */
export function planBulkRecord({ buildingIds, type, date, inspections, vendorId = null }) {
  if (!isISODate(date)) return { error: "תאריך לא תקין", updates: [], creates: [] };
  if (!INSPECTION_TYPES.includes(type)) return { error: "סוג ביקורת לא מוכר", updates: [], creates: [] };

  const idx = indexInspections(inspections);
  const updates = [];
  const creates = [];
  for (const buildingId of buildingIds) {
    const existing = idx.get(`${buildingId}::${type}`);
    const patch = { lastDate: date, nextDueDate: null, ...(vendorId ? { vendorId } : {}) };
    if (existing) updates.push({ id: existing.id, patch, previous: existing.lastDate || null });
    else creates.push({ buildingId, type, ...patch, vendorId });
  }
  return { error: null, updates, creates };
}
