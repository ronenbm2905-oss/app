// ============================================================================
// vat.js — מעבר מברוטו לנטו. פונקציות טהורות.
//
// רונן אישר (4.9): **דמי הניהול כוללים מע"מ.** ההסכם אומר את זה במפורש
// ("הסכום כולל מע"מ כדין"), וכך גם הסכומים בגיליון.
//
// ⚠ **המשמעות: הרווח שהמערכת הציגה עד היום הוא ברוטו.** המע"מ שנגבה מהוועד
// אינו הכנסה — הוא נגבה עבור המדינה ומועבר אליה. הרווח שנשאר בחברה קטן
// בכ-18% מהמספר שהוצג.
//
// ---
//
// ⚠ **הגזירה עובדת גם לספק רגיל וגם לעוסק פטור — וזה לא מובן מאליו:**
//
//   · **ספק רגיל:** משלמים ברוטו G, מקזזים את המע"מ. העלות האמיתית היא
//     `G / (1+rate)`.
//   · **עוסק פטור:** משלמים P בלי מע"מ, ו**אין מה לקזז**. אבל הגיליון רשם
//     `P × (1+rate)` — מע"מ רעיוני שנוסף כדי להשוות אותו לספק רגיל. ולכן
//     `recorded / (1+rate) = P` — שוב העלות האמיתית.
//
// **בשני המקרים: נטו = רשום ÷ (1+שיעור).** לכן הגזירה אחידה, ואין צורך
// לפצל את החישוב לפי סוג הספק. זו אינה הפשטה נוחה אלא זהות אמיתית, והיא
// נעולה בבדיקה.
//
// ---
//
// ⚠ **הברוטו נשאר בסיס המערכת ולא מוחלף.** הוא מה שמתאזן מול הגיליון
// (1,088,983 / 940,050.08 / 148,932.92), מול ההסכמים ומול מה שרונן מכיר.
// הנטו הוא **עדשה נוספת**, לא החלפה — מספר שמשנים בו את המשמעות בלי לומר
// זאת הוא מספר שאי אפשר להצליב מול שום דבר.
// ============================================================================

import { round2 } from "./money.js";
import { DEFAULT_VAT_RATE } from "../constants.js";

/** ברוטו → נטו. שיעור 0 מחזיר את הסכום כמות שהוא. */
export function netOfGross(amountGross, rate = DEFAULT_VAT_RATE) {
  const g = Number(amountGross) || 0;
  const r = Number(rate) || 0;
  return round2(g / (1 + r));
}

/** רכיב המע"מ שבתוך סכום ברוטו. */
export function vatPart(amountGross, rate = DEFAULT_VAT_RATE) {
  const g = Number(amountGross) || 0;
  return round2(g - netOfGross(g, rate));
}

/**
 * גזירת התמונה הנטו מתוך סיכום ברוטו.
 *
 * ⚠ **שולי הרווח באחוזים אינם משתנים.** `(I−C)/I` זהה ל-`(I/k − C/k)/(I/k)`.
 * מה שכן משתנה זה **הרווח בשקלים** — וזה המספר שרונן מתכנן לפיו. אחוז זהה
 * ורווח שונה בכ-18% הוא בדיוק המקום שבו קל לטעות.
 *
 * @param {{income:number, cost:number, profit:number}} totals סיכום ברוטו
 */
export function netTotals(totals, rate = DEFAULT_VAT_RATE) {
  const income = netOfGross(totals?.income || 0, rate);
  const cost = netOfGross(totals?.cost || 0, rate);
  const profit = round2(income - cost);
  return {
    income,
    cost,
    profit,
    vatOnIncome: round2((totals?.income || 0) - income),
    vatOnCost: round2((totals?.cost || 0) - cost),
    /** המע"מ נטו שמועבר למדינה — ההפרש בין מה שנגבה למה שקוזז. */
    vatToRemit: round2(((totals?.income || 0) - income) - ((totals?.cost || 0) - cost)),
    margin: income ? profit / income : null,
    markup: cost ? profit / cost : null,
  };
}

export const VAT_MODES = ["gross", "net"];
export const VAT_MODE_LABEL = {
  gross: "כולל מע״מ",
  net: "נטו (בלי מע״מ)",
};
