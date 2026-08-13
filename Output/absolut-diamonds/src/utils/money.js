import { LOCALE_BY_LANG } from "../i18n/index.js";
import { VAT_RATE } from "../constants.js";

// ============================================================================
// money.js — A5. **כל** סכום במערכת הוא מספר שלם של אגורות.
//
// שלושה כללים, וכל אחד מהם מגיע ישירות מהסקירה:
//   1. אגורות שלמות. פלואט על מחירי תכשיטים מייצר סטיות, ולפי תקנה 4 לתקנות
//      תשנ"א-1991 בפער בין המחיר המוצג לנגבה — הצרכן משלם את הנמוך. מחיר
//      מוצג הוא כמעט-מחייב, ולכן אסור שיהיה תוצר של חישוב מרחף.
//   2. **לעולם לא מוצג מחיר לפני מע"מ, ולעולם לא "+ מע"מ".** אם האדמין הזין
//      מחיר ללא מע"מ — מנרמלים בשמירה ושומרים כולל, ומציגים רק אותו.
//   3. פונקציית פורמט **אחת**. כל מקום שמעצב מחיר בעצמו הוא מקום שיסטה.
// ============================================================================

export function toAgorot(shekels) {
  const n = Number(shekels);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function toShekels(agorot) {
  const n = Number(agorot);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

// נרמול קלט האדמין: אם הוזן ללא מע"מ — מוסיפים אותו ושומרים כולל.
export function normalizeToVatInclusive(agorot, vatIncludedInInput) {
  const n = Number(agorot);
  if (!Number.isFinite(n)) return null;
  if (vatIncludedInInput) return Math.round(n);
  return Math.round(n * (1 + VAT_RATE));
}

// הפורמט היחיד. מחזיר null כשאין מחיר — כדי ש-`null` לא יהפוך ל-"₪0".
export function formatAgorot(agorot, lang = "he") {
  const n = Number(agorot);
  if (!Number.isFinite(n)) return null;
  const shekels = n / 100;
  // אגורות עגולות → בלי שתי ספרות אחרי הנקודה. מחיר תכשיט הוא תמיד שקלים.
  const decimals = n % 100 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALE_BY_LANG[lang] || "he-IL", {
      style: "currency",
      currency: "ILS",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(shekels);
  } catch {
    return `₪${shekels.toLocaleString("he-IL", { maximumFractionDigits: decimals })}`;
  }
}

export function sumAgorot(...values) {
  let total = 0;
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) total += n;
  }
  return Math.round(total);
}
