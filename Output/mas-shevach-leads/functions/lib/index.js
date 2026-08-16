// src/leadStatus.js
import { onCall } from "firebase-functions/v2/https";

// src/common.js
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHmac } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
if (!getApps().length) initializeApp();
var db = getFirestore();
var REGION = "europe-west1";
var OWNER_EMAILS = (process.env.OWNER_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function assertOwner(request) {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "\u05E0\u05D3\u05E8\u05E9\u05EA \u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA");
  const token = auth.token || {};
  if (token.role === "owner") return auth.uid;
  if (token.email_verified === true && OWNER_EMAILS.includes(String(token.email).toLowerCase())) {
    return auth.uid;
  }
  throw new HttpsError("permission-denied", "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D5\u05E8\u05E9\u05D4");
}
function hashPhone(phone) {
  const secret = process.env.SUPPRESSION_SECRET;
  if (!secret) throw new HttpsError("failed-precondition", "SUPPRESSION_SECRET \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D5\u05D2\u05D3\u05E8");
  return createHmac("sha256", secret).update(String(phone)).digest("hex");
}
async function logOp(actorUid, action, leadId, extra = {}) {
  try {
    await db.collection("opsLog").add({
      actorUid,
      action,
      leadId: leadId ?? null,
      at: FieldValue.serverTimestamp(),
      ...extra
    });
  } catch (err) {
    console.error("[opsLog] \u05DB\u05EA\u05D9\u05D1\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4", err);
  }
}

// ../src/constants.js
var SCHEMA_VERSION = 1;
var LEADS_COLLECTION = "leads";
var SUPPRESSION_COLLECTION = "suppression";
var LEAD_CREATE_FIELDS = [
  "firstName",
  // שם פרטי בלבד. אין שם משפחה.
  "phone",
  // ערוץ הקשר העיקרי
  "email",
  // אופציונלי
  "screened",
  // 🔴 בוליאני **יחיד**. לא ארבע תשובות הבודק.
  "source",
  // ייחוס שיווקי מוגבל — ראה LEAD_SOURCE_FIELDS
  "policyVersion",
  // 🔴 ראיית ההסכמה. שדה עליון — ראה ההערה למטה.
  "createdAt"
  // serverTimestamp בלבד (== request.time ב-rules)
];
var LEAD_SERVER_FIELDS = [
  "status",
  "retentionClass",
  "lastContactAt",
  "contactAttempts",
  "purgeAfter",
  // חושב ע"י השרת; מה שהג'וב המתוזמן סורק
  "purgedAt",
  // חותמת מחיקת ה-PII (הרשומה נשארת כשלד ריק לצורך ספירה)
  "schemaVersion"
];
var LEAD_ALL_FIELDS = [...LEAD_CREATE_FIELDS, ...LEAD_SERVER_FIELDS];
var LEAD_STATUS = {
  NEW: "new",
  // נכנס, טרם נגעו בו
  ATTEMPTED: "attempted",
  // ניסיון יצירת קשר, אין מענה
  CONTACTED: "contacted",
  // נוצר קשר בפועל
  REFUSED: "refused",
  // סירב מפורשות
  CONVERTED: "converted"
  // הפך ללקוח — יוצא מ-leads
};
var LEAD_STATUS_VALUES = Object.values(LEAD_STATUS);
var RETENTION_CLASS = {
  UNANSWERED: "unanswered",
  // 6 חודשים מיצירת הליד
  CONTACTED: "contacted",
  // 12 חודשים מהמגע האחרון
  IMMEDIATE: "immediate"
  // סירוב / המרה — מחיקה מיידית
};
var RETENTION_DAYS = {
  [RETENTION_CLASS.UNANSWERED]: 183,
  // ~6 חודשים
  [RETENTION_CLASS.CONTACTED]: 365,
  // 12 חודשים
  [RETENTION_CLASS.IMMEDIATE]: 0
};
var LEAD_PII_FIELDS = ["firstName", "phone", "email"];

// ../src/utils/retention.js
var DAY_MS = 24 * 60 * 60 * 1e3;
function retentionClassFor(lead) {
  const status = lead?.status ?? LEAD_STATUS.NEW;
  switch (status) {
    case LEAD_STATUS.REFUSED:
    case LEAD_STATUS.CONVERTED:
      return RETENTION_CLASS.IMMEDIATE;
    case LEAD_STATUS.CONTACTED:
      return RETENTION_CLASS.CONTACTED;
    case LEAD_STATUS.ATTEMPTED:
    case LEAD_STATUS.NEW:
    default:
      return RETENTION_CLASS.UNANSWERED;
  }
}
function retentionAnchor(lead) {
  const cls = retentionClassFor(lead);
  if (cls === RETENTION_CLASS.CONTACTED) {
    return toMillis(lead.lastContactAt) ?? toMillis(lead.createdAt);
  }
  return toMillis(lead.createdAt);
}
function purgeAfterMillis(lead) {
  const cls = retentionClassFor(lead);
  const anchor = retentionAnchor(lead);
  if (anchor == null) return null;
  if (cls === RETENTION_CLASS.IMMEDIATE) return anchor;
  return anchor + RETENTION_DAYS[cls] * DAY_MS;
}
function isDueForPurge(lead, now = Date.now()) {
  if (lead?.purgedAt) return false;
  const due = purgeAfterMillis(lead);
  return due != null && due <= now;
}
function toMillis(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.seconds === "number") return v.seconds * 1e3;
  if (typeof v._seconds === "number") return v._seconds * 1e3;
  return null;
}

// src/leadStatus.js
var setLeadStatus = onCall(
  {
    region: REGION,
    // 🔴 R-5 — App Check נאכף גם על הפונקציות, לא רק על Firestore.
    enforceAppCheck: true,
    secrets: ["SUPPRESSION_SECRET"]
  },
  async (request) => {
    const uid = assertOwner(request);
    const { leadId, status } = request.data || {};
    if (typeof leadId !== "string" || !leadId) {
      throw new HttpsError("invalid-argument", "leadId \u05D7\u05E1\u05E8");
    }
    if (!LEAD_STATUS_VALUES.includes(status)) {
      throw new HttpsError("invalid-argument", "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8");
    }
    const ref = db.collection(LEADS_COLLECTION).doc(leadId);
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "\u05D4\u05DC\u05D9\u05D3 \u05D0\u05D9\u05E0\u05D5 \u05E7\u05D9\u05D9\u05DD");
      const lead = snap.data();
      if (lead.purgedAt) {
        throw new HttpsError("failed-precondition", "\u05E4\u05E8\u05D8\u05D9 \u05D4\u05DC\u05D9\u05D3 \u05DB\u05D1\u05E8 \u05E0\u05DE\u05D7\u05E7\u05D5");
      }
      const now = Date.now();
      const update = {
        status,
        schemaVersion: 1
      };
      if (status === LEAD_STATUS.CONTACTED) {
        update.lastContactAt = FieldValue.serverTimestamp();
      }
      if (status === LEAD_STATUS.ATTEMPTED) {
        update.contactAttempts = (lead.contactAttempts ?? 0) + 1;
      }
      const projected = {
        ...lead,
        status,
        contactAttempts: update.contactAttempts ?? lead.contactAttempts ?? 0,
        lastContactAt: status === LEAD_STATUS.CONTACTED ? now : lead.lastContactAt
      };
      update.retentionClass = retentionClassFor(projected);
      const due = purgeAfterMillis(projected);
      update.purgeAfter = due == null ? null : new Date(due);
      let suppressed = false;
      if (status === LEAD_STATUS.REFUSED || status === LEAD_STATUS.CONVERTED) {
        if (status === LEAD_STATUS.REFUSED && lead.phone) {
          const supRef = db.collection(SUPPRESSION_COLLECTION).doc(hashPhone(lead.phone));
          tx.set(supRef, {
            optedOut: true,
            at: FieldValue.serverTimestamp()
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

// src/onCreate.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
var onLeadCreated = onDocumentCreated(
  {
    region: REGION,
    document: `${LEADS_COLLECTION}/{leadId}`,
    secrets: ["SUPPRESSION_SECRET"]
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const lead = snap.data();
    const ref = snap.ref;
    const seeded = {
      ...lead,
      status: LEAD_STATUS.NEW,
      contactAttempts: 0,
      lastContactAt: null
    };
    const due = purgeAfterMillis({ ...seeded, createdAt: Date.now() });
    const update = {
      status: LEAD_STATUS.NEW,
      retentionClass: retentionClassFor(seeded),
      contactAttempts: 0,
      lastContactAt: null,
      purgeAfter: due == null ? null : new Date(due),
      schemaVersion: SCHEMA_VERSION
    };
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
      console.error("[onLeadCreated] \u05D1\u05D3\u05D9\u05E7\u05EA \u05E8\u05E9\u05D9\u05DE\u05EA \u05D3\u05D9\u05DB\u05D5\u05D9 \u05E0\u05DB\u05E9\u05DC\u05D4", err);
    }
    await ref.update(update);
  }
);

// src/retention.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall as onCall2 } from "firebase-functions/v2/https";
var BATCH_LIMIT = 300;
async function runPurge() {
  const now = Date.now();
  const snap = await db.collection(LEADS_COLLECTION).where("purgeAfter", "<=", new Date(now)).limit(BATCH_LIMIT).get();
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
  console.log(`[purge] \u05E0\u05DE\u05D7\u05E7\u05D5 ${purged}, \u05D3\u05D5\u05DC\u05D2\u05D5 ${skipped}, \u05E0\u05E1\u05E8\u05E7\u05D5 ${snap.size}`);
  return { purged, skipped, scanned: snap.size };
}
var purgeExpiredLeads = onSchedule(
  { region: REGION, schedule: "0 3 * * *", timeZone: "Asia/Jerusalem" },
  async () => {
    await runPurge();
  }
);
var purgeExpiredLeadsNow = onCall2(
  { region: REGION, enforceAppCheck: true },
  async (request) => {
    const uid = assertOwner(request);
    const result = await runPurge();
    await logOp(uid, "purge:manual", null, result);
    return result;
  }
);
export {
  onLeadCreated,
  purgeExpiredLeads,
  purgeExpiredLeadsNow,
  setLeadStatus
};
