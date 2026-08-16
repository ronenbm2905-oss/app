// ============================================================================
// purgeExpiredLeads — הג'וב שהופך את מדיניות השמירה למנגנון.
//
// עדי S8(3): "המחיקה היא ג'וב מתוזמן, לא משפט במדיניות. מדיניות שאומרת
// '12 חודשים' ומאגר שמכיל לידים מ-2026 היא **הצהרה כוזבת** על אמצעי הגנה —
// בדיוק הכשל שחסמתי ב-NRCAR (סעיף המצג)."
//
// המדרג (S8): לא נענה → 6 חודשים מהיצירה · נוצר קשר → 12 חודשים מהמגע
// האחרון · סירב/הומר → מיידי. הלוגיקה עצמה יושבת ב-`src/utils/retention.js`
// ונבדקת ב-`npm run smoke` — כאן רק ההרצה.
// ============================================================================

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, REGION, assertOwner, logOp } from "./common.js";
import { LEAD_PII_FIELDS, LEADS_COLLECTION } from "../../src/constants.js";
import { isDueForPurge } from "../../src/utils/retention.js";

const BATCH_LIMIT = 300;

async function runPurge() {
  const now = Date.now();

  // סורק לפי `purgeAfter` (אינדקס קיים ב-firestore.indexes.json).
  // ⚠️ הסינון החוזר ב-`isDueForPurge` אינו מיותר: `purgeAfter` הוא ערך
  //    מחושב שנשמר, ואם ג'וב קודם נכשל באמצע או ששדה לא עודכן — הבדיקה
  //    הטהורה על המסמך עצמו היא מקור האמת, לא השדה שנשמר.
  const snap = await db
    .collection(LEADS_COLLECTION)
    .where("purgeAfter", "<=", new Date(now))
    .limit(BATCH_LIMIT)
    .get();

  let purged = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const lead = doc.data();
    if (lead.purgedAt) {
      skipped++;
      continue;
    }
    if (!isDueForPurge({ ...lead, id: doc.id }, now)) {
      skipped++;
      continue;
    }

    const update = { purgedAt: FieldValue.serverTimestamp(), purgeAfter: null };
    for (const f of LEAD_PII_FIELDS) update[f] = FieldValue.delete();
    await doc.ref.update(update);
    purged++;
  }

  console.log(`[purge] נמחקו ${purged}, דולגו ${skipped}, נסרקו ${snap.size}`);
  return { purged, skipped, scanned: snap.size };
}

// רץ כל יום ב-03:00 שעון ישראל.
export const purgeExpiredLeads = onSchedule(
  { region: REGION, schedule: "0 3 * * *", timeZone: "Asia/Jerusalem" },
  async () => {
    await runPurge();
  }
);

/**
 * הרצה ידנית — כדי שאפשר יהיה **להוכיח** שהמנגנון עובד ביום ההקמה, במקום
 * לחכות 6 חודשים ולגלות שהוא לא. בעלים בלבד.
 */
export const purgeExpiredLeadsNow = onCall(
  { region: REGION, enforceAppCheck: true },
  async (request) => {
    const uid = assertOwner(request);
    const result = await runPurge();
    await logOp(uid, "purge:manual", null, result);
    return result;
  }
);
