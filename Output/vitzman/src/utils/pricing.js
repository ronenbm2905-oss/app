// ============================================================================
// pricing.js — שינוי מחיר. פונקציות טהורות בלבד.
//
// ----------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ----------------------------------------------------------------------------
// המודל תמך בהיסטוריית מחירים מהיום הראשון — `activeAsOf` יודע לבחור את המחיר
// התקף לתאריך — אבל **נתיב הכתיבה שבר אותה**: העריכה עשתה `update` על אותה
// רשומה ודרסה את הקודמת. התוצאה: מתוך 2,715 חוזים, בדיוק אחד החזיק היסטוריה.
// המנוע ידע לקרוא היסטוריה; שום דבר לא כתב אותה.
//
// ----------------------------------------------------------------------------
// שתי הכרעות
// ----------------------------------------------------------------------------
// 1. **״תיקון״ ו״מחיר חדש״ הם שתי פעולות שונות.** טעות הקלדה אינה שינוי מחיר.
//    אילו כל עריכה הייתה יוצרת שורת היסטוריה, ההיסטוריה הייתה מתמלאת בתיקוני
//    הקלדה ומאבדת את הערך שלה; אילו אף עריכה לא הייתה יוצרת שורה — היינו
//    חוזרים לדריסה. לכן `mode` הוא בחירה מפורשת בכל עריכה.
//
// 2. **מחזירה תוכנית, לא מבצעת.** בתבנית `planBulkRecord` ב-`inspections.js`:
//    הקורא מקבל `updates`/`creates` ומציג ״זה מה שיקרה״ לפני האישור. שינוי
//    מחיר רטרואקטיבי משנה מספרים שכבר דווחו — הוא חייב להיות ניתן לבדיקה מראש.
// ============================================================================

import { round2, fmtILSExact } from "./money.js";
import { isISODate, todayISO, fmtDate } from "./dates.js";

export const PRICE_MODES = ["correct", "newPrice"];
export const PRICE_MODE_LABEL = {
  correct: "תיקון — הסכום הנוכחי היה שגוי",
  newPrice: "מחיר חדש מתאריך — הסכום הקודם נשמר",
};

/**
 * הרשומה התקפה לתאריך: בעלת ה-`effectiveFrom` הגדול ביותר שכבר עבר.
 * `null` נחשב ״מאז ומעולם״ ולכן מפסיד לכל רשומה מתוארכת שכבר בתוקף.
 *
 * גנרי בכוונה — משרת גם `serviceContract` וגם `feeAgreement`, שהם אותה צורה
 * (`amount` + `effectiveFrom`). שני מנועי בחירה נפרדים היו נפרדים גם בהתנהגות.
 */
export function activeAsOf(entries, asOf = todayISO()) {
  let best = null;
  for (const e of entries || []) {
    if (e.effectiveFrom && e.effectiveFrom > asOf) continue;
    if (!best) { best = e; continue; }
    if ((e.effectiveFrom || "") > (best.effectiveFrom || "")) best = e;
  }
  return best;
}

/** כל הרשומות, החדשה בראש. `null` (מאז ומעולם) יורד לסוף. */
export const sortByEffective = (entries) =>
  [...(entries || [])].sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));

/**
 * תכנון שינוי מחיר — **בלי לגעת במצב**.
 *
 * @param {object[]} entries      כל הרשומות של אותו חוזה/בניין (ההיסטוריה כולה)
 * @param {string}   currentId    הרשומה שנערכת (התקפה היום)
 * @param {number|null} newAmount `null` = "לא אנחנו משלמים" (הוועד ישירות)
 * @param {"correct"|"newPrice"} mode
 * @param {string}   effectiveFrom  נדרש רק ב-`newPrice`
 * @param {object}   template     שדות שיועתקו לרשומה חדשה (buildingId, categoryId, …)
 *
 * @returns {{ error, warning, preview, updates, creates }}
 */
export function planPriceChange({
  entries = [],
  currentId = null,
  newAmount,
  mode = "correct",
  effectiveFrom = null,
  template = {},
  asOf = todayISO(),
}) {
  const fail = (error) => ({ error, warning: null, preview: null, updates: [], creates: [] });

  if (!PRICE_MODES.includes(mode)) return fail("מצב עריכה לא מוכר");

  const amount = newAmount === null || newAmount === "" ? null : round2(Number(newAmount));
  if (amount !== null && !Number.isFinite(amount)) return fail("הסכום אינו מספר");
  if (amount !== null && amount < 0) return fail("סכום שלילי אינו אפשרי");

  const current = entries.find((e) => e.id === currentId) || activeAsOf(entries, asOf);

  // --- תיקון: דורס במקום, בלי שורת היסטוריה ---
  if (mode === "correct") {
    if (!current) return fail("אין רשומה לתקן");
    if (current.amount === amount) return fail("הסכום זהה לנוכחי — אין מה לתקן");
    return {
      error: null,
      warning: null,
      preview: `הסכום ${fmtAmount(current.amount)} יוחלף ב-${fmtAmount(amount)}. ` +
        `זהו תיקון — לא נשמרת שורת היסטוריה.`,
      updates: [{ id: current.id, patch: { amount } }],
      creates: [],
    };
  }

  // --- מחיר חדש מתאריך ---
  if (!isISODate(effectiveFrom)) return fail("צריך תאריך תחולה תקין");

  // סכום זהה למחיר שיהיה תקף באותו תאריך → שורה חסרת משמעות.
  const wouldReplace = activeAsOf(entries, effectiveFrom);
  if (wouldReplace && wouldReplace.amount === amount && wouldReplace.effectiveFrom !== effectiveFrom) {
    return fail("הסכום זהה למחיר שכבר תקף בתאריך הזה — אין מה לשנות");
  }

  // תאריך שכבר קיים בהיסטוריה → מעדכנים את אותה שורה במקום ליצור כפילות.
  const sameDate = entries.find((e) => e.effectiveFrom === effectiveFrom);
  if (sameDate) {
    if (sameDate.amount === amount) return fail("כבר קיים מחיר זהה מאותו תאריך");
    return {
      error: null,
      warning: `כבר קיימת שורת מחיר מ-${fmtDate(effectiveFrom)} (${fmtAmount(sameDate.amount)}) — היא תעודכן במקום שתיווצר שורה נוספת.`,
      preview: `המחיר מ-${fmtDate(effectiveFrom)} ישתנה ל-${fmtAmount(amount)}.`,
      updates: [{ id: sameDate.id, patch: { amount } }],
      creates: [],
    };
  }

  const isFuture = effectiveFrom > asOf;

  // **רטרואקטיבי = כל תאריך שקודם להיום**, ולא רק כזה שקודם לרשומה הפעילה.
  // מחיר מ-01.06 משנה את יוני, יולי ואוגוסט — תקופות שכבר דווחו — גם כשהמחיר
  // שהוא מחליף הוא "מאז ומעולם" ואין לו תאריך להשוות אליו.
  const isRetro = effectiveFrom < asOf;

  // מלכודת נפרדת: התאריך בעבר, אבל קיימת כבר רשומה מאוחרת יותר שתקפה היום —
  // ולכן השורה החדשה **לא תשנה את המחיר הנוכחי**. בלי האזהרה הזו נראה כאילו
  // העריכה לא עשתה כלום.
  const afterInsert = activeAsOf([...entries, { id: "__new", amount, effectiveFrom }], asOf);
  const wontApplyNow = !isFuture && afterInsert?.id !== "__new";

  const warning = isFuture
    ? `התאריך עתידי — הרווח לא ישתנה עד ${fmtDate(effectiveFrom)}.`
    : wontApplyNow
      ? `קיימת כבר רשומה מ-${fmtDate(afterInsert.effectiveFrom)} — השורה תיכנס להיסטוריה אך לא תשנה את המחיר התקף היום.`
      : isRetro
        ? `התאריך בעבר — השינוי ישפיע על תקופה שכבר דווחה (מ-${fmtDate(effectiveFrom)} ואילך).`
        : null;

  return {
    error: null,
    warning,
    preview:
      (current ? `${fmtAmount(current.amount)} יישמר כהיסטוריה. ` : "") +
      `מ-${fmtDate(effectiveFrom)} יחול ${fmtAmount(amount)}.`,
    updates: [],
    creates: [{ ...template, amount, effectiveFrom }],
  };
}

const fmtAmount = (n) => (n === null ? "״ללא סכום״" : fmtILSExact(n));

/**
 * האם מותר למחוק שורת היסטוריה.
 * חוזה חייב להישאר עם מחיר כלשהו — מחיקת האחרונה הייתה משאירה קטגוריה
 * בלי סכום ובלי דרך להחזיר אותו.
 */
export function canDeleteEntry(entries, id) {
  if (!entries?.some((e) => e.id === id)) return { ok: false, reason: "הרשומה לא נמצאה" };
  if (entries.length <= 1) return { ok: false, reason: "זו שורת המחיר האחרונה — לא ניתן למחוק אותה" };
  return { ok: true, reason: null };
}
