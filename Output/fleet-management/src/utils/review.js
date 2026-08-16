// ============================================================================
// review.js — מסך 7: תיקון ההחזקות שסומנו לבדיקה. **הלוגיקה הטהורה בלבד.**
//
// למה המסך הזה קיים: 9 מתוך 36 ההחזקות שיובאו מהאקסל נוצרו משורות שבעמודת
// "שם נהג" היה יומן חילופים בטקסט חופשי ולא שם. הן נושאות `needsReview=true`,
// שחוסם שיוך קנס אוטומטי (D5) — כלומר הפיצ'ר המרכזי של המערכת מושבת על
// הרכבים האלה עד שאדמין יאמת מי נהג בפועל.
//
// שלושה כללים שמוטבעים כאן:
//   1. `importRaw` **נשאר** על ההחזקה גם אחרי הפתרון — עקבות ביקורת (D-Import
//      של עדי). הוא לעולם לא מועתק ל-`notes`, שהוא שדה תפעולי חופשי-לצפייה.
//   2. `fromDateInferred` יורד ל-false **רק** אם האדמין הזין תאריך אמיתי.
//      השאיר את התאריך המשוער (תחילת הסכם הליסינג) → הדגל נשאר true.
//   3. פיצול לשתי החזקות רציפות ובלי חפיפה: [origFrom .. newFrom-1] למחזיק
//      הקודם, [newFrom .. ] למחזיק הנוכחי. בלי זה, קנס מלפני החילופים יישלח
//      לנהג הלא-נכון — וזה בדיוק המידע שהאקסל איבד.
// ============================================================================

import { isDay, prevDay, cmpDay } from "./dates.js";
import { rangesOverlap } from "./assignments.js";
import { nameKey } from "./importExcel.js";

export const REVIEW_MODES = ["driver", "pool"];

// החזקה שהמסך הזה אחראי עליה: נוצרה בייבוא מטקסט חופשי (יש לה importRaw).
// ההחזקה ההיסטורית שנוצרת בפיצול מוחרגת (reviewSplitFrom) — היא תוצר של
// הפתרון, לא פריט נוסף לטיפול.
export function isReviewItem(a) {
  return Boolean(a && a.importRaw) && !a.reviewSplitFrom;
}

export function reviewAssignments(data) {
  return (data?.assignments || [])
    .filter(isReviewItem)
    .sort(
      (a, b) =>
        Number(Boolean(b.needsReview)) - Number(Boolean(a.needsReview)) ||
        (a.importSource?.row ?? 0) - (b.importSource?.row ?? 0) ||
        (a.id < b.id ? -1 : 1)
    );
}

export function pendingReviewCount(data) {
  return reviewAssignments(data).filter((a) => a.needsReview).length;
}

// המונה של המסך: "נפתרו 3 מתוך 9". ה-total יציב לאורך זמן כי importRaw נשמר.
export function reviewProgress(data) {
  const items = reviewAssignments(data);
  const pending = items.filter((a) => a.needsReview).length;
  return { total: items.length, pending, resolved: items.length - pending, done: items.length > 0 && pending === 0 };
}

// טיוטת פתרון ריקה, מאותחלת מההצעות שנגזרו מהטקסט — אבל **בלי להחיל אותן**:
// המשתמש רואה את ההצעה ככפתור "אישור", והשדות עצמם מתחילים ריקים.
export function emptyResolution(assignment) {
  return {
    mode: "driver",
    driverId: "",
    newDriverName: "",
    fromDate: assignment?.fromDate || "",
    // true = נשאר התאריך המשוער מהייבוא. ברגע שהאדמין משנה תאריך → false.
    fromDateInferred: Boolean(assignment?.fromDateInferred),
    split: false,
    previousDriverId: "",
    previousNewDriverName: "",
  };
}

// ============================================================================
// החלת הצעה — הלוגיקה שמאחורי כפתורי "מילוי". טהורה בכוונה: זה הרגע שבו
// טקסט חופשי הופך לערך בטופס, ורוצים שהוא יהיה מכוסה בבדיקות ולא חבוי
// בתוך onClick. אף אחת מהפונקציות כאן לא נקראת מעצמה — רק מלחיצה.
// ============================================================================
export const NEW_DRIVER = "__new__";

// ============================================================================
// M2 + M6 (שער עדי, 2026-08-13) — התאמת שם מול **כל** הנהגים, והצגת המיזוג.
//
// שתי בעיות נפרדות שנפתרות באותה פונקציה:
//   M2 — התאמה מול נהגים **פעילים בלבד** יוצרת כפילות לכל עובד שעזב: המסך
//        מציג "נהג חדש", והשכבה שמתחתיה (`reviewBuild`) בכל זאת מתאימה מול
//        כל הנהגים. פער בין מה שמוצג למה שנכתב.
//   M6 — מיזוג לפי `nameKey` הוא **החלטה** ("זה אותו אדם"), ובחברה עם שני
//        עובדים באותו שם הוא מייחס עבירת תעבורה לאדם הלא-נכון. הוא חייב
//        להיראות, לא לקרות בשקט.
//
// נהג שעבר אנונימיזציה **לעולם אינו מותאם** לשם מוקלד: שמו כבר טוקן, וכל
// "התאמה" אליו הייתה החייאה של זהות שנמחקה (D6).
// ============================================================================
export function matchDriversByName(drivers, text) {
  const key = nameKey(text);
  if (!key) return [];
  return (drivers || []).filter((d) => !d.anonymizedAt && nameKey(d.fullName) === key);
}

// מה יקרה אם נשמור את השם הזה — לפני שמישהו לוחץ. טהור, מוצג ב-UI.
export function nameMatchInfo(drivers, text) {
  const matches = matchDriversByName(drivers, text);
  const matched = matches[0] || null;
  return {
    matched,
    matchedId: matched?.id || null,
    count: matches.length,
    merges: Boolean(matched), // השם יתמזג לרשומה קיימת
    ambiguous: matches.length > 1, // יותר מרשומה אחת באותו שם — בחירה עיוורת
    inactive: Boolean(matched && matched.status !== "active"),
  };
}

// שם מוצע → או נהג קיים שמתאים לו, או "נהג חדש" עם השם בשדה.
export function driverFieldsForName(drivers, text, keys) {
  const existing = matchDriversByName(drivers, text)[0] || null;
  return existing
    ? { [keys.id]: existing.id, [keys.name]: "" }
    : { [keys.id]: NEW_DRIVER, [keys.name]: String(text || "").trim() };
}

export function applyNameSuggestion(draft, suggestionText, drivers) {
  return {
    ...draft,
    mode: "driver",
    ...driverFieldsForName(drivers, suggestionText, { id: "driverId", name: "newDriverName" }),
  };
}

// תאריך שנקרא מהטקסט הוא תאריך מסירה שאדם רשם — ולכן **אינו** משוער.
export function applyDateSuggestion(draft, iso) {
  return { ...draft, fromDate: iso, fromDateInferred: false };
}

export function applySplitSuggestion(draft, formerText, drivers) {
  return {
    ...draft,
    split: true,
    ...driverFieldsForName(drivers, formerText, {
      id: "previousDriverId",
      name: "previousNewDriverName",
    }),
  };
}

export function applyPoolSuggestion(draft) {
  return { ...draft, mode: "pool", split: false };
}

// שינוי ידני של התאריך: ברגע שהוא שונה מזה שהגיע מהייבוא, הוא כבר לא משוער.
export function changeFromDate(draft, assignment, value) {
  return {
    ...draft,
    fromDate: value,
    fromDateInferred: value === assignment?.fromDate ? draft.fromDateInferred : false,
  };
}

function driverRefErrors(driverId, newName, keys) {
  const id = String(driverId || "").trim();
  const name = String(newName || "").trim();
  if (id === "__new__" || (!id && name)) return name ? [] : [keys.noName];
  if (!id) return [keys.noDriver];
  return [];
}

// ============================================================================
// validateResolution — כל מה שחייב להיות נכון לפני שכותבים. מחזיר מפתחות
// שגיאה (מערך ריק = תקין). טהור: אין כאן יצירת ישויות ואין תופעות לוואי.
// ============================================================================
export function validateResolution(data, assignment, input) {
  const errors = [];
  if (!assignment) return ["reviewx.err.noAssignment"];
  const r = { ...emptyResolution(assignment), ...(input || {}) };

  if (!REVIEW_MODES.includes(r.mode)) errors.push("reviewx.err.noMode");
  if (!isDay(r.fromDate)) errors.push("reviewx.err.noFromDate");

  if (r.mode === "driver") {
    errors.push(
      ...driverRefErrors(r.driverId, r.newDriverName, {
        noDriver: "reviewx.err.noDriver",
        noName: "reviewx.err.noNewName",
      })
    );
  }

  // -- פיצול -----------------------------------------------------------------
  if (r.split) {
    if (r.mode !== "driver") errors.push("reviewx.err.splitNeedsDriver");
    errors.push(
      ...driverRefErrors(r.previousDriverId, r.previousNewDriverName, {
        noDriver: "reviewx.err.noPreviousDriver",
        noName: "reviewx.err.noPreviousName",
      })
    );
    // חייב להישאר טווח אמיתי למחזיק הקודם: origFrom ≤ newFrom-1.
    if (isDay(r.fromDate) && isDay(assignment.fromDate)) {
      if (cmpDay(assignment.fromDate, r.fromDate) >= 0) errors.push("reviewx.err.splitRange");
    } else if (!isDay(assignment.fromDate)) {
      errors.push("reviewx.err.splitNoOrigin");
    }
    // אותו נהג בשני הצדדים = לא פיצול, זו החזקה אחת.
    const sameExisting =
      r.driverId && r.driverId !== "__new__" && r.driverId === r.previousDriverId;
    if (sameExisting) errors.push("reviewx.err.splitSameDriver");
  }

  // -- חפיפה עם החזקות אחרות של אותו רכב ------------------------------------
  if (isDay(r.fromDate)) {
    const others = (data?.assignments || []).filter(
      (a) => a.vehicleId === assignment.vehicleId && a.id !== assignment.id
    );
    const main = { fromDate: r.fromDate, toDate: assignment.toDate ?? null };
    if (others.some((a) => rangesOverlap(a, main))) errors.push("reviewx.err.overlap");
    if (r.split && isDay(assignment.fromDate)) {
      const prev = { fromDate: assignment.fromDate, toDate: prevDay(r.fromDate) };
      if (others.some((a) => rangesOverlap(a, prev))) errors.push("reviewx.err.overlap");
    }
  }

  return [...new Set(errors)];
}

// טווחי הפיצול כפי שיוצגו למשתמש **לפני** האישור (תצוגה מקדימה, לא כתיבה).
export function splitPreview(assignment, fromDate) {
  if (!assignment || !isDay(fromDate) || !isDay(assignment.fromDate)) return null;
  if (cmpDay(assignment.fromDate, fromDate) >= 0) return null;
  return {
    previous: { fromDate: assignment.fromDate, toDate: prevDay(fromDate) },
    current: { fromDate, toDate: assignment.toDate ?? null },
  };
}
