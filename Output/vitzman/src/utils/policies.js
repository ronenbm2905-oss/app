// ============================================================================
// policies.js — מנוע הביטוחים. פונקציות טהורות.
//
// ⚠ **הפרמיה אינה נכנסת לרווחיות, וזו הגנה מבנית ולא הערה.**
// `buildingCost` ב-`profitability.js` עובר על `EXPENSE_CATEGORIES` וקורא רק
// מ-`contracts`. לפוליסה אין `categoryId` ואין נתיב לשם. מ-898,940 ₪ הפרמיות
// השנתיות, הוועד משלם ישירות ב-92 מ-142 השורות — הזרמתן לעלות הייתה מוחקת
// מאות אלפי שקלים מהרווח של ויצמן על חשבון כסף שאינו שלה.
//
// ⚠ **מנוע נפרד מ-`inspections.js` בכוונה, למרות הדמיון.** שם המועד **מוסק**
// מ-`lastDate + intervalMonths`; כאן הוא **נתון בחוזה** (`endDate`). חיבורם היה
// אומר ששינוי תדירות של גנרטור מזיז בשקט את סף ההתראה של הביטוח. מה שכן
// משותף: `dates.js`, ו**אוצר המילים** — כדי שלא ילמדו שפה שנייה.
// ============================================================================

import { daysBetween, isISODate, todayISO } from "./dates.js";
import { round2 } from "./money.js";

/** חלון ההתראה לחידוש. זמן היערכות עסקי, לא נגזרת של תדירות. */
export const RENEWAL_WARN_DAYS = 90;

/** סדר טיפול: פג קודם, ואחריו ״לא ידוע״ — כי גם הוא חוסר כיסוי אפשרי. */
export const POLICY_STATUS_ORDER = { overdue: 0, never: 1, dueSoon: 2, ok: 3 };

/**
 * מצב פוליסה נכון ל-`asOf`.
 *
 * ⚠ **״ללא תאריך״ אינו ״בתוקף״ ואינו ״פג״.** 15 שורות בקובץ בלי תאריך סיום;
 * הפוליסה קיימת והמידע חסר. הצגתן כתקינות הייתה מסתירה חוסר כיסוי אפשרי.
 */
export function policyStatus(policy, asOf = todayISO(), warnDays = RENEWAL_WARN_DAYS) {
  const endDate = isISODate(policy?.endDate) ? policy.endDate : null;
  if (!endDate) {
    return { status: "never", endDate: null, daysUntil: null, policy: policy || null };
  }
  const daysUntil = daysBetween(asOf, endDate);
  const status = daysUntil < 0 ? "overdue" : daysUntil <= warnDays ? "dueSoon" : "ok";
  return { status, endDate, daysUntil, policy };
}

/** תור הטיפול — ממוין לפי דחיפות ואז לפי מועד. */
export function policyQueue(policies, asOf = todayISO(), warnDays = RENEWAL_WARN_DAYS) {
  return (policies || [])
    .map((p) => ({ ...policyStatus(p, asOf, warnDays), id: p.id }))
    .filter((r) => r.status !== "ok")
    .sort((a, b) =>
      POLICY_STATUS_ORDER[a.status] - POLICY_STATUS_ORDER[b.status] ||
      (a.daysUntil ?? 1e9) - (b.daysUntil ?? 1e9));
}

export function policySummary(policies, asOf = todayISO(), warnDays = RENEWAL_WARN_DAYS) {
  const counts = { overdue: 0, dueSoon: 0, ok: 0, never: 0 };
  for (const p of policies || []) counts[policyStatus(p, asOf, warnDays).status] += 1;
  return {
    total: (policies || []).length,
    counts,
    needsAttention: counts.overdue + counts.dueSoon + counts.never,
    unlinked: (policies || []).filter((p) => !p.buildingIds?.length).length,
  };
}

/**
 * סיכום פרמיות.
 *
 * ⚠ **מסוכם על פוליסות, לא על קשרי בניין-פוליסה.** פוליסה שמכסה שלושה בניינים
 * נספרת פעם אחת; אחרת ״בירק 1א+ב+ברמן 2״ הייתה מנפחת את הסך פי שלושה.
 * ⚠ **`premiumAnnual` שנתי.** `monthly` הוא נגזרת מפורשת ולא ערך שמור.
 */
export function policyTotals(policies, { payer } = {}) {
  const list = (policies || []).filter((p) => (payer ? p.payer === payer : true));
  const priced = list.filter((p) => typeof p.premiumAnnual === "number");
  const annual = round2(priced.reduce((a, p) => a + p.premiumAnnual, 0));
  return {
    count: list.length,
    unpricedCount: list.length - priced.length,
    annualPremium: annual,
    monthlyPremium: round2(annual / 12),
  };
}

const groupBy = (policies, field) => {
  const m = new Map();
  for (const p of policies || []) {
    const key = (p[field] || "").trim() || "(לא רשום)";
    const e = m.get(key) || { name: key, count: 0, annualPremium: 0 };
    e.count += 1;
    if (typeof p.premiumAnnual === "number") e.annualPremium = round2(e.annualPremium + p.premiumAnnual);
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.annualPremium - a.annualPremium || b.count - a.count);
};

/** פילוח לפי חברת ביטוח — זו התשובה ל״אם ארצה להחליף״. */
export const insurerBreakdown = (policies) => groupBy(policies, "insurerName");
/** ולפי סוכנות. */
export const agencyBreakdown = (policies) => groupBy(policies, "agencyName");

/**
 * ⚠ ״פניקס״ ו״הפניקס״ הן אותה חברה בשני איותים — **מדווח, לא ממוזג.**
 * זה אותו כלל שנקבע לכתובות הבניינים: מיזוג ודאי בלבד, וכל ספק להכרעת רונן.
 * מיזוג אוטומטי כאן היה משנה לו מספרים בשקט.
 */
export function spellingConflicts(policies) {
  const byName = new Map();
  for (const p of policies || []) {
    const raw = (p.insurerName || "").trim();
    if (!raw) continue;
    // ״ה״ הידיעה בתחילת שם היא ההבדל היחיד שנחשב חשוד
    const key = raw.replace(/^ה/, "");
    if (!byName.has(key)) byName.set(key, new Map());
    const v = byName.get(key);
    v.set(raw, (v.get(raw) || 0) + 1);
  }
  const out = [];
  for (const [, variants] of byName) {
    if (variants.size < 2) continue;
    out.push({
      variants: [...variants.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    });
  }
  return out;
}

/** מפתח לפי בניין. פוליסה רב-בניינית מופיעה תחת כל אחד מהם. */
export function indexPolicies(policies) {
  const m = new Map();
  for (const p of policies || []) {
    for (const bid of p.buildingIds || []) {
      if (!m.has(bid)) m.set(bid, []);
      m.get(bid).push(p);
    }
  }
  return m;
}

/**
 * מחיקת פוליסה. מחזיר סיבה ולא זורק — דפוס `entities.js`.
 * ⚠ **מחיקת בניין אינה מוחקת פוליסה.** הפוליסה היא מסמך של מבטח חיצוני והיא
 * קיימת גם אחרי שהפסקנו לנהל את הבניין; היא רק מתנתקת ממנו.
 */
export function canDeletePolicy(policy) {
  if (!policy) return { ok: false, reason: "הפוליסה לא נמצאה" };
  if (policy.buildingIds?.length) {
    return {
      ok: false,
      reason: `הפוליסה משויכת ל-${policy.buildingIds.length} בניינים. נתק אותה מהם לפני המחיקה.`,
    };
  }
  return { ok: true, reason: null };
}

/** ניתוק פוליסות מבניין שנמחק — תוכנית `applyBatch`, לא מחיקה. */
export function planUnlinkBuilding(buildingId, policies) {
  const updates = [];
  for (const p of policies || []) {
    if (!p.buildingIds?.includes(buildingId)) continue;
    updates.push({ id: p.id, patch: { buildingIds: p.buildingIds.filter((b) => b !== buildingId) } });
  }
  return { updates, creates: [] };
}
