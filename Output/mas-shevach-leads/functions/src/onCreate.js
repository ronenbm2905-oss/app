// ============================================================================
// onLeadCreated — מה שקורה ברגע שליד נכתב.
//
// שלוש משימות, וכולן שרת-בלבד בכוונה: הקליינט אינו יכול לכתוב את השדות
// האלה (הם אינם ב-allowlist של R-2), ולכן אינו יכול לזייף אותם.
// ============================================================================

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, FieldValue, REGION, hashPhone } from "./common.js";
import { retentionClassFor, purgeAfterMillis } from "../../src/utils/retention.js";
import {
  LEAD_STATUS,
  LEADS_COLLECTION,
  SUPPRESSION_COLLECTION,
  SCHEMA_VERSION,
} from "../../src/constants.js";

export const onLeadCreated = onDocumentCreated(
  {
    region: REGION,
    document: `${LEADS_COLLECTION}/{leadId}`,
    secrets: ["SUPPRESSION_SECRET"],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const lead = snap.data();
    const ref = snap.ref;

    // 1. שעון השמירה מתחיל לרוץ מיד. `purgeAfter` הוא מה שהג'וב היומי סורק,
    //    ו-`status: new` הוא מה שהקונסולה מציגה.
    const seeded = {
      ...lead,
      status: LEAD_STATUS.NEW,
      contactAttempts: 0,
      lastContactAt: null,
    };
    const due = purgeAfterMillis({ ...seeded, createdAt: Date.now() });

    const update = {
      status: LEAD_STATUS.NEW,
      retentionClass: retentionClassFor(seeded),
      contactAttempts: 0,
      lastContactAt: null,
      purgeAfter: due == null ? null : new Date(due),
      schemaVersion: SCHEMA_VERSION,
    };

    // 2. בדיקת רשימת הדיכוי. מי שסירב בעבר ומילא שוב את הטופס — לא הופך
    //    לליד פעיל. הבדיקה חייבת להיות כאן ולא בקליינט: לקליינט אין (ובצדק)
    //    שום גישת קריאה לרשימת הדיכוי.
    try {
      if (lead.phone) {
        const sup = await db.collection(SUPPRESSION_COLLECTION).doc(hashPhone(lead.phone)).get();
        if (sup.exists) {
          update.status = LEAD_STATUS.REFUSED;
          update.firstName = FieldValue.delete();
          update.phone = FieldValue.delete();
          update.email = FieldValue.delete();
          update.purgedAt = FieldValue.serverTimestamp();
          update.purgeAfter = null;
        }
      }
    } catch (err) {
      // כישלון בבדיקת הדיכוי לא מפיל את יצירת הליד — אבל הוא רועש בלוג,
      // כי המשמעות היא שמישהו שסירב עלול לקבל שיחה.
      console.error("[onLeadCreated] בדיקת רשימת דיכוי נכשלה", err);
    }

    // 🔴 M4 — כאן ישב רישום לאוסף הדיוור. **הוסר לגמרי** (שער עדי, סבב 3).
    //    ההנמקה המלאה ב-`src/constants.js`, ליד `marketingOptIn`
    //    ב-FORBIDDEN_FIELDS. בקצרה: הסכמה חלקית שאי אפשר לממש או לחזור
    //    ממנה גרועה מאי-איסוף, כי היא יוצרת מצג של הסכמה.

    await ref.update(update);
  }
);
