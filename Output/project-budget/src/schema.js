// ============================================================================
// schema.js — מפעלי ישויות (factories) + נרמול.
//
// כל ישות נוצרת דרך factory כדי שאף שדה לא ייעדר: קוד שקורא `invoice.boqAllocations`
// חייב לקבל מערך, לא undefined. הנרמול (`normalize`) ממזג נתונים ישנים מ-localStorage
// עם ברירות המחדל — כך ששינוי סכימה לא מפיל דמו קיים.
// ============================================================================

import { newId } from "./utils/id.js";
import { round2, sum, withVat } from "./utils/money.js";
import { DEFAULT_VAT_RATE, DEFAULT_REFUND_LAG_DAYS, EMPTY, SCHEMA_VERSION } from "./constants.js";

export function makeProject(p = {}) {
  return {
    id: p.id || newId("prj"),
    name: p.name || "",
    address: p.address || "",
    vatRate: p.vatRate ?? DEFAULT_VAT_RATE,
    startMonth: p.startMonth || null, // תחילת התזרים
    endMonth: p.endMonth || null,
    workMonths: p.workMonths ?? null, // חודשי עבודה בפועל (18 בפינסקר)
    refundLagDays: p.refundLagDays ?? DEFAULT_REFUND_LAG_DAYS,
    taxAuthorityName: p.taxAuthorityName || "מס רכוש",
    /** תקרת ההחזר שהרשות אישרה לפרויקט (בפינסקר: 4,780,215). */
    entitlementCap: round2(p.entitlementCap ?? 0),
    /** מה שכבר התקבל מהרשות לפני תחילת המעקב במערכת (מקדמה). */
    entitlementReceived: round2(p.entitlementReceived ?? 0),
    openingCash: round2(p.openingCash ?? 0),
    ownerUid: p.ownerUid || null,
    memberRoles: p.memberRoles || {}, // uid → owner | manager | viewer
    notes: Array.isArray(p.notes) ? p.notes : [],
    createdAt: p.createdAt || new Date().toISOString(),
  };
}

/** סעיף בכתב הכמויות — שלושת בסיסי המחיר יושבים זה לצד זה על אותה שורה. */
export function makeBoqItem(b = {}) {
  return {
    id: b.id || newId("boq"),
    projectId: b.projectId || null,
    chapter: b.chapter || "", // "02"
    chapterName: b.chapterName || "", // עבודות בטון יצוק באתר
    code: b.code || "", // "02.088.9801"
    description: b.description || "",
    unit: b.unit || "",
    qty: Number(b.qty) || 0,
    unitPrice: round2(b.unitPrice ?? 0),
    priceInitial: round2(b.priceInitial ?? 0),
    priceSubmitted: round2(b.priceSubmitted ?? 0),
    priceApproved: round2(b.priceApproved ?? 0),
    reviewerNote: b.reviewerNote || "", // הערת השמאי/המהנדס על הקיצוץ
    needsReview: !!b.needsReview, // אי-התאמה בין גיליונות המקור
    isChapterTotal: !!b.isChapterTotal, // שורת סיכום פרק (לא סעיף עבודה)
  };
}

/** שורת-על בתקציב: עבודות / שמאי / מהנדס / ניהול / אבדן דמי ניהול. */
export function makeCostLine(c = {}) {
  return {
    id: c.id || newId("cl"),
    projectId: c.projectId || null,
    name: c.name || "",
    kind: c.kind || "other", // works | appraiser | engineer | management | other
    budgetGross: round2(c.budgetGross ?? 0),
    paidBefore: round2(c.paidBefore ?? 0), // ששולם לפני תחילת המעקב במערכת
    order: Number(c.order) || 0,
    /** לוח התשלומים המתוכנן: [{ month, amount }] — מקור גריד התזרים. */
    schedule: Array.isArray(c.schedule) ? c.schedule.map(normalizeScheduleRow) : [],
  };
}

const normalizeScheduleRow = (r) => ({ month: r.month, amount: round2(r.amount ?? 0) });

export function makeVendor(v = {}) {
  return {
    id: v.id || newId("vnd"),
    projectId: v.projectId || null,
    name: v.name || "",
    taxId: v.taxId || "",
    phone: v.phone || "",
    email: v.email || "",
    defaultCostLineId: v.defaultCostLineId || null,
    notes: v.notes || "",
  };
}

/**
 * החשבונית — הישות המרכזית. שלושת הצרכים של המשתמש הם שלושה חתכים שלה:
 *   → payments                     (תזרים)
 *   → costLineId / boqAllocations  (תקציב מול ביצוע)
 *   → claimBatchId                 (החזרי מס רכוש)
 */
export function makeInvoice(i = {}) {
  const vatRate = i.vatRate ?? DEFAULT_VAT_RATE;
  const money =
    i.amountNet != null
      ? withVat(i.amountNet, vatRate)
      : withVat(round2((i.amountGross ?? 0) / (1 + vatRate)), vatRate);
  return {
    id: i.id || newId("inv"),
    projectId: i.projectId || null,
    vendorId: i.vendorId || null,
    vendorName: i.vendorName || "",
    invoiceNumber: i.invoiceNumber || "",
    issueDate: i.issueDate || null,
    dueDate: i.dueDate || null,
    vatRate,
    ...money,
    costLineId: i.costLineId || null,
    boqAllocations: Array.isArray(i.boqAllocations)
      ? i.boqAllocations.map((a) => ({ boqItemId: a.boqItemId, amount: round2(a.amount ?? 0) }))
      : [],
    status: i.status || "draft",
    claimStatus: i.claimStatus || "eligible",
    claimBatchId: i.claimBatchId || null,
    claimedAmount: i.claimedAmount == null ? null : round2(i.claimedAmount),
    taxApprovedAmount: i.taxApprovedAmount == null ? null : round2(i.taxApprovedAmount),
    documentId: i.documentId || null,
    extracted: i.extracted || null, // פלט סריקת AI לפני אישור אנושי
    notes: i.notes || "",
    createdBy: i.createdBy || null,
    createdAt: i.createdAt || new Date().toISOString(),
  };
}

/** תשלום בפועל שיצא מהקופה. חשבונית יכולה להיות משולמת בכמה פעימות. */
export function makePayment(p = {}) {
  return {
    id: p.id || newId("pay"),
    projectId: p.projectId || null,
    invoiceId: p.invoiceId || null,
    date: p.date || null,
    amount: round2(p.amount ?? 0),
    method: p.method || "transfer", // transfer | check | cash | other
    reference: p.reference || "",
    notes: p.notes || "",
  };
}

/** מנת חשבוניות להגשה לרשות. מודל ישיר של שורות 28–33 בגיליון של רונן. */
export function makeClaimBatch(b = {}) {
  return {
    id: b.id || newId("btc"),
    projectId: b.projectId || null,
    seq: Number(b.seq) || 1,
    title: b.title || "",
    plannedDate: b.plannedDate || null,
    submittedDate: b.submittedDate || null,
    targetAmount: round2(b.targetAmount ?? 0),
    /** השלמת חשבונית — הפער בין החשבוניות שנצברו ליעד המנה. */
    topUpAmount: round2(b.topUpAmount ?? 0),
    topUpNote: b.topUpNote || "",
    /**
     * מה שהמנה **מתוכננת** להכיל, לפני שיש חשבוניות אמיתיות מאחורי זה.
     * מגיע מהגיליון ("חשבוניות עד כה", "תשלום לקבלן"...) ומשמש כרשימת מטלות:
     * כל רכיב כאן שעדיין אין לו חשבונית במערכת הוא כסף לא מגובה.
     */
    plannedComponents: Array.isArray(b.plannedComponents)
      ? b.plannedComponents.map((c) => ({ label: c.label || "", amount: round2(c.amount ?? 0) }))
      : [],
    refundLagDays: b.refundLagDays ?? DEFAULT_REFUND_LAG_DAYS,
    expectedRefundDate: b.expectedRefundDate || null,
    actualRefundDate: b.actualRefundDate || null,
    refundedAmount: b.refundedAmount == null ? null : round2(b.refundedAmount),
    status: b.status || "planning",
    notes: b.notes || "",
  };
}

/** כסף שנכנס לקופה: מימון שוטף, הזרקה, או החזר מרשות. */
export function makeFundingEvent(f = {}) {
  return {
    id: f.id || newId("fnd"),
    projectId: f.projectId || null,
    type: f.type || "other",
    source: f.source || "", // אריאל / מס רכוש
    month: f.month || null,
    plannedAmount: round2(f.plannedAmount ?? 0),
    actualAmount: f.actualAmount == null ? null : round2(f.actualAmount),
    actualDate: f.actualDate || null,
    claimBatchId: f.claimBatchId || null, // לתקבול מס רכוש — איזו מנה מחזירה אותו
    notes: f.notes || "",
  };
}

export function makeDocument(d = {}) {
  return {
    id: d.id || newId("doc"),
    projectId: d.projectId || null,
    invoiceId: d.invoiceId || null,
    fileName: d.fileName || "",
    mimeType: d.mimeType || "",
    size: Number(d.size) || 0,
    storagePath: d.storagePath || null, // ענן
    localDataUrl: d.localDataUrl || null, // מצב מקומי בלבד
    uploadedAt: d.uploadedAt || new Date().toISOString(),
  };
}

const FACTORIES = {
  projects: makeProject,
  boqItems: makeBoqItem,
  costLines: makeCostLine,
  vendors: makeVendor,
  invoices: makeInvoice,
  payments: makePayment,
  claimBatches: makeClaimBatch,
  fundingEvents: makeFundingEvent,
  documents: makeDocument,
};

/** ממזג blob חלקי (localStorage ישן / ייבוא) עם EMPTY ומריץ כל שורה דרך ה-factory. */
export function normalize(raw) {
  const base = JSON.parse(JSON.stringify(EMPTY));
  if (!raw) return base;
  const out = { ...base, ...raw, schemaVersion: SCHEMA_VERSION };
  for (const [key, factory] of Object.entries(FACTORIES)) {
    out[key] = Array.isArray(raw[key]) ? raw[key].map((x) => factory(x)) : [];
  }
  out.settings = { ...base.settings, ...(raw.settings || {}) };
  return out;
}

/** סכום ההקצאות לסעיפי כתב הכמויות — חייב להיות ≤ ברוטו החשבונית. */
export const allocatedTotal = (invoice) => sum(invoice.boqAllocations || [], (a) => a.amount);
export const unallocated = (invoice) => round2(invoice.amountGross - allocatedTotal(invoice));
