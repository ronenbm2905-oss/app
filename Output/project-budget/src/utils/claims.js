// ============================================================================
// claims.js — מנוע מנות ההגשה לרשות (מס רכוש).
//
// זה החלק שהאקסל של רונן עשה ביד בשורות 28–33: אוספים חשבוניות עד שמגיעים
// ליעד המנה, ואם חסר — מוסיפים "השלמת חשבונית". כאן זה מנוע:
// המנה יודעת מה נצבר בה, כמה חסר ליעד, ומתי צפוי ההחזר.
//
// חוק ברזל: **המערכת מכינה מנה — היא לא מגישה אותה.** ההגשה למס רכוש היא
// הגשה רשמית לרשות ונעשית ע"י המשתמש; כאן רק מסמנים "הוגש" בדיעבד.
// ============================================================================

import { round2, sum } from "./money.js";
import { addDays } from "./dates.js";
import { CLAIM_STATUS_IN_BATCH } from "../constants.js";

/** החשבוניות המשויכות למנה. */
export const batchInvoices = (invoices, batchId) =>
  invoices.filter((i) => i.claimBatchId === batchId);

/**
 * חשבוניות שאפשר לשייך למנה חדשה: זכאיות להחזר, וטרם נכנסו למנה אחרת.
 * (`notEligible` = הוצאה שלא מוחזרת; היא נשארת בתקציב אבל לא בהגשה.)
 */
export const availableForBatch = (invoices, projectId) =>
  invoices.filter(
    (i) =>
      i.projectId === projectId &&
      !i.claimBatchId &&
      i.claimStatus === "eligible" &&
      i.status !== "rejected",
  );

/** הסכום שהחשבונית תורמת למנה — `claimedAmount` אם הוגדר, אחרת הברוטו המלא. */
export const claimAmountOf = (invoice) =>
  round2(invoice.claimedAmount == null ? invoice.amountGross : invoice.claimedAmount);

/**
 * סיכום מנה. `gapToTarget` הוא בדיוק המספר שרונן חישב ידנית
 * ("השלמת חשבונית ל-1.5 מיליון" = 221,824).
 */
export function batchSummary(batch, invoices) {
  const rows = batchInvoices(invoices, batch.id);
  const invoicesTotal = sum(rows, claimAmountOf);
  const submittedTotal = round2(invoicesTotal + batch.topUpAmount);
  const gapToTarget = round2(batch.targetAmount - submittedTotal);
  const refunded = batch.refundedAmount == null ? 0 : batch.refundedAmount;
  return {
    invoiceCount: rows.length,
    invoicesTotal,
    topUpAmount: round2(batch.topUpAmount),
    submittedTotal,
    targetAmount: round2(batch.targetAmount),
    gapToTarget, // חיובי = חסר ליעד · שלילי = חריגה מעל היעד
    isBalanced: Math.abs(gapToTarget) < 0.01,
    refundedAmount: round2(refunded),
    outstanding: round2(submittedTotal - refunded),
    /** קיצוץ הרשות: מה שהוגש פחות מה שהוחזר בפועל (רק אחרי החזר). */
    reduction: batch.actualRefundDate ? round2(submittedTotal - refunded) : null,
    /**
     * מה שתוכנן להיכנס למנה לפי הגיליון אך עדיין אין מאחוריו חשבונית במערכת.
     * זו רשימת המטלות של המנה: כל עוד המספר הזה גדול מאפס, המנה לא באמת מוכנה.
     */
    plannedTotal: sum(batch.plannedComponents || [], (c) => c.amount),
    unbacked: round2(sum(batch.plannedComponents || [], (c) => c.amount) - invoicesTotal),
  };
}

/**
 * ההשלמה הדרושה כדי לסגור את המנה על היעד. חוזר 0 אם כבר הגענו/עברנו —
 * המערכת לא מציעה השלמה שלילית, זו הייתה טעות שקטה.
 */
export function suggestedTopUp(batch, invoices) {
  const invoicesTotal = sum(batchInvoices(invoices, batch.id), claimAmountOf);
  return Math.max(0, round2(batch.targetAmount - invoicesTotal));
}

/**
 * מועד ההחזר הצפוי = מועד ההגשה + פיגור. אם טרם הוגש — מהמועד המתוכנן,
 * כדי שהתזרים יוכל להראות תקבול עתידי של מנה שעוד לא יצאה.
 */
export function expectedRefundDate(batch) {
  if (batch.expectedRefundDate) return batch.expectedRefundDate;
  const base = batch.submittedDate || batch.plannedDate;
  return base ? addDays(base, batch.refundLagDays) : null;
}

/** הסטטוס שהמנה *אמורה* להיות בו לפי הנתונים — לזיהוי סטטוס שנשכח מאחור. */
export function derivedBatchStatus(batch, invoices) {
  const s = batchSummary(batch, invoices);
  if (batch.actualRefundDate) {
    return s.outstanding > 0.01 ? "partiallyRefunded" : "closed";
  }
  return batch.submittedDate ? "submitted" : "planning";
}

/** claimStatus שחשבונית מקבלת כשמשייכים/מנתקים אותה ממנה. */
export const claimStatusOnAttach = () => "submitted";
export const claimStatusOnDetach = () => "eligible";

export const isInBatch = (invoice) =>
  !!invoice.claimBatchId || CLAIM_STATUS_IN_BATCH.includes(invoice.claimStatus);

/**
 * תמונת ההחזרים ברמת הפרויקט: כמה נצבר, כמה הוגש, כמה חזר, וכמה עוד מגיע
 * מתוך תקרת ההחזר שאושרה (בפינסקר: 4,780,215).
 */
export function claimsOverview(batches, invoices, entitlementCap, alreadyReceived = 0) {
  const list = batches.map((b) => ({ batch: b, ...batchSummary(b, invoices) }));
  const submitted = sum(
    list.filter((x) => x.batch.submittedDate),
    (x) => x.submittedTotal,
  );
  const refunded = sum(list, (x) => x.refundedAmount);
  const cap = round2(entitlementCap || 0);
  // מקדמה שהתקבלה לפני תחילת המעקב היא חלק מהתקרה שכבר נוצל, גם אם אין מאחוריה
  // מנה במערכת. בלעדיה "יתרת הזכאות" תציג יותר כסף ממה שבאמת נותר.
  const received = round2(alreadyReceived || 0);
  return {
    batches: list,
    submittedTotal: submitted,
    refundedTotal: refunded,
    alreadyReceived: received,
    inTransit: round2(submitted - refunded),
    entitlementCap: cap,
    remainingEntitlement: round2(cap - refunded - received),
    /** חשבוניות זכאיות שעוד לא נכנסו לשום מנה — כסף שיושב ולא הוגש. */
    unclaimedTotal: sum(
      invoices.filter((i) => !i.claimBatchId && i.claimStatus === "eligible"),
      claimAmountOf,
    ),
  };
}
