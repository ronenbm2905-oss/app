// ============================================================================
// aiExtract.js — חילוץ פרטי מסמך (client-side wrapper).
//
// ארכיטקטורה (החלטת דורית): לאפליקציית ה-Vite **אסור** להחזיק מפתח Anthropic.
// הקריאה האמיתית ל-Claude עוברת דרך **Firebase Cloud Function** (ראה functions/),
// שמחזיקה את המפתח כ-secret בצד השרת. כאן רק:
//   - מצב ענן  → קורא ל-Cloud Function 'extractDocument' (httpsCallable).
//   - מצב מקומי → mock extractor (בלי מפתח/רשת), לבדיקת זרימת ה-UI.
//
// פרטיות (שער עדי): הסריקה שולחת PII למעבד חיצוני (Anthropic). לכן opt-in
// פר-מסמך בלבד (המשתמש לוחץ "סרוק עם AI"), ולא נשלח יותר מהמסמך הנדרש. ההפעלה
// החיה ממתינה לאישור שער הפרטיות.
// ============================================================================

// הערה: firebase.js מיובא **דינמית** בתוך extractDocument (לא ב-top-level), כדי
// שהמודול יישאר טהור (בלי תלות ב-import.meta.env / firebase SDK) — כך אפשר לייבא
// את mockExtract גם ב-Node (smoke test) בלי לגרור את שכבת הענן.

// סוגי המסמכים הסטרוקטורים ל-MVP (מהאפיון).
export const AI_DOC_TYPES = [
  "saleContract",
  "leaseContract",
  "municipalTax",
  "electricity",
  "water",
  "landRegistry",
  "unknown",
];

// סכימת הפלט המובנה — **זהה** לזו שב-`functions/config.js` (חייבות להישאר מסונכרנות).
// מספרים nullable; מחרוזות מוחזרות ריקות אם השדה חסר.
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: { type: "string", enum: AI_DOC_TYPES },
    amount: { type: ["number", "null"] }, // סכום לתשלום (כולל מע"מ)
    date: { type: ["string", "null"] }, // תאריך המסמך YYYY-MM-DD
    dueDate: { type: ["string", "null"] }, // מועד תשלום אחרון
    periodStart: { type: ["string", "null"] }, // תחילת תקופת חיוב
    periodEnd: { type: ["string", "null"] }, // סוף תקופת חיוב
    address: { type: "string" }, // כתובת הנכס
    name: { type: "string" }, // שם המחזיק / הצדדים
    supplier: { type: "string" }, // ספק / מנפיק (עירייה / חב' מים / חב' חשמל)
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

// שדות שהם "חשבון" (בעלי תקופת חיוב/מונה) — לתצוגה מותנית וליצירת הוצאה.
export const BILL_DOC_TYPES = ["municipalTax", "electricity", "water"];

// חילוץ פרטי מסמך. input: { base64, mediaType, fileName }.
// מחזיר { docType, amount, date, address, name, mock } או זורק שגיאה עם code.
export async function extractDocument(input, { forceMock = false } = {}) {
  const { isFirebaseConfigured } = await import("../firebase.js");
  if (forceMock || !isFirebaseConfigured) {
    return { ...mockExtract(input?.fileName || ""), mock: true };
  }
  // מצב ענן — קריאה ל-Cloud Function (המפתח בצד השרת בלבד).
  try {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const fns = getFunctions();
    const call = httpsCallable(fns, "extractDocument");
    const res = await call({
      base64: input.base64,
      mediaType: input.mediaType,
      fileName: input.fileName,
    });
    return { ...res.data, mock: false };
  } catch (err) {
    console.error("extractDocument cloud call failed", err);
    const e = new Error("ai.error");
    e.code = err?.code === "cancelled" ? "ai.refusal" : "ai.error";
    throw e;
  }
}

// mock extractor — חילוץ דמה דטרמיניסטי לפי שם הקובץ, בלי מפתח/רשת.
// מחזיר בדיוק את צורת הסכימה, כדי לבדוק את זרימת ה-UI (העלאה→חילוץ→מילוי).
export function mockExtract(fileName = "") {
  const f = String(fileName).toLowerCase();
  let docType = "unknown";
  if (f.includes("ארנונה") || f.includes("arnona") || f.includes("municipal")) docType = "municipalTax";
  else if (f.includes("חשמל") || f.includes("electric")) docType = "electricity";
  else if (f.includes("מים") || f.includes("water")) docType = "water";
  else if (f.includes("מכר") || f.includes("sale")) docType = "saleContract";
  else if (f.includes("שכיר") || f.includes("lease") || f.includes("rent")) docType = "leaseContract";
  else if (f.includes("טאבו") || f.includes("tabo") || f.includes("נסח") || f.includes("registry") || f.includes("זכויות")) docType = "landRegistry";

  const today = new Date().toISOString().slice(0, 10);
  // ערכי דמו לפי סוג (משקפים את השדות האמיתיים שראינו במסמכים).
  const byType = {
    municipalTax: { amount: 413.6, supplier: "עיריית תל אביב-יפו", accountNumber: "10107538", propertyNumber: "2000151461", meterNumber: "", block: "", parcel: "", area: null },
    electricity: { amount: 959.02, supplier: "חברת חשמל", accountNumber: "346655344", propertyNumber: "", meterNumber: "0-31761", block: "", parcel: "", area: null },
    water: { amount: 103.83, supplier: "מי אביבים", accountNumber: "10107538", propertyNumber: "", meterNumber: "2064526", block: "", parcel: "", area: null },
    saleContract: { amount: 1250000, supplier: "", accountNumber: "", propertyNumber: "", meterNumber: "", block: "", parcel: "", area: null },
    leaseContract: { amount: 5200, supplier: "", accountNumber: "", propertyNumber: "", meterNumber: "", block: "", parcel: "", area: null },
    landRegistry: { amount: null, supplier: "לשכת רישום המקרקעין (טאבו)", accountNumber: "", propertyNumber: "", meterNumber: "", block: "6368", parcel: "362", area: 2291 },
    unknown: { amount: null, supplier: "", accountNumber: "", propertyNumber: "", meterNumber: "", block: "", parcel: "", area: null },
  };
  const v = byType[docType];
  const isBill = docType === "municipalTax" || docType === "electricity" || docType === "water";

  return {
    docType,
    amount: v.amount,
    date: today,
    dueDate: isBill ? today : null,
    periodStart: isBill ? "2026-07-01" : null,
    periodEnd: isBill ? "2026-08-31" : null,
    address: "רחוב הדוגמה 12, תל אביב",
    name: "ישראל ישראלי",
    supplier: v.supplier,
    accountNumber: v.accountNumber,
    propertyNumber: v.propertyNumber,
    meterNumber: v.meterNumber,
    block: v.block,
    parcel: v.parcel,
    area: v.area,
  };
}
