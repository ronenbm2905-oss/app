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

// ============================================================================
// probeOrg — בדיקה חד-פעמית: האם מסמך הארגון קיים ונגיש לנו.
//
// למה זה קיים בכלל: `isOrgAdmin` ב-rules דורש `exists(orgs/{orgId})`, ולכן
// למשתמש חדש **כל** קריאה תחת הארגון נדחית ב-permission-denied — כולל
// מסמך השורש עצמו. מאזין onSnapshot שנדחה **מסתיים ואינו מנסה שוב**, ולכן
// אסור לפתוח מאזינים לפני שידוע שהארגון קיים; אחרת מקבלים באנר שגיאה קבוע
// שנשאר גם אחרי שה-onboarding יוצר את הארגון (הבאג של 16.8 בפרודקשן).
//
// permission-denied כאן מתורגם ל-"missing" ולא ל-"error": בפרוסה 1
// orgId === uid, ולכן הדחייה פירושה בפועל "עוד אין לי ארגון" — מצב תקין
// וצפוי שהמסך שלו הוא ה-onboarding. אם בכל זאת מדובר במסמך קיים שאיננו
// חברים בו, ניסיון היצירה שאחריו ייכשל ו**זו** תוצג כשגיאה אמיתית.
// שגיאת רשת (unavailable וכו') נשארת שגיאה — לא בולעים הכל.
// ============================================================================
export async function probeOrg(db, orgId) {
  const { doc, getDoc } = await import("firebase/firestore");
  try {
    const snap = await getDoc(doc(db, "orgs", orgId));
    return { state: snap.exists() ? "exists" : "missing", error: null };
  } catch (err) {
    if (err?.code === "permission-denied") return { state: "missing", error: null };
    return { state: "error", error: err };
  }
}

// subscribeOrg — מאזין למסמך השורש + לכל תת-אוסף, ומרכיב אובייקט data אחיד.
// מחזיר Promise ל-unsubscribe (בגלל הייבוא הדינמי של firebase/firestore).
// ⚠️ להפעיל **רק** אחרי ש-probeOrg החזיר "exists" — ראה ההסבר למעלה.
export async function subscribeOrg(db, orgId, cb, onError) {
  const { doc, collection, onSnapshot } = await import("firebase/firestore");

  const state = clone(EMPTY);
  const unsubs = [];
  // מחכים לצילום הראשון של **כל** 14 המאזינים לפני ה-cb הראשון. אחרת
  // ה-UI מקבל 14 עדכונים חלקיים ומהבהב "אין נתונים" בדרך. אחרי הצילום
  // הראשון כל שינוי משדר מיד.
  const pending = new Set(["__root__", ...ENTITY_COLLECTIONS]);
  const emit = (key) => {
    pending.delete(key);
    if (pending.size) return;
    cb(clone(state));
  };

  unsubs.push(
    onSnapshot(
      doc(db, "orgs", orgId),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        state.org = { ...EMPTY.org, ...(d.org || {}), id: orgId };
        state.settings = { ...EMPTY.settings, ...(d.settings || {}) };
        state.schemaVersion = d.schemaVersion || EMPTY.schemaVersion;
        emit("__root__");
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
          emit(c);
        },
        onError
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}

// ============================================================================
// startOrgSync — **הרצף** שקובע מתי מותר להירשם למאזינים:
//   probeOrg → אין ארגון?  onMissing() ואף מאזין לא נפתח (מצב תקין).
//            → יש ארגון?   רשומת השיוך + subscribeOrg.
//            → שגיאה?      onError().
//
// הרצף יושב כאן ולא בתוך ה-hook בכוונה: ככה בדיקת האמולטור מריצה את **אותו
// קוד** שהאפליקציה מריצה, ולא שכפול שלו. הבאג של 16.8 היה בדיוק ברצף הזה,
// ובדיקה ששכפלה אותו לא הייתה תופסת רגרסיה עתידית.
//
// מחזיר תמיד פונקציית ניקוי (no-op כשלא נפתחו מאזינים).
// ============================================================================
export async function startOrgSync(db, orgId, { onMissing, onData, onError } = {}) {
  const noop = () => {};
  const probe = await probeOrg(db, orgId);

  if (probe.state === "error") {
    onError?.(probe.error, "probe");
    return noop;
  }
  if (probe.state === "missing") {
    onMissing?.();
    return noop;
  }

  // הארגון קיים והקריאה עברה ⇒ אנחנו האדמין שלו. רק כאן כותבים את רשומת
  // השיוך; קודם היא נכתבה בכל login — גם למי שאינו אדמין של ארגון, מה
  // שבפרוסה 2 היה דורס את השיוך של נהג.
  ensureMembership(db, orgId, orgId, "admin").catch((err) =>
    console.warn("membership write skipped", err)
  );

  try {
    return await subscribeOrg(db, orgId, (data) => onData?.(data), (err) => onError?.(err, "snapshot"));
  } catch (err) {
    onError?.(err, "subscribe");
    return noop;
  }
}

// writeOrgDiff — כותב רק את מה שהשתנה בין prev ל-next, מסמך-מסמך.
// כך אין דריסה של רשומות שלא נגענו בהן, וכל ישות היא יחידת-הרשאה עצמאית.
//
// options:
//   selfUid   — ה-uid של הכותב. מובטח שהוא יופיע כ-'admin' ב-org.members.
//               בלי זה **יצירת הארגון נדחית**: כלל ה-create דורש
//               `request.resource.data.org.members[request.auth.uid] == 'admin'`,
//               ומפתח חסר במפה מפיל את הערכת הכלל (permission-denied).
//   ensureRoot — לכפות כתיבת מסמך השורש גם אם ה-diff לא זיהה שינוי. נדרש
//               ביצירה: מסמך השורש חייב להיווצר **לפני** תת-האוספים, כי
//               ה-rules שלהם עושים get() עליו.
export async function writeOrgDiff(db, orgId, prev, next, { selfUid = null, ensureRoot = false } = {}) {
  const { doc, setDoc, deleteDoc } = await import("firebase/firestore");

  const rootChanged =
    ensureRoot ||
    JSON.stringify(prev?.settings) !== JSON.stringify(next.settings) ||
    JSON.stringify(prev?.org) !== JSON.stringify(next.org);
  if (rootChanged) {
    const members = { ...(next.org?.members || {}) };
    if (selfUid && members[selfUid] !== "admin") members[selfUid] = "admin";
    await setDoc(
      doc(db, "orgs", orgId),
      {
        org: { ...next.org, id: orgId, members },
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
