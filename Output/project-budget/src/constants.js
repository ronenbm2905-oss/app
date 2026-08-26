// ============================================================================
// constants.js — enums, תוויות עברית, ומצב פתיחה ריק.
//
// עיקרון מהשלד: EMPTY ולא SAMPLE. כלי ניהול תקציב אמיתי לא מתחיל עם נתוני דמו —
// נתוני פינסקר 9 נכנסים דרך הייבוא (`scripts/import-pinsker.mjs`), לא דרך קוד.
// ============================================================================

export const SCHEMA_VERSION = 1;

// --- מחזור החיים של החשבונית: שני צירים בלתי-תלויים ---------------------------
// status      = מה קורה לכסף שלנו (האם שילמנו).
// claimStatus = מה קורה מול מס רכוש (האם הוגש והוחזר).
// חשבונית יכולה להיות משולמת וטרם מוגשת, או מוגשת ומקוצצת. ערבוב שני הצירים
// לשדה אחד הוא בדיוק מה שהופך מעקב החזרים לבלגן — ולכן הם נפרדים.
export const INVOICE_STATUS = ["draft", "approved", "paid", "rejected"];
export const INVOICE_STATUS_LABEL = {
  draft: "טיוטה",
  approved: "מאושרת לתשלום",
  paid: "שולמה",
  rejected: "נדחתה",
};

export const CLAIM_STATUS = [
  "notEligible",
  "eligible",
  "submitted",
  "approvedByTax",
  "reducedByTax",
  "rejected",
];
export const CLAIM_STATUS_LABEL = {
  notEligible: "לא להחזר",
  eligible: "זכאית — טרם הוגשה",
  submitted: "הוגשה למס רכוש",
  approvedByTax: "אושרה במלואה",
  reducedByTax: "אושרה בחלקה",
  rejected: "נדחתה ע\"י מס רכוש",
};

// claimStatus שנחשבים "כבר בתוך מנה" — לא זמינים לשיוך למנה חדשה.
export const CLAIM_STATUS_IN_BATCH = ["submitted", "approvedByTax", "reducedByTax", "rejected"];

export const BATCH_STATUS = ["planning", "submitted", "partiallyRefunded", "closed"];
export const BATCH_STATUS_LABEL = {
  planning: "בהכנה",
  submitted: "הוגשה",
  partiallyRefunded: "הוחזרה חלקית",
  closed: "סגורה",
};

// --- מקורות מימון -----------------------------------------------------------
export const FUNDING_TYPES = ["ownerMonthly", "ownerLump", "taxRefund", "other"];
export const FUNDING_TYPE_LABEL = {
  ownerMonthly: "מימון שוטף",
  ownerLump: "הזרקת מימון",
  taxRefund: "החזר מס רכוש",
  other: "אחר",
};

// --- שלושת בסיסי התקציב -----------------------------------------------------
// ראשוני   = מה שהערכנו/דרשנו.        חשיפת המממן נמדדת מולו.
// הוגש     = מה שהוגש למס רכוש.
// אושר     = מה שמס רכוש אישר בפועל.  חשיפת ההחזר נמדדת מולו.
export const BASELINES = ["initial", "submitted", "approved"];
export const BASELINE_LABEL = {
  initial: "ראשוני",
  submitted: "הוגש למס רכוש",
  approved: "אושר סופי",
};

export const DEFAULT_VAT_RATE = 0.18;
export const DEFAULT_REFUND_LAG_DAYS = 60; // הערה 38 בגיליון: 30 בפועל, 60 לביטחון
export const DELAY_SCENARIOS = [0, 30, 60, 90];

export const ROLES = ["owner", "manager", "viewer"];
export const ROLE_LABEL = {
  owner: "בעלים",
  manager: "חברת ניהול",
  viewer: "צפייה בלבד",
};

// כל תת-האוספים במודל. סדר זה הוא גם סדר הכתיבה ל-Firestore.
export const ENTITY_COLLECTIONS = [
  "boqItems",
  "costLines",
  "vendors",
  "invoices",
  "payments",
  "claimBatches",
  "fundingEvents",
  "documents",
];

export const EMPTY = {
  schemaVersion: SCHEMA_VERSION,
  projects: [],
  boqItems: [],
  costLines: [],
  vendors: [],
  invoices: [],
  payments: [],
  claimBatches: [],
  fundingEvents: [],
  documents: [],
  settings: { activeProjectId: null },
};
