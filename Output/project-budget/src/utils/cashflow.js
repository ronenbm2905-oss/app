// ============================================================================
// cashflow.js — מנוע התזרים החודשי.
//
// מה שהאקסל של רונן עושה: גריד של 20 חודשים, שורות עלות מול שורות מקורות.
// מה שהוא **לא** עושה, ובגללו נבנה המנוע הזה — הערה 38 בגיליון מודה בזה:
// "יש להיערך לגיבוי ככל שמס רכוש לא יעביר את ההחזר בזמן".
// דחייה של 30 יום נוספים על מנה של 1.64 מיליון פותחת חור מזומנים שהגריד הסטטי
// לא מראה. `delayDays` מזיז את כל תקבולי הרשות ומחזיר את החודש הראשון שנשבר.
//
// ‼ `delayDays` הוא עיכוב **מעבר לתוכנית**, לא הפיגור המוחלט. התוכנית כבר
// מניחה פיגור מסוים (בפינסקר: הגשה 11/10 → תקבול בנובמבר, כלומר ~30 יום),
// ולכן `delayDays=30` פירושו "התקבול מאחר בחודש נוסף מעבר למה שתוכנן".
// אילו הפרמטר היה מוחלט, כל תרחיש היה מזיז גם תקבולים שכבר מתוזמנים נכון.
//
// כל החישוב הוא **חודשי**, כי כך הפרויקט באמת מתנהל ("התשלומים לספקים יבוצעו
// החל מ-11 לכל חודש"). לכן דחייה בימים מתורגמת לחודשים שלמים — עיגול ל-30 יום.
// ============================================================================

import { round2, sum } from "./money.js";
import { addMonths, monthRange, toMonth } from "./dates.js";

const bump = (map, month, amount) => {
  if (!month) return;
  map.set(month, round2((map.get(month) || 0) + amount));
};

/** דחייה בימים → הזזה בחודשים שלמים. 30→1, 60→2, 90→3. */
export const delayToMonths = (delayDays) => Math.round((Number(delayDays) || 0) / 30);

/**
 * @param {object} slice   נתוני הפרויקט: { project, costLines, invoices, payments, fundingEvents }
 * @param {object} [opts]
 * @param {number} [opts.delayDays=0]  עיכוב תקבולי הרשות **מעבר לתוכנית**
 * @param {string} [opts.asOfMonth]    עד חודש זה (כולל) משתמשים בביצוע בפועל;
 *                                     אחריו — בתכנון. null = תזרים תכנוני טהור.
 */
export function buildCashflow(slice, opts = {}) {
  const { project, costLines = [], payments = [], fundingEvents = [] } = slice;
  const delayDays = opts.delayDays || 0;
  const asOfMonth = opts.asOfMonth || null;
  const shift = delayToMonths(delayDays);

  const plannedOut = new Map();
  const actualOut = new Map();
  const plannedIn = new Map();
  const actualIn = new Map();

  for (const line of costLines) {
    for (const row of line.schedule || []) bump(plannedOut, row.month, row.amount);
  }
  for (const p of payments) bump(actualOut, toMonth(p.date), p.amount);

  for (const f of fundingEvents) {
    // רק תקבולי הרשות נדחים — מימון הבעלים בשליטתו ולא מושפע מהתרחיש.
    const month = f.type === "taxRefund" && shift ? addMonths(f.month, shift) : f.month;
    bump(plannedIn, month, f.plannedAmount);
    if (f.actualAmount != null) bump(actualIn, toMonth(f.actualDate) || f.month, f.actualAmount);
  }

  const all = [...plannedOut.keys(), ...actualOut.keys(), ...plannedIn.keys(), ...actualIn.keys()]
    .filter(Boolean)
    .sort();
  if (!all.length) {
    return { months: [], openingCash: round2(project?.openingCash ?? 0), totals: emptyTotals(), firstNegative: null, lowestPoint: null };
  }

  const from = project?.startMonth && project.startMonth < all[0] ? project.startMonth : all[0];
  const to = project?.endMonth && project.endMonth > all[all.length - 1] ? project.endMonth : all[all.length - 1];

  let balance = round2(project?.openingCash ?? 0);
  const months = monthRange(from, to).map((month) => {
    const isPast = asOfMonth ? month <= asOfMonth : false;
    const pOut = plannedOut.get(month) || 0;
    const aOut = actualOut.get(month) || 0;
    const pIn = plannedIn.get(month) || 0;
    const aIn = actualIn.get(month) || 0;
    const effOut = isPast ? aOut : pOut;
    const effIn = isPast ? aIn : pIn;
    const net = round2(effIn - effOut);
    balance = round2(balance + net);
    return {
      month,
      isPast,
      plannedOut: pOut,
      actualOut: aOut,
      plannedIn: pIn,
      actualIn: aIn,
      effectiveOut: effOut,
      effectiveIn: effIn,
      net,
      balance,
      /** חודש שעבר ואין בו תנועה מתועדת בזמן שהתוכנית ציפתה לכזו. */
      missingActuals: isPast && (pOut > 0 || pIn > 0) && aOut === 0 && aIn === 0,
    };
  });

  const negatives = months.filter((m) => m.balance < -0.01);
  const lowest = months.reduce((min, m) => (min == null || m.balance < min.balance ? m : min), null);

  return {
    months,
    openingCash: round2(project?.openingCash ?? 0),
    delayDays,
    totals: {
      plannedOut: sum(months, (m) => m.plannedOut),
      actualOut: sum(months, (m) => m.actualOut),
      plannedIn: sum(months, (m) => m.plannedIn),
      actualIn: sum(months, (m) => m.actualIn),
      closingBalance: months.length ? months[months.length - 1].balance : 0,
    },
    firstNegative: negatives.length
      ? { month: negatives[0].month, amount: negatives[0].balance }
      : null,
    /** גודל החור: כמה מזומן צריך להביא כדי שהתרחיש לא ישבור את הקופה. */
    shortfall: negatives.length ? round2(-Math.min(...negatives.map((m) => m.balance))) : 0,
    lowestPoint: lowest ? { month: lowest.month, balance: lowest.balance } : null,
    /**
     * חודשים שבהם הקופה נוגעת באפס. תוכנית שמסתדרת בדיוק על אפס אינה תוכנית
     * בטוחה — היא תוכנית בלי כרית. זה המספר שהופך "מאוזן" ל"מאוזן אבל שברירי".
     */
    zeroBufferMonths: months.filter((m) => m.balance >= -0.01 && m.balance < BUFFER_FLOOR).length,
  };
}

/** מתחת לזה נחשב "בלי כרית" — כשליש מהתשלום החודשי השוטף בפרויקט כזה. */
export const BUFFER_FLOOR = 50000;

const emptyTotals = () => ({
  plannedOut: 0,
  actualOut: 0,
  plannedIn: 0,
  actualIn: 0,
  closingBalance: 0,
});

/**
 * מריץ את התזרים על כמה תרחישי דחייה ומחזיר טבלת השוואה.
 * זו התשובה לשאלה "מה קורה אם מס רכוש מאחר?" בלי לגעת בנתונים.
 */
export function stressTest(slice, delays, opts = {}) {
  return delays.map((delayDays) => {
    const r = buildCashflow(slice, { ...opts, delayDays });
    return {
      delayDays,
      firstNegative: r.firstNegative,
      shortfall: r.shortfall,
      lowestPoint: r.lowestPoint,
      closingBalance: r.totals.closingBalance,
    };
  });
}
