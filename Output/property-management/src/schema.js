// ============================================================================
// schema.js — פונקציות יצירה (factories) לכל ישות, עם כל השדות מסעיף 1 באפיון.
// גם שדות שלא מוצגים עדיין במסכי פרוסה 1 קיימים כאן, כדי לא לשבור סכימה בהמשך.
//
// B1 (שער עדי — privacy-by-design): לכל ישות שדה `ownerId` מהיום — לא רק ל-Property.
// זהו קו-הגנה שני מעבר לבידוד ברמת מסמך owners/{uid}: כל שאילתה/סינון עתידיים
// (פרוסות הבאות, מודל תת-אוספים) יסננו לפי ownerId של המשתמש המחובר. הכשל הקטלני
// שנמנע: בעלים א' הקורא דיירי/מסמכי בעלים ב'. הערך מוטבע דרך partial.ownerId
// (App מספק את user.uid בכל יצירה).
// ============================================================================
import { newId } from "./utils/id.js";
import { CURRENCY_BY_COUNTRY } from "./constants.js";

// 1.1 נכס (Property)
export function createProperty(partial = {}) {
  const country = partial.country || "IL";
  return {
    id: newId("prop"),
    ownerId: partial.ownerId || null, // B1 — בידוד רב-בעלים
    // כתובת
    address: {
      country, // מדינה — שדה נפרד ברמת הנכס
      city: "",
      street: "",
      number: "",
      apartment: "",
      floor: "",
    },
    currency: partial.currency || CURRENCY_BY_COUNTRY[country] || "ILS", // מטבע — שדה נפרד ברמת הנכס
    type: partial.type || "apartment", // מתוך PROPERTY_TYPES
    status: partial.status || "vacant", // מתוך PROPERTY_STATUSES
    area: null, // שטח (מ"ר)
    rooms: null, // מספר חדרים
    attachments: [], // הצמדות (רב-בחירה) — מתוך ATTACHMENTS
    block: "", // גוש
    parcel: "", // חלקה
    planningNote: "", // שמירה תכנונית (בעיקר מגרשים)
    photos: [], // תמונות נכס (URLs / refs — פרוסות הבאות)
    shortTerm: false, // Airbnb / טווח קצר (כן/לא)
    // פרטים כלכליים
    finance: {
      purchaseDate: "", // מועד רכישה (ISO)
      purchasePrice: null, // מחיר רכישה
      equity: null, // הון עצמי
      financing: {
        amount: null, // סכום מימון
        lender: "", // מלווה
        monthlyPayment: null, // החזר חודשי
        balance: null, // יתרה
      },
      extraCosts: {
        purchaseTax: null, // מס רכישה
        notary: null, // נוטריון
        registration: null, // רישום
        renovation: null, // שיפוץ
        brokerage: null, // תיווך
        legal: null, // עו"ד
      },
    },
    // תשואה — שדה מחושב (לא מוזן ידנית). מחושב ב-utils/finance.js, לא נשמר כאן.
    createdAt: new Date().toISOString(),
    ...stripComputed(partial),
  };
}

// 1.2 יחידה (Unit) — אופציונלי; מקושרת לנכס אב
export function createUnit(propertyId, partial = {}) {
  return {
    id: newId("unit"),
    ownerId: partial.ownerId || null, // B1
    propertyId,
    label: "", // שם/מספר יחידה
    area: null,
    rooms: null,
    status: "vacant",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.3 דייר (Tenant)
export function createTenant(partial = {}) {
  return {
    id: newId("tnt"),
    ownerId: partial.ownerId || null, // B1
    fullName: "",
    nationalId: "", // ת.ז. (PII)
    phone: "", // טלפון — קישור ישיר לוואטסאפ (PII)
    email: "", // אימייל (PII) — משמש גם למיפוי משתמש בפורטל הדייר
    moveInDate: "", // מועד כניסה
    hasManager: false, // גורם מנהל קיים?
    manager: { name: "", phone: "", email: "" },
    // --- פרוסה 2: מיפוי משתמש לפורטל הדייר (שלד הזמנה) ---
    userId: partial.userId || null, // uid של הדייר לאחר התחברות (מקשר rules)
    portalStatus: partial.portalStatus || "none", // none | invited | active
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.4 חוזה (Lease)
export function createLease(partial = {}) {
  return {
    id: newId("lease"),
    ownerId: partial.ownerId || null, // B1
    propertyId: partial.propertyId || null,
    unitId: partial.unitId || null,
    tenantId: partial.tenantId || null,
    startDate: "",
    endDate: "",
    monthlyRent: null,
    paymentDay: null, // מועד תשלום חודשי (יום בחודש)
    deposit: { amount: null, type: "cash" }, // פיקדון (סכום + סוג)
    guarantees: { count: 0, scanRef: "" }, // ערבויות (מס' ערבים + סריקה)
    paymentMethod: "", // אופן תשלום
    // תשלומים נלווים — כלול בשכ"ד או לא
    utilities: {
      water: false,
      municipalTax: false,
      electricity: false,
      gas: false,
      committee: false,
    },
    contractScanRef: "", // קובץ חוזה סרוק
    extensionOption: false, // אופציית הארכה
    status: "active", // מתוך LEASE_STATUSES
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.5 תנועה כלכלית (Transaction)
export function createTransaction(partial = {}) {
  return {
    id: newId("txn"),
    ownerId: partial.ownerId || null, // B1
    propertyId: partial.propertyId || null,
    type: partial.type || "income", // income / expense
    category: partial.category || "rent", // מתוך TRANSACTION_CATEGORIES
    amount: null,
    date: "",
    source: partial.source || "manual", // manual / bank — ברירת מחדל manual (v2-ready)
    receiptRef: "", // קובץ קבלה/חשבונית
    note: "",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.6 חוב (Debt) — תת-סוג של תנועה עם מעקב סטטוס
export function createDebt(partial = {}) {
  return {
    id: newId("debt"),
    ownerId: partial.ownerId || null, // B1
    propertyId: partial.propertyId || null,
    tenantId: partial.tenantId || null,
    amount: null,
    sinceDate: "", // מתאריך
    daysOverdue: null, // ימי פיגור (יכול להיגזר מ-sinceDate)
    warningLetterSent: false, // נשלח מכתב התראה
    transferredToLawyer: false, // הועבר לעו"ד
    resolved: false, // הסתיים
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.7 תקלה (MaintenanceTicket)
export function createTicket(partial = {}) {
  return {
    id: newId("tkt"),
    ownerId: partial.ownerId || null, // B1
    propertyId: partial.propertyId || null,
    openedDate: partial.openedDate || new Date().toISOString().slice(0, 10),
    type: partial.type || "other", // מתוך TICKET_TYPES (תחום)
    issueKey: partial.issueKey || null, // מזהה מתוך MAINTENANCE_CATALOG (סוג תקלה ספציפי)
    description: "",
    handler: { name: "", phone: "" }, // גורם מטפל + פרטי קשר
    quote: null, // הצעת מחיר (פיננסי — לא נחשף לאיש התחזוקה)
    cost: null, // עלות סופית (פיננסי — לא נחשף לאיש התחזוקה)
    receiptRef: "", // קבלה
    underWarranty: false, // אחריות (כן/לא)
    insurance: { used: false, deductible: null }, // ביטוח (הופעל + השתתפות עצמית)
    status: partial.status || "open", // מתוך TICKET_STATUSES
    // --- פרוסה 2: שיוך לאיש צוות תחזוקה (assignee) + מקור דיווח דייר ---
    assigneeUserId: partial.assigneeUserId || null, // uid של איש התחזוקה (מקשר rules)
    assigneeEmail: partial.assigneeEmail || "", // אימייל השיוך (שלד הזמנה)
    assigneeStatus: partial.assigneeStatus || "none", // none | invited | active
    reportedByTenantId: partial.reportedByTenantId || null, // אם נפתחה ע"י דייר בפורטל
    // תמונות/קבלות מהשטח — איש התחזוקה מעלה (בפרוסה זו נרשמות מטא-דאטה; אחסון בפרוסה הבאה)
    fieldPhotos: partial.fieldPhotos || [], // [{ id, name, note, at }]
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.8 מסמך (Document)
export function createDocument(partial = {}) {
  return {
    id: newId("doc"),
    ownerId: partial.ownerId || null, // B1
    propertyId: partial.propertyId || null,
    tenantId: partial.tenantId || null,
    leaseId: partial.leaseId || null,
    type: partial.type || "other", // מתוך DOCUMENT_TYPES
    // B3 (מזעור): fileRef מוכן בסכימה, אך העלאת קבצים סרוקים (חוזה/ערבים/ת.ז.)
    // אינה נבנית בפרוסה 1. הצפנה/החלטת אחסון ממתינות לשער עדי לפני deploy.
    fileRef: "", // קובץ (ref ל-Storage — פרוסות הבאות)
    fileName: "",
    uploadDate: partial.uploadDate || new Date().toISOString().slice(0, 10),
    autoTagged: false, // תיוג אוטומטי ב-AI — לא בפרוסה 1 (שדה מוכן)
    // מטא-דאטה שחולצה בסריקת AI (סכום/תקופה/מספרי זיהוי) — נשמרת לתיעוד.
    extracted: partial.extracted || null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// 1.9 תזכורת / אוטומציה (Reminder) — סכימה קיימת, בלי מנוע התראות פעיל בפרוסה 1
export function createReminder(partial = {}) {
  return {
    id: newId("rem"),
    ownerId: partial.ownerId || null, // B1
    type: partial.type || "leaseRenewal", // מתוך REMINDER_TYPES
    propertyId: partial.propertyId || null,
    leaseId: partial.leaseId || null,
    dueDate: "", // תאריך יעד
    leadDays: 30, // ימי התראה מראש
    status: "pending", // מתוך REMINDER_STATUSES
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// עוזר: מונע דריסת שדות מחושבים אם הועברו בטעות ב-partial
function stripComputed(partial) {
  const clone = { ...partial };
  delete clone.yield; // תשואה מחושבת, לא נשמרת
  delete clone.country; // כבר טופל דרך address.country
  delete clone.currency;
  delete clone.type;
  delete clone.status;
  return clone;
}
