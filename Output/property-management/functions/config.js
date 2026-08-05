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
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: {
      type: "string",
      enum: ["saleContract", "leaseContract", "municipalTax", "electricity", "water", "unknown"],
    },
    amount: { type: ["number", "null"] },
    date: { type: ["string", "null"] },
    address: { type: "string" },
    name: { type: "string" },
  },
  required: ["docType", "amount", "date", "address", "name"],
};
