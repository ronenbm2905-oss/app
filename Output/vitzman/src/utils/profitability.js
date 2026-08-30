// ============================================================================
// profitability.js — מנוע הרווחיות. פונקציות טהורות בלבד.
//
// ----------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ----------------------------------------------------------------------------
// בגיליון המקור הרווח היה **ערך שמור**: 126 מתוך 131 השורות איבדו את הנוסחה
// והחזיקו מספר קשיח. הוא היה נכון רק כי הודבק אחרי חישוב תקין; העדכון הבא
// היה שובר אותו בשקט. כאן שום סכום אינו נשמר — הכל נגזר בכל קריאה.
// זה מה שהופך את ממצאים 1-5 מהאקסל לבלתי-אפשריים, לא תיקון חד-פעמי שלהם.
//
// ----------------------------------------------------------------------------
// שלוש הכרעות מדידה
// ----------------------------------------------------------------------------
// 1. **margin ו-markup שניהם מוחזרים, תמיד.** הגיליון חישב `(הכנסה-עלות)/עלות`
//    וקרא לזה "אחוז רווח". זה markup (תוספת על העלות), לא margin (שיעור מהמחזור).
//    ההפרש אינו זניח: 15.84% מול 13.68% על התיק כולו. הפתרון אינו להחליף נוסחה
//    אלא להחזיר את שתיהן מתויגות, כדי שאי אפשר יהיה יותר לבלבל.
//
// 2. **המע"מ הרעיוני נמדד, לא מומצא.** ל-23 חוזים של ספקי "עוסק פטור" הוסיפו
//    בגיליון מע"מ רעיוני כדי שהשוואת עלויות מול ספק רגיל תהיה הוגנת — אבל הוא
//    נבלע **לתוך** התא, ולכן מנפח את ההוצאה ומקטין את הרווח המדווח.
//    ההכרעה כאן: `amount` נשמר **כפי שהוא בגיליון** (`bookedCost`), וזה בסיס
//    הרווח — כך המערכת מתאזנת לשקל מול האקסל של רונן. הניפוח מוצג בנפרד כ-
//    `imputedVatIncluded` **אומדן מסומן**, כי הגיליון לא מתעד את הסכום המקורי
//    ולכן אי אפשר לגזור אותו בוודאות. לא משנים לרונן מספרים בשקט.
//
// 3. **חוזה בלי סכום (`amount === null`) אינו אפס.** בבר שאול 8 ובפינס 8 היה
//    בגיליון `'-'` שנספר כאפס בשקט. `null` = "לא אנחנו משלמים"; הוא לא נכנס
//    לסכום **ונספר** ב-`unpricedCount` כדי שיהיה גלוי.
// ============================================================================

import { round2, sum } from "./money.js";
import { EXPENSE_CATEGORIES, THIN_MARGIN_THRESHOLD } from "../constants.js";

/** ברירת מחדל: היום. נמסר במפורש בבדיקות כדי שהן לא ישתנו עם הזמן. */
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * החוזה התקף לקטגוריה בתאריך נתון: בעל ה-`effectiveFrom` הגדול ביותר שכבר עבר.
 * חוזה בלי `effectiveFrom` נחשב תקף מאז ומעולם (כך נכנסים נתוני הייבוא, שאין
 * להם תאריך תחולה במקור) — אבל מפסיד לכל חוזה מתוארך שכבר נכנס לתוקף.
 */
export function activeContract(contracts, asOf = todayISO()) {
  let best = null;
  for (const c of contracts) {
    if (c.effectiveFrom && c.effectiveFrom > asOf) continue;
    if (!best) { best = c; continue; }
    if ((c.effectiveFrom || "") > (best.effectiveFrom || "")) best = c;
  }
  return best;
}

/** מקבץ חוזים לפי buildingId → categoryId. נבנה פעם אחת ומועבר הלאה. */
export function indexContracts(contracts) {
  const idx = new Map();
  for (const c of contracts) {
    if (!c.buildingId || !c.categoryId) continue;
    let byCat = idx.get(c.buildingId);
    if (!byCat) { byCat = new Map(); idx.set(c.buildingId, byCat); }
    const list = byCat.get(c.categoryId);
    if (list) list.push(c); else byCat.set(c.categoryId, [c]);
  }
  return idx;
}

/**
 * רכיב המע"מ הרעיוני **הכלול בתוך** סכום החוזה, לחוזה של עוסק פטור.
 *
 * ⚠ אומדן. הגיליון מתעד ש"הוסף מע\"מ פיקטיבי" אך לא את הסכום שלפני ההוספה,
 * ולכן זו גזירה לאחור לפי `vatRate` ולא נתון מקור. מוצג תמיד מסומן ככזה.
 */
export const imputedVatIncluded = (c) => {
  if (!c || c.vatMode !== "imputed" || c.amount == null) return 0;
  const rate = Number(c.vatRate) || 0;
  return round2(c.amount - c.amount / (1 + rate));
};

/**
 * עלות בניין, מפורקת לקטגוריות.
 *
 * `bookedCost` — כפי שרשום בגיליון. זה בסיס הרווח, וזה מה שמתאזן מול האקסל.
 * `imputedVatTotal` — הרכיב הרעיוני שבתוכו (אומדן).
 * `cashCostEstimate` — `bookedCost` פחות הרעיוני. אומדן, לתצוגת השוואה בלבד.
 */
export function buildingCost(building, contractIndex, asOf = todayISO()) {
  const byCat = contractIndex.get(building.id) || new Map();
  const rows = [];
  let unpriced = 0, estimates = 0, conditional = 0;

  for (const cat of EXPENSE_CATEGORIES) {
    const contract = activeContract(byCat.get(cat.id) || [], asOf);
    if (!contract) continue;
    if (contract.isEstimate) estimates += 1;
    if (contract.isConditional) conditional += 1;
    // `null` = הוועד משלם ישירות / לא ידוע. נספר, לא מסוכם כאפס.
    if (contract.amount == null) {
      unpriced += 1;
      rows.push({ categoryId: cat.id, name: cat.name, amount: null, imputedVat: 0, contract });
      continue;
    }
    rows.push({
      categoryId: cat.id,
      name: cat.name,
      amount: contract.amount,
      imputedVat: imputedVatIncluded(contract),
      contract,
    });
  }

  const priced = rows.filter((r) => r.amount != null);
  const booked = sum(priced, (r) => r.amount);
  const imputed = sum(priced, (r) => r.imputedVat);
  return {
    bookedCost: booked,
    imputedVatTotal: imputed,
    cashCostEstimate: round2(booked - imputed),
    byCategory: rows,
    unpricedCount: unpriced,
    estimateCount: estimates,
    conditionalCount: conditional,
  };
}

/**
 * רווחיות בניין.
 *
 * `margin` = רווח / **הכנסה** — שיעור הרווח מהמחזור. זה המספר העסקי.
 * `markup` = רווח / **עלות** — תוספת על העלות. זה מה שהאקסל הציג כ"אחוז רווח".
 * שניהם `null` כשהמכנה 0 — לא 0, כי "אין רווח" ו"אי אפשר לחשב" אינם אותו דבר.
 */
export function buildingProfit(building, contractIndex, asOf = todayISO()) {
  const cost = buildingCost(building, contractIndex, asOf);
  const income = round2(building.managementFee || 0);
  const profit = round2(income - cost.bookedCost);
  return {
    buildingId: building.id,
    address: building.address,
    status: building.status,
    assignedEmployeeId: building.assignedEmployeeId,
    income,
    cost: cost.bookedCost,
    imputedVatTotal: cost.imputedVatTotal,
    cashCostEstimate: cost.cashCostEstimate,
    profit,
    margin: income ? profit / income : null,
    markup: cost.bookedCost ? profit / cost.bookedCost : null,
    /** אומדן: הרווח אילו המע"מ הרעיוני לא היה נספר כהוצאה. */
    profitExImputedVat: round2(income - cost.cashCostEstimate),
    isLoss: profit < 0,
    isThin: income > 0 && profit >= 0 && profit / income < THIN_MARGIN_THRESHOLD,
    detail: cost,
  };
}

/**
 * סיכום התיק.
 *
 * ⚠ שים לב לטווח: הפונקציה מקבלת את **המערך**, ולא טווח תאים. באקסל שורת
 * הסיכום השתמשה ב-`SUBTOTAL(9,Y2:Y118)` בזמן שהנתונים הגיעו עד שורה 132 —
 * 14 בניינים נשרו והפירוק לא התאזן לסה"כ (936,750 מול 940,050). טווח קשיח
 * הוא באג שממתין לשורה ה-133; מערך אינו יכול "להיגמר מוקדם".
 */
export function portfolioTotals(buildings, contractIndex, asOf = todayISO()) {
  const rows = buildings.map((b) => buildingProfit(b, contractIndex, asOf));
  const income = sum(rows, (r) => r.income);
  const cost = sum(rows, (r) => r.cost);
  const profit = round2(income - cost);
  const imputed = sum(rows, (r) => r.imputedVatTotal);
  return {
    buildingCount: rows.length,
    income,
    cost,
    imputedVatTotal: imputed,
    cashCostEstimate: round2(cost - imputed),
    profit,
    margin: income ? profit / income : null,
    markup: cost ? profit / cost : null,
    profitExImputedVat: round2(income - (cost - imputed)),
    losses: rows.filter((r) => r.isLoss).sort((a, b) => a.profit - b.profit),
    thin: rows.filter((r) => r.isThin).sort((a, b) => (a.margin ?? 1) - (b.margin ?? 1)),
    rows,
  };
}

/**
 * פירוק לקטגוריות על פני כל הבניינים.
 *
 * חוזה אחד ויחיד עם `portfolioTotals`: **`actualTotal` חייב להיות שווה
 * ל-`portfolioTotals().cost`**. בדיקת smoke נועלת את זה. זה ממצא 2 מהגיליון,
 * מומר משגיאה שקטה לבדיקה שנכשלת בקול.
 */
export function categoryBreakdown(buildings, contractIndex, asOf = todayISO()) {
  const acc = new Map(EXPENSE_CATEGORIES.map((c) => [c.id, {
    categoryId: c.id, name: c.name, sourceCol: c.col,
    actual: 0, imputedVat: 0, buildingCount: 0, unpricedCount: 0,
  }]));

  for (const b of buildings) {
    const { byCategory } = buildingCost(b, contractIndex, asOf);
    for (const row of byCategory) {
      const entry = acc.get(row.categoryId);
      if (!entry) continue;
      if (row.amount == null) { entry.unpricedCount += 1; continue; }
      entry.actual = round2(entry.actual + row.amount);
      entry.imputedVat = round2(entry.imputedVat + row.imputedVat);
      entry.buildingCount += 1;
    }
  }

  const list = [...acc.values()].sort((a, b) => b.actual - a.actual);
  return {
    categories: list,
    actualTotal: sum(list, (c) => c.actual),
    imputedVatTotal: sum(list, (c) => c.imputedVat),
  };
}

/**
 * היסטוריית המחירים של קטגוריה בבניין — כל החוזים, החדש בראש.
 * זה מה ש-27 הערות "עלה מ-X ל-Y החל מ-Z" הפכו להיות.
 */
export function priceHistory(buildingId, categoryId, contractIndex) {
  const list = (contractIndex.get(buildingId) || new Map()).get(categoryId) || [];
  return [...list].sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
}

/**
 * בניינים פעילים בלי עובד אחראי. באקסל היו 37 כאלה ואיש לא ידע —
 * הרשימה ישבה בגיליון נפרד שאיש לא הצליב.
 */
export const unassignedBuildings = (buildings) =>
  buildings.filter((b) => b.status === "active" && !b.assignedEmployeeId);

/** עומס פר עובד, כולל הרווח שהוא אחראי עליו. */
export function employeeLoad(employees, buildings, contractIndex, asOf = todayISO()) {
  return employees
    .map((e) => {
      const mine = buildings.filter((b) => b.status === "active" && b.assignedEmployeeId === e.id);
      const rows = mine.map((b) => buildingProfit(b, contractIndex, asOf));
      return {
        employeeId: e.id,
        name: e.name,
        buildingCount: mine.length,
        income: sum(rows, (r) => r.income),
        profit: sum(rows, (r) => r.profit),
      };
    })
    .sort((a, b) => b.buildingCount - a.buildingCount);
}
