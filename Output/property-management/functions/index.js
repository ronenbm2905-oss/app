// ============================================================================
// Cloud Function — חילוץ פרטי מסמך ב-Claude (צד שרת בלבד).
// המפתח ANTHROPIC_API_KEY יושב כ-secret ב-Firebase, לעולם לא בקליינט/ב-git.
//
// קלט (onCall, מהאפליקציה): { base64, mediaType, fileName }
//   - PDF  → block מסוג document (base64) לפני ה-text block.
//   - תמונה → block מסוג image.
// פלט: { docType, amount, date, address, name } (structured output, JSON תקין).
//
// פרטיות (שער עדי): הפונקציה מקבלת PII ושולחת ל-Anthropic. deploy חסום עד סקירת
// עדי (ראה README). opt-in פר-מסמך נאכף בקליינט; כאן מאמתים משתמש מחובר בלבד.
// ============================================================================
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import { CONFIG, EXTRACTION_SCHEMA } from "./config.js";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const PROMPT =
  "חלץ מהמסמך המצורף את השדות הבאים בלבד והחזר אותם לפי הסכימה: " +
  "docType (סוג המסמך), amount (סכום מספרי אם קיים, אחרת null), " +
  "date (תאריך בפורמט YYYY-MM-DD אם קיים, אחרת null), address (כתובת הנכס), " +
  "name (שם בעל החשבון/הצדדים). אל תמציא ערכים — אם שדה חסר החזר מחרוזת ריקה או null.";

export const extractDocument = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "me-west1", cors: true },
  async (request) => {
    // מאמתים משתמש מחובר (הבידוד המלא — ב-firestore.rules; כאן שער בסיסי).
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const { base64, mediaType, fileName } = request.data || {};
    if (!base64 || !mediaType) {
      throw new HttpsError("invalid-argument", "Missing document data.");
    }

    // block המסמך: PDF כ-document, אחרת image.
    const isPdf = mediaType === "application/pdf";
    const docBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let message;
    try {
      message = await client.messages.create({
        model: CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        // opus-5: adaptive thinking (הצורה `{type:"enabled",budget_tokens}` נדחית ב-400).
        thinking: { type: "adaptive" },
        // effort נכנס ל-output_config (לא ל-thinking), לצד ה-structured output.
        output_config: {
          effort: CONFIG.THINKING_EFFORT,
          format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [docBlock, { type: "text", text: PROMPT }],
          },
        ],
      });
    } catch (err) {
      console.error("Anthropic call failed", err);
      throw new HttpsError("internal", "Extraction failed.");
    }

    // בדיקת סירוב לפני קריאת התוכן.
    if (message.stop_reason === "refusal") {
      throw new HttpsError("cancelled", "Model refused the request.");
    }

    // שליפת הפלט המובנה: מאתרים את בלוק הטקסט ומפרסרים JSON.
    const textBlock = (message.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      throw new HttpsError("internal", "No structured output returned.");
    }
    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new HttpsError("internal", "Could not parse structured output.");
    }
    return parsed;
  }
);
