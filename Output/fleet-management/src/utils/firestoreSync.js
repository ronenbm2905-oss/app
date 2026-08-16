// ============================================================================
// firestoreSync.js — מיפוי בין המודל בזיכרון (אובייקט אחד עם מערכים) לבין
// **תת-אוספים** ב-Firestore. זו ההחלטה הארכיטקטונית החוסמת של פרוסה 1:
//
//   orgs/{orgId}                          ← מסמך שורש: org + settings + schemaVersion
//   orgs/{orgId}/leaseCompanies/{id}
//   orgs/{orgId}/vehicles/{id}
//   orgs/{orgId}/drivers/{id}
//   orgs/{orgId}/assignments/{id}
//   orgs/{orgId}/fines/{id}
//   orgs/{orgId}/odometerReadings/{id}
//   orgs/{orgId}/serviceRecords/{id}
//   orgs/{orgId}/documents/{id}
//   orgs/{orgId}/incidents/{id}
//   memberships/{uid}                     ← uid → { orgId, role, driverId }
//
// למה לא מסמך יחיד: פורטל הנהג בפרוסה 2 דורש בידוד **ברמת-מסמך** — לתת לנהג
// קריאה על הרכב שלו ועל הקנסות שלו בלבד, בלי לחשוף עלויות ורכבים אחרים.
// זה בלתי ניתן לביטוי ב-rules על מסמך אחד גדול. הלקח מ-property-management,
// שם הרסטרקטורינג נעשה באמצע הדרך ובכאב.
//
// המודל בזיכרון נשאר אובייקט אחד נוח (לתצוגות המצרפות ולמצב המקומי);
// השכבה הזו מתרגמת קריאה↔כתיבה מול תת-האוספים, בכתיבת דלתא פר-מסמך.
// ============================================================================

import { EMPTY, ENTITY_COLLECTIONS } from "../constants.js";

export { ENTITY_COLLECTIONS };

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// subscribeOrg — מאזין למסמך השורש + לכל תת-אוסף, ומרכיב אובייקט data אחיד.
// מחזיר Promise ל-unsubscribe (בגלל הייבוא הדינמי של firebase/firestore).
export async function subscribeOrg(db, orgId, cb, onError) {
  const { doc, collection, onSnapshot } = await import("firebase/firestore");

  const state = clone(EMPTY);
  const unsubs = [];
  const emit = () => cb(clone(state));

  unsubs.push(
    onSnapshot(
      doc(db, "orgs", orgId),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        state.org = { ...EMPTY.org, ...(d.org || {}), id: orgId };
        state.settings = { ...EMPTY.settings, ...(d.settings || {}) };
        state.schemaVersion = d.schemaVersion || EMPTY.schemaVersion;
        emit();
      },
      onError
    )
  );

  for (const c of ENTITY_COLLECTIONS) {
    unsubs.push(
      onSnapshot(
        collection(db, "orgs", orgId, c),
        (qs) => {
          state[c] = qs.docs.map((d) => d.data());
          emit();
        },
        onError
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}

// writeOrgDiff — כותב רק את מה שהשתנה בין prev ל-next, מסמך-מסמך.
// כך אין דריסה של רשומות שלא נגענו בהן, וכל ישות היא יחידת-הרשאה עצמאית.
export async function writeOrgDiff(db, orgId, prev, next) {
  const { doc, setDoc, deleteDoc } = await import("firebase/firestore");

  const rootChanged =
    JSON.stringify(prev?.settings) !== JSON.stringify(next.settings) ||
    JSON.stringify(prev?.org) !== JSON.stringify(next.org);
  if (rootChanged) {
    await setDoc(
      doc(db, "orgs", orgId),
      {
        org: { ...next.org, id: orgId },
        settings: next.settings,
        schemaVersion: next.schemaVersion || 1,
      },
      { merge: true }
    );
  }

  for (const c of ENTITY_COLLECTIONS) {
    const prevArr = prev?.[c] || [];
    const nextArr = next[c] || [];
    const prevById = Object.fromEntries(prevArr.map((e) => [e.id, e]));
    const nextIds = new Set(nextArr.map((e) => e.id));

    for (const e of nextArr) {
      if (JSON.stringify(prevById[e.id]) !== JSON.stringify(e)) {
        await setDoc(doc(db, "orgs", orgId, c, e.id), { ...e, orgId });
      }
    }
    for (const e of prevArr) {
      if (!nextIds.has(e.id)) {
        await deleteDoc(doc(db, "orgs", orgId, c, e.id));
      }
    }
  }
}

// ensureMembership — מסמך ברמת-שורש שמאפשר למשתמש לגלות לאיזה ארגון הוא שייך.
// בפרוסה 1 נכתב רק לאדמין שיוצר את הארגון; בפרוסה 2 האדמין יכתוב אותו גם
// לנהגים שהוא מזמין. קיים כבר עכשיו כדי לא לשנות מבנה בהמשך.
export async function ensureMembership(db, uid, orgId, role = "admin", extra = {}) {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "memberships", uid), { uid, orgId, role, ...extra }, { merge: true });
}

export async function readMembership(db, uid) {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "memberships", uid));
  return snap.exists() ? snap.data() : null;
}
