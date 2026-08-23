// ============================================================================
// constants.js — מודל הנתונים המלא של פרוסה 1.
// כל 9 הישויות מסעיף 1 באפיון ממומשות כסכימה, גם אם חלקן עדיין לא מוצגות
// במסכים — כדי לא לשבור סכימה בפרוסות הבאות.
// ============================================================================

// --- Enums (key-based; התוויות המתורגמות ב-i18n תחת enum.<group>.<key>) ---

export const COUNTRIES = ["IL", "CY", "US", "GE"]; // ישראל / קפריסין / ארה"ב / גאורגיה

// מטבע ברירת-מחדל מוצע לפי מדינה (המשתמש יכול לשנות — מטבע הוא שדה נפרד ברמת הנכס)
export const CURRENCY_BY_COUNTRY = {
  IL: "ILS",
  CY: "EUR",
  US: "USD",
  GE: "GEL",
};

export const CURRENCIES = ["ILS", "EUR", "USD", "GEL", "GBP"];

export const PROPERTY_TYPES = [
  "apartment", // דירה בבית משותף
  "commercial", // מסחרי
  "storage", // מחסן
  "parking", // חניה
  "house", // בית
  "lot", // מגרש
];

export const PROPERTY_STATUSES = [
  "rented", // מושכר
  "vacant", // פנוי
  "protected", // מוגן
  "invaded", // פלוש
  "renovation", // בשיפוץ
  "partnership", // בשותפות
  "demolished", // הרוס
  "sold", // נמכר
];

export const ATTACHMENTS = ["parking", "garden", "roof", "storage"]; // הצמדות (רב-בחירה)

export const TENANT_LINK = "whatsapp"; // הטלפון מקושר לוואטסאפ

export const LEASE_STATUSES = ["active", "ended", "renewing"]; // פעיל / הסתיים / בחידוש

export const DEPOSIT_TYPES = ["cash", "bankGuarantee", "check", "promissory"]; // סוג פיקדון

export const TRANSACTION_TYPES = ["income", "expense"]; // הכנסה / הוצאה

export const TRANSACTION_CATEGORIES = [
  "rent", // שכ"ד
  "committee", // ועד בית
  "insurance", // ביטוח
  "taxes", // מיסים (כולל ארנונה)
  "utilities", // חשבונות שוטפים (חשמל/מים/גז)
  "maintenance", // תחזוקה
  "financing", // מימון
  "other", // אחר
];

// מיפוי סוג-מסמך (מחשבון סרוק) לקטגוריית הוצאה — ליצירת הוצאה אוטומטית.
export const DOC_TYPE_TO_EXPENSE_CATEGORY = {
  municipalTax: "taxes",
  electricity: "utilities",
  water: "utilities",
  gas: "utilities",
};

// מקור עדכון התנועה — שדה מוכן מהיום ל-v2 (Open Banking). ברירת מחדל: manual.
export const TRANSACTION_SOURCES = ["manual", "bank"];

export const TICKET_TYPES = [
  "plumbing", // אינסטלציה
  "electricity", // חשמל
  "hvac", // מיזוג אוויר
  "appliance", // מכשיר/מוצר חשמלי
  "structural", // מבנה
  "pest", // מזיקים
  "other", // אחר
];

export const TICKET_STATUSES = ["open", "inProgress", "closed"]; // פתוח / בטיפול / סגור

export const DOCUMENT_TYPES = [
  "leaseContract", // חוזה שכירות
  "saleContract", // חוזה מכר
  "insurance", // ביטוח
  "receipt", // קבלה
  "id", // ת.ז.
  "houseRegulations", // תקנון בית משותף
  "municipalTax", // ארנונה
  "electricity", // חשבון חשמל
  "water", // חשבון מים
  "landRegistry", // נסח טאבו / רישום מקרקעין
  "other",
];

// B-AI-2 (שער עדי): סריקת AI מותרת רק למסמכים סטרוקטורים מה-MVP (allowlist).
// כל השאר — ובמיוחד `id` (צילום ת.ז.) — חסום מסריקה אוטומטית כדי לא לשלוח
// מסמך זיהוי ממשלתי / PII עודף למעבד חיצוני. חילוץ ידני עדיין מותר לכל הסוגים.
export const AI_SCANNABLE_TYPES = [
  "saleContract", // חוזה מכר
  "leaseContract", // חוזה שכירות
  "municipalTax", // ארנונה
  "electricity", // חשבון חשמל
  "water", // חשבון מים
  "landRegistry", // נסח טאבו
];

export const REMINDER_TYPES = [
  "leaseRenewal", // חידוש חוזה
  "insurance", // חידוש ביטוח
  "taxReport", // דיווח מס
  "annualCheck", // בדיקה שנתית
];

export const REMINDER_STATUSES = ["pending", "done", "dismissed"];

// סטטוס שיוך משתמש (דייר/איש תחזוקה) — שלד הזמנה לפרוסה 2
export const MEMBER_STATUSES = ["none", "invited", "active"];

// סיווג ראשוני של הנכס לפי גודל הפורטפוליו (מסך 0) — מכוונן עומק ממשק
export const PORTFOLIO_SIZES = ["1", "2-5", "6-20", "20+"];

// סף תשואה נמוכה (ברירת מחדל) — מסך 2
export const LOW_YIELD_THRESHOLD = 3; // אחוזים

// ------------------ מגבלות פר-תוכנית (תמחור עתידי — בלי אכיפה כרגע) ---------
// מבנה מוכן; אין אכיפה בפרוסה 1. שדה settings.plan קובע את התוכנית.
export const PLAN_LIMITS = {
  free: { maxProperties: 3 },
  pro: { maxProperties: 20 },
  business: { maxProperties: 100 },
  unlimited: { maxProperties: Infinity },
};

// ------------------ מצב התחלתי ריק (EMPTY, לא SAMPLE) ----------------------
export const EMPTY = {
  schemaVersion: 1,
  properties: [],
  units: [],
  tenants: [],
  leases: [],
  transactions: [],
  debts: [],
  tickets: [],
  documents: [],
  reminders: [],
  settings: {
    onboardingComplete: false,
    portfolioSize: null, // מתוך PORTFOLIO_SIZES
    plan: "free", // מפתח מתוך PLAN_LIMITS — בלי אכיפה כרגע
    lowYieldThreshold: LOW_YIELD_THRESHOLD,
  },
};

// שם האוסף/המסמך בענן: כל בעלים = מסמך יחיד owners/{uid}
export const OWNER_COLLECTION = "owners";
