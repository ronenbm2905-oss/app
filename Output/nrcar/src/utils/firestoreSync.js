// ============================================================================
// firestoreSync.js — מיפוי בין המודל בזיכרון (אובייקט אחד עם מערכים) לבין
// **תת-אוספים** ב-Firestore:
//
//   households/{hid}                         ← מסמך שורש: household+settings
//   households/{hid}/vehicles/{id}
//   households/{hid}/vehiclesPrivate/{id}
//   households/{hid}/drivers/{id}
//   households/{hid}/vehicleAccess/{driverUid}__{vehicleId}
//   households/{hid}/tasks/{id}
//   households/{hid}/documents/{id}
//   households/{hid}/personalDocs/{id}
//   households/{hid}/serviceRecords/{id}
//   households/{hid}/odometerReadings/{id}
//   memberships/{uid}                        ← uid → { householdId, role }
//   users/{uid}                              ← נכתב ע"י הנושא בלבד
//
// **תת-אוספים מהיום הראשון.** ב-property-management המעבר באמצע עלה
// restructure מלא, והסיבה מבנית: על מסמך אחד גדול אי אפשר לבטא "הנהג רואה
// רק את הרכב שהוקצה לו" — וזה בדיוק מה שפרוסה 2 צריכה.
//
// ⚠️ personalDocs נקרא כאן כמו כל אוסף אחר, אבל ה-rules מחזירים לבעלים
// **קבוצה ריקה** (read = נושא המידע בלבד). זה מכוון: המסך מציג "עוד לא כאן"
// ולא שגיאה. אל "תתקנו" את זה בהוספת read לבעלים.
// ============================================================================

import { EMPTY, ENTITY_COLLECTIONS } from "../constants.js";

export { ENTITY_COLLECTIONS };

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// subscribeHousehold — מאזין למסמך השורש + לכל תת-אוסף + לפרופיל המשתמש,
// ומרכיב אובייקט data אחיד. מחזיר Promise ל-unsubscribe (בגלל הייבוא
// הדינמי של firebase/firestore).
export async function subscribeHousehold(db, hid, uid, cb, onError) {
  const { doc, collection, onSnapshot } = await import("firebase/firestore");

  const state = clone(EMPTY);
  const unsubs = [];
  const emit = () => cb(clone(state));

  unsubs.push(
    onSnapshot(
      doc(db, "households", hid),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        state.household = { ...EMPTY.household, ...(d.household || {}), id: hid };
        state.settings = { ...EMPTY.settings, ...(d.settings || {}) };
        state.schemaVersion = d.schemaVersion || EMPTY.schemaVersion;
        emit();
      },
      onError
    )
  );

  // פרופיל המשתמש — users/{uid}. נפרד ממשק הבית: הוא **של הנושא**, לא של
  // הבעלים, וזה מה שמאפשר לקטין שהופך לבגיר לאשר את היידוע בעצמו (N5).
  if (uid) {
    unsubs.push(
      onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          state.profile = snap.exists() ? snap.data() : null;
          emit();
        },
        onError
      )
    );
  }

  for (const c of ENTITY_COLLECTIONS) {
    unsubs.push(
      onSnapshot(
        collection(db, "households", hid, c),
        (qs) => {
          state[c] = qs.docs.map((d) => d.data());
          emit();
        },
        // אוסף שה-rules חוסמים (personalDocs לבעלים) מחזיר שגיאת הרשאה.
        // זה מצב **תקין** ולא כשל טעינה — משאירים מערך ריק וממשיכים.
        (err) => {
          if (err?.code === "permission-denied") {
            state[c] = [];
            emit();
            return;
          }
          onError?.(err);
        }
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}

// writeHouseholdDiff — כותב רק את מה שהשתנה בין prev ל-next, מסמך-מסמך.
// כך אין דריסה של רשומות שלא נגענו בהן, וכל ישות היא יחידת-הרשאה עצמאית.
export async function writeHouseholdDiff(db, hid, prev, next) {
  const { doc, setDoc, deleteDoc } = await import("firebase/firestore");

  const rootChanged =
    JSON.stringify(prev?.settings) !== JSON.stringify(next.settings) ||
    JSON.stringify(prev?.household) !== JSON.stringify(next.household);
  if (rootChanged) {
    await setDoc(
      doc(db, "households", hid),
      {
        household: { ...next.household, id: hid },
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
        await setDoc(doc(db, "households", hid, c, e.id), { ...e, householdId: hid });
      }
    }
    for (const e of prevArr) {
      if (!nextIds.has(e.id)) {
        await deleteDoc(doc(db, "households", hid, c, e.id));
      }
    }
  }
}

// ============================================================================
// ensureHousehold — יצירת מסמך השורש. **N4**: היוצר נרשם במפת ה-members
// כ-'owner'; אין כאן, ולא ב-rules, שום השוואה בין המזהה לבין ה-uid.
// ============================================================================
export async function ensureHousehold(db, hid, uid, name = "") {
  const { doc, getDoc, setDoc } = await import("firebase/firestore");
  const refDoc = doc(db, "households", hid);

  // ============================================================================
  // 🔴 קריאה של מסמך **שאינו קיים** מחזירה `permission-denied`, לא "לא נמצא".
  //
  // כלל ה-read נשען על `members` שבתוך המסמך; כשאין מסמך, אין מפה, והכלל
  // מוערך כשגיאה → דחייה. כלומר `getDoc` **זורק** בדיוק במקרה הנפוץ ביותר:
  // משתמש חדש שנכנס בפעם הראשונה.
  //
  // קודם זה הפיל את כל הבוטסטרפ: ה-catch ב-useData רשם "household bootstrap
  // skipped", משק הבית **לא נוצר**, וכל משתמש ענן חדש היה נתקע במסך שגיאה.
  // התגלה רק בהרצה מול אמולטור — שום סריקה סטטית לא יכולה לתפוס את זה.
  //
  // לכן: דחייה כאן נחשבת "עוד לא קיים", וממשיכים ליצירה. אם המסמך **כן**
  // קיים ופשוט אינו שלנו — ה-`setDoc` ייכשל כ-update, וזה בדיוק מה שצריך
  // לקרות (ולא ליצור בשקט מצב שגוי).
  // ============================================================================
  let snap = null;
  try {
    snap = await getDoc(refDoc);
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
  }
  if (snap?.exists()) return snap.data();

  const payload = {
    household: { id: hid, name, createdAt: new Date().toISOString(), members: { [uid]: "owner" } },
    settings: { ...EMPTY.settings },
    schemaVersion: EMPTY.schemaVersion,
  };
  // ⚠️ בלי merge: זו **יצירה**. merge על מסמך קיים היה דורס את מפת ה-members
  // ומוחק בעלים שני — בדיוק התרחיש ש-N4 נועד לאפשר.
  await setDoc(refDoc, payload);
  return payload;
}

// memberships/{uid} — כדי שמשתמש יגלה לאיזה משק בית הוא שייך בלי לסרוק.
// פרוסה 2: ההזמנה של נהג תיכתב ע"י Cloud Function, לא מהקליינט.
export async function ensureMembership(db, uid, householdId, role = "owner", extra = {}) {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "memberships", uid), { uid, householdId, role, ...extra }, { merge: true });
}

export async function readMembership(db, uid) {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "memberships", uid));
  return snap.exists() ? snap.data() : null;
}

// users/{uid} — נכתב ע"י הנושא בלבד. `notices` הוא append-only (N5), ולכן
// הכתיבה תמיד merge ולעולם לא מחליפה את המערך במערך קצר יותר.
export async function writeUserProfile(db, uid, profile) {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "users", uid), { ...profile, uid }, { merge: true });
}
