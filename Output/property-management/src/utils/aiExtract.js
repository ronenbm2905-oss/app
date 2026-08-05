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
  "unknown",
];

// סכימת הפלט המובנה — זהה לזו שה-Cloud Function מכתיב ל-Claude (structured output).
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: { type: "string", enum: AI_DOC_TYPES },
    amount: { type: ["number", "null"] },
    date: { type: ["string", "null"] },
    address: { type: "string" },
    name: { type: "string" },
  },
  required: ["docType", "amount", "date", "address", "name"],
};

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

  const amountByType = {
    municipalTax: 640,
    electricity: 320,
    water: 145,
    saleContract: 1250000,
    leaseContract: 5200,
    unknown: null,
  };

  return {
    docType,
    amount: amountByType[docType],
    date: new Date().toISOString().slice(0, 10),
    address: "רחוב הדוגמה 12, תל אביב",
    name: "ישראל ישראלי",
  };
}
