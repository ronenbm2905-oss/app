// ============================================================================
// setLeadStatus — הדרך **היחידה** לשנות ליד. callable, בעלים בלבד.
// ============================================================================

import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, HttpsError, REGION, assertOwner, hashPhone, logOp } from "./common.js";
import {
  LEAD_STATUS,
  LEAD_STATUS_VALUES,
  LEAD_PII_FIELDS,
  LEADS_COLLECTION,
  SUPPRESSION_COLLECTION,
} from "../../src/constants.js";
import { retentionClassFor, purgeAfterMillis } from "../../src/utils/retention.js";

export const setLeadStatus = onCall(
  {
    region: REGION,
    // 🔴 R-5 — App Check נאכף גם על הפונקציות, לא רק על Firestore.
    enforceAppCheck: true,
    secrets: ["SUPPRESSION_SECRET"],
  },
  async (request) => {
    const uid = assertOwner(request);

    const { leadId, status } = request.data || {};
    if (typeof leadId !== "string" || !leadId) {
      throw new HttpsError("invalid-argument", "leadId חסר");
    }
    if (!LEAD_STATUS_VALUES.includes(status)) {
      throw new HttpsError("invalid-argument", "סטטוס לא מוכר");
    }

    const ref = db.collection(LEADS_COLLECTION).doc(leadId);

    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "הליד אינו קיים");
      const lead = snap.data();

      if (lead.purgedAt) {
        // ליד שנמחק כבר לא משנה סטטוס — אין למה להחיל אותו.
        throw new HttpsError("failed-precondition", "פרטי הליד כבר נמחקו");
      }

      const now = Date.now();
      const update = {
        status,
        schemaVersion: 1,
      };

      if (status === LEAD_STATUS.CONTACTED) {
        update.lastContactAt = FieldValue.serverTimestamp();
      }
      if (status === LEAD_STATUS.ATTEMPTED) {
        update.contactAttempts = (lead.contactAttempts ?? 0) + 1;
      }

      // מחשבים את מחלקת השמירה ואת מועד המחיקה על המצב **שאחרי** העדכון,
      // מאותו קוד טהור שהקונסולה מציגה ממנו — src/utils/retention.js.
      const projected = {
        ...lead,
        status,
        contactAttempts: update.contactAttempts ?? lead.contactAttempts ?? 0,
        lastContactAt: status === LEAD_STATUS.CONTACTED ? now : lead.lastContactAt,
      };
      update.retentionClass = retentionClassFor(projected);
      const due = purgeAfterMillis(projected);
      update.purgeAfter = due == null ? null : new Date(due);

      // ----------------------------------------------------------------
      // סירוב והמרה — מחיקת PII **מיידית** (עדי S8).
      //
      // סירוב: נשארת רשומת דיכוי מינימלית. "מחיקה מלאה של מסרב היא הזמנה
      //   לפנות אליו שוב" (S8(4)) — ולכן משהו חייב להישאר, אבל לא הוא.
      // המרה: הליד יוצא מ-`leads` ועובר למערכת התיקים; חובות ניהול פנקסים
      //   חלות שם ולא כאן (S8, "leads הוא מאגר-ביניים").
      // ----------------------------------------------------------------
      let suppressed = false;
      if (status === LEAD_STATUS.REFUSED || status === LEAD_STATUS.CONVERTED) {
        if (status === LEAD_STATUS.REFUSED && lead.phone) {
          const supRef = db.collection(SUPPRESSION_COLLECTION).doc(hashPhone(lead.phone));
          tx.set(supRef, {
            optedOut: true,
            at: FieldValue.serverTimestamp(),
            // 🔴 בלי שם, בלי טלפון גולמי, בלי מקור, בלי הקשר.
          });
          suppressed = true;
        }
        for (const f of LEAD_PII_FIELDS) update[f] = FieldValue.delete();
        update.purgedAt = FieldValue.serverTimestamp();
      }

      tx.update(ref, update);
      return { purged: Boolean(update.purgedAt), suppressed };
    });

    await logOp(uid, `status:${status}`, leadId, outcome);
    return { ok: true, ...outcome };
  }
);
