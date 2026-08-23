// קונפיג ה-Cloud Function לחילוץ מסמכים. מרוכז כאן כדי שאפשר יהיה להחליף מודל
// בעתיד בלי לגעת בלוגיקה.
export const CONFIG = {
  // מזהה המודל — מחרוזת מדויקת, בלי סיומת תאריך.
  MODEL: "claude-opus-5",
  // opus-5 חושב כברירת מחדל, ו-thinking+פלט חולקים את max_tokens → תקציב נדיב
  // שהחשיבה לא תחתוך את פלט ה-JSON הקצר.
  MAX_TOKENS: 4096,
  THINKING_EFFORT: "low", // נכנס ל-output_config.effort; adaptive thinking
  // opus-5 דוחה temperature/budget_tokens — לכן אינם מוגדרים כאן במכוון.
};

// סכימת הפלט המובנה (structured output) — מבטיחה JSON תקין במקום פרסינג טקסט.
// **חייבת להישאר זהה** ל-EXTRACTION_SCHEMA ב-`src/utils/aiExtract.js`.
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: {
      type: "string",
      enum: ["saleContract", "leaseContract", "municipalTax", "electricity", "water", "landRegistry", "unknown"],
    },
    amount: { type: ["number", "null"] }, // סכום לתשלום (כולל מע"מ)
    date: { type: ["string", "null"] }, // תאריך המסמך YYYY-MM-DD
    dueDate: { type: ["string", "null"] }, // מועד תשלום אחרון
    periodStart: { type: ["string", "null"] }, // תחילת תקופת חיוב
    periodEnd: { type: ["string", "null"] }, // סוף תקופת חיוב
    address: { type: "string" }, // כתובת הנכס
    name: { type: "string" }, // שם המחזיק / הצדדים
    supplier: { type: "string" }, // ספק / מנפיק
    accountNumber: { type: "string" }, // מספר חשבון לקוח / חוזה
    propertyNumber: { type: "string" }, // מספר נכס (ארנונה)
    meterNumber: { type: "string" }, // מספר מונה (מים/חשמל)
    block: { type: "string" }, // גוש (נסח טאבו)
    parcel: { type: "string" }, // חלקה (נסח טאבו)
    area: { type: ["number", "null"] }, // שטח במ"ר (נסח טאבו)
  },
  required: [
    "docType", "amount", "date", "dueDate", "periodStart", "periodEnd",
    "address", "name", "supplier", "accountNumber", "propertyNumber", "meterNumber",
    "block", "parcel", "area",
  ],
};
