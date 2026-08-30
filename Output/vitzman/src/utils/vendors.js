// ============================================================================
// vendors.js — ניתוח ספקים. פונקציות טהורות בלבד.
//
// ----------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ----------------------------------------------------------------------------
// בגיליון הספק היה **שם בתא** — טקסט בעמודה, ליד כל בניין בנפרד. אי אפשר היה
// לשאול את השאלה שמזיזה כסף: *״כמה אנחנו משלמים לקבלן הניקיון הזה בסך הכל,
// על פני כמה בניינים?״* התשובה הזו היא נייר העמדה של כל משא ומתן.
//
// ----------------------------------------------------------------------------
// שתי הכרעות
// ----------------------------------------------------------------------------
// 1. **הכל נגזר מהנתונים הקיימים. לא נוספו שדות שאין להם מקור.**
//    היה מתבקש להוסיף ״תאריך חידוש חוזה״ ולבנות עליו התראות — אבל לגיליון אין
//    מושג כזה, וכל 85 הספקים היו מקבלים שדה ריק. זו בדיוק התקלה של ארבע עמודות
//    הביקורת: עמודה שנבנתה ואיש לא מילא. במקום זה מדדנו את מה שכן קיים.
//
// 2. **״ותק המחיר״ במקום ״מועד חידוש״.** ל-27 חוזים יש `effectiveFrom` שנגזר
//    מהערות הגיליון (״הסכם עלה מ-4650 ל-5500 החל מ-1.7.2022״). חוזה שמחירו לא
//    זז מאז 2021 הוא מועמד למשא ומתן — וזו עובדה נגזרת, לא שדה שצריך למלא.
//    חוזה בלי `effectiveFrom` הוא **״לא ידוע״ ולא ״ותיק״**: הרוב המכריע של
//    השורות בגיליון פשוט לא נשאו תאריך, וספירתם כוותיקים הייתה המצאה.
// ============================================================================

import { round2, sum } from "./money.js";
import { daysBetween, todayISO, isISODate } from "./dates.js";
import { CATEGORY_BY_ID } from "../constants.js";
import { activeContract, imputedVatIncluded } from "./profitability.js";

/** מעל כמה שנים בלי שינוי מחיר נחשב חוזה למועמד למשא ומתן. */
export const STALE_PRICE_YEARS = 3;

/**
 * צבירה פר ספק על פני כל הבניינים.
 *
 * נספרים רק חוזים **תקפים היום** של בניינים **פעילים** — אחרת מופיע ספק
 * שהופסק לפני שנתיים עם הוצאה חודשית שכבר לא קיימת.
 */
export function vendorSpend(vendors, buildings, contractIndex, asOf = todayISO()) {
  const activeIds = new Set(buildings.filter((b) => b.status === "active").map((b) => b.id));
  const byId = new Map(
    vendors.map((v) => [v.id, {
      ...v, monthlySpend: 0, imputedVat: 0, buildingCount: 0,
      categories: new Set(), lines: [], oldestEffectiveFrom: null, undatedLines: 0,
    }])
  );

  for (const b of buildings) {
    if (!activeIds.has(b.id)) continue;
    const byCat = contractIndex.get(b.id);
    if (!byCat) continue;
    for (const [categoryId, list] of byCat) {
      const c = activeContract(list, asOf);
      if (!c?.vendorId || c.amount == null) continue;
      const agg = byId.get(c.vendorId);
      if (!agg) continue;
      agg.monthlySpend = round2(agg.monthlySpend + c.amount);
      agg.imputedVat = round2(agg.imputedVat + imputedVatIncluded(c));
      agg.buildingCount += 1;
      agg.categories.add(categoryId);
      agg.lines.push({
        buildingId: b.id, address: b.address, categoryId,
        categoryName: CATEGORY_BY_ID[categoryId]?.name || categoryId,
        amount: c.amount, effectiveFrom: c.effectiveFrom, contractId: c.id,
        vatMode: c.vatMode, isEstimate: c.isEstimate,
      });
      if (isISODate(c.effectiveFrom)) {
        if (!agg.oldestEffectiveFrom || c.effectiveFrom < agg.oldestEffectiveFrom) {
          agg.oldestEffectiveFrom = c.effectiveFrom;
        }
      } else {
        agg.undatedLines += 1;
      }
    }
  }

  return [...byId.values()]
    .map((v) => ({ ...v, categories: [...v.categories] }))
    .filter((v) => v.buildingCount > 0)
    .sort((a, b) => b.monthlySpend - a.monthlySpend);
}

/**
 * חוזים שמחירם לא זז מזמן — מועמדים למשא ומתן.
 *
 * ⚠ רק חוזים עם `effectiveFrom` ידוע נכנסים. חוזה בלי תאריך אינו ״ותיק״ אלא
 * **לא ידוע**, ומדווח בנפרד ב-`undatedCount`. ספירת הלא-ידועים כוותיקים הייתה
 * הופכת רשימת פעולה קצרה לרשימה של כמעט הכל, כלומר לחסרת ערך.
 */
export function stalePriceContracts(buildings, contractIndex, asOf = todayISO(), years = STALE_PRICE_YEARS) {
  const cutoffDays = years * 365;
  const out = [];
  let undatedCount = 0;

  for (const b of buildings) {
    if (b.status !== "active") continue;
    const byCat = contractIndex.get(b.id);
    if (!byCat) continue;
    for (const [categoryId, list] of byCat) {
      const c = activeContract(list, asOf);
      if (!c || c.amount == null) continue;
      if (!isISODate(c.effectiveFrom)) { undatedCount += 1; continue; }
      const age = daysBetween(c.effectiveFrom, asOf);
      if (age >= cutoffDays) {
        out.push({
          buildingId: b.id, address: b.address, categoryId,
          categoryName: CATEGORY_BY_ID[categoryId]?.name || categoryId,
          vendorId: c.vendorId, amount: c.amount,
          effectiveFrom: c.effectiveFrom, ageDays: age, ageYears: round2(age / 365),
        });
      }
    }
  }

  return {
    contracts: out.sort((a, b) => b.ageDays - a.ageDays),
    undatedCount,
    monthlyTotal: sum(out, (c) => c.amount),
  };
}

/**
 * ריכוז ספק: כמה הוא עולה, כמה בניינים, ובאיזה נתח מההוצאה.
 * `share` הוא הנתון שמסביר למה כדאי לנהל את המשא ומתן הזה ולא אחר.
 */
export function vendorConcentration(vendorRows, totalCost) {
  return vendorRows.map((v) => ({
    ...v,
    share: totalCost ? v.monthlySpend / totalCost : null,
    avgPerBuilding: v.buildingCount ? round2(v.monthlySpend / v.buildingCount) : 0,
  }));
}
