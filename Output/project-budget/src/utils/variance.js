// ============================================================================
// variance.js — תקציב מול ביצוע.
//
// הנקודה שהאקסל מפספס: מס רכוש קיצץ 2,126,208 ₪ (לפני מע"מ) מכתב הכמויות —
// אבל **העבודה עצמה עדיין תבוצע ותשולם**. לכן חריגה נמדדת מול שני בסיסים שונים
// שעונים על שתי שאלות שונות:
//
//   מול "אושר סופי"  → כמה מזה מס רכוש יחזיר לי?   (חשיפת ההחזר)
//   מול "ראשוני"     → כמה זה באמת עולה לי?        (חשיפת המממן)
//
// מדידה מול בסיס אחד בלבד מייצרת תמונה שגויה בשני הכיוונים.
// ============================================================================

import { round2, sum } from "./money.js";

/** חשבוניות שכבר "תפוסות" תקציבית: מאושרות או משולמות. טיוטות לא נספרות. */
const isCommitted = (inv) => inv.status === "approved" || inv.status === "paid";

/** כמה שולם בפועל על חשבונית (סכום התשלומים המשויכים). */
export function paidOnInvoice(invoice, payments) {
  return sum(
    payments.filter((p) => p.invoiceId === invoice.id),
    (p) => p.amount,
  );
}

/**
 * פירוק חשבונית לסעיפי כתב הכמויות.
 * החלק שלא הוקצה לסעיף נשאר על שורת-העל בלבד — לא ממציאים לו סעיף.
 * התשלום מתחלק לסעיפים לפי חלקם היחסי בחשבונית.
 */
function allocationsWithPaid(invoice, payments) {
  const paid = paidOnInvoice(invoice, payments);
  const gross = invoice.amountGross || 0;
  return (invoice.boqAllocations || []).map((a) => ({
    boqItemId: a.boqItemId,
    committed: round2(a.amount),
    paid: gross > 0 ? round2(paid * (a.amount / gross)) : 0,
  }));
}

/**
 * גלגול לרמת סעיף כתב הכמויות.
 * @returns Map<boqItemId, { committed, paid }>
 */
export function itemActuals(invoices, payments) {
  const map = new Map();
  for (const inv of invoices) {
    if (!isCommitted(inv)) continue;
    for (const a of allocationsWithPaid(inv, payments)) {
      const cur = map.get(a.boqItemId) || { committed: 0, paid: 0 };
      map.set(a.boqItemId, {
        committed: round2(cur.committed + a.committed),
        paid: round2(cur.paid + a.paid),
      });
    }
  }
  return map;
}

/**
 * גלגול פר-פרק. שורות `isChapterTotal` הן מקור האמת לשלושת הבסיסים — כי
 * "ראשוני" ו"אושר סופי" קיימים בקבצי המקור **ברמת פרק בלבד**; רק "הוגש"
 * קיים ברמת שורה. ראה `scripts/import-pinsker.mjs` להסבר המלא.
 */
export function chapterRollup(boqItems, invoices, payments) {
  const actuals = itemActuals(invoices, payments);
  const byChapter = new Map();

  for (const item of boqItems) {
    const key = item.chapter || "—";
    if (!byChapter.has(key)) {
      byChapter.set(key, {
        chapter: key,
        chapterName: item.chapterName || "",
        initial: 0,
        submitted: 0,
        approved: 0,
        committed: 0,
        paid: 0,
        items: [],
        needsReview: false,
      });
    }
    const row = byChapter.get(key);
    if (item.chapterName && !row.chapterName) row.chapterName = item.chapterName;
    if (item.needsReview) row.needsReview = true;

    if (item.isChapterTotal) {
      row.initial = round2(row.initial + item.priceInitial);
      row.submitted = round2(row.submitted + item.priceSubmitted);
      row.approved = round2(row.approved + item.priceApproved);
    } else {
      const a = actuals.get(item.id) || { committed: 0, paid: 0 };
      row.committed = round2(row.committed + a.committed);
      row.paid = round2(row.paid + a.paid);
      row.items.push({ ...item, ...a });
    }
  }

  return [...byChapter.values()]
    .map((row) => ({
      ...row,
      // הקיצוץ של הרשות: כמה מהמוגש לא אושר.
      taxCut: round2(row.approved - row.submitted),
      // חריגת ביצוע מול כל בסיס. חיובי = חורגים מעליו.
      varianceVsApproved: round2(row.committed - row.approved),
      varianceVsInitial: round2(row.committed - row.initial),
      remainingVsInitial: round2(row.initial - row.committed),
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter));
}

/** סיכום כל הפרקים — התמונה הראשית של "תקציב מול ביצוע". */
export function boqSummary(rollup) {
  return {
    initial: sum(rollup, (r) => r.initial),
    submitted: sum(rollup, (r) => r.submitted),
    approved: sum(rollup, (r) => r.approved),
    committed: sum(rollup, (r) => r.committed),
    paid: sum(rollup, (r) => r.paid),
    taxCut: sum(rollup, (r) => r.taxCut),
  };
}

/**
 * גלגול פר-שורת-על (עבודות / שמאי / מהנדס / ניהול).
 * זו הרמה שמכסה **את כל** התקציב — כתב הכמויות מכסה רק את שורת העבודות.
 */
export function costLineRollup(costLines, invoices, payments) {
  return costLines
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((line) => {
      const mine = invoices.filter((i) => i.costLineId === line.id && isCommitted(i));
      const committed = sum(mine, (i) => i.amountGross);
      const paidNow = sum(mine, (i) => paidOnInvoice(i, payments));
      const paid = round2(paidNow + line.paidBefore);
      const planned = sum(line.schedule || [], (r) => r.amount);
      return {
        ...line,
        committed,
        paid,
        plannedTotal: planned,
        remaining: round2(line.budgetGross - paid),
        uncommitted: round2(line.budgetGross - line.paidBefore - committed),
        overBudget: round2(committed + line.paidBefore - line.budgetGross),
        invoiceCount: mine.length,
      };
    });
}

export function projectTotals(costLineRows) {
  return {
    budget: sum(costLineRows, (r) => r.budgetGross),
    committed: sum(costLineRows, (r) => r.committed),
    paid: sum(costLineRows, (r) => r.paid),
    remaining: sum(costLineRows, (r) => r.remaining),
  };
}
