// ============================================================================
// firestoreSync.js — שכבת מיפוי בין המודל בזיכרון (אובייקט יחיד עם מערכים) לבין
// **תת-אוספים** ב-Firestore. הרסטרקטורינג של פרוסה 2: במקום מסמך יחיד
// owners/{uid} עם כל הפורטפוליו, כל ישות היא מסמך נפרד תחת תת-אוסף:
//
//   owners/{uid}                      ← מסמך שורש: settings + schemaVersion (owner-only)
//   owners/{uid}/properties/{id}
//   owners/{uid}/units/{id}
//   owners/{uid}/tenants/{id}
//   owners/{uid}/leases/{id}
//   owners/{uid}/transactions/{id}
//   owners/{uid}/debts/{id}
//   owners/{uid}/tickets/{id}
//   owners/{uid}/documents/{id}
//   owners/{uid}/reminders/{id}
//
// זה מה שמאפשר בידוד ברמת-מסמך ב-firestore.rules: אפשר לתת ל-tenant הרשאת
// קריאה על מסמך lease/document/ticket ספציפי שלו, בלי לחשוף את שאר הפורטפוליו.
// המודל בזיכרון נשאר אובייקט אחד נוח (לתצוגות המצרפות של הבעלים ולמצב המקומי);
// השכבה הזו מתרגמת קריאה↔כתיבה מול תת-האוספים.
// ============================================================================

import { EMPTY } from "../constants.js";

// כל תת-האוספים (המערכים במודל). settings יושב על מסמך השורש.
export const ENTITY_COLLECTIONS = [
  "properties",
  "units",
  "tenants",
  "leases",
  "transactions",
  "debts",
  "tickets",
  "documents",
  "reminders",
];

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// subscribeOwner — מאזין למסמך השורש + לכל תת-אוסף, ומרכיב אובייקט data אחיד.
// מחזיר Promise ל-unsubscribe (עקב הייבוא הדינמי של firebase/firestore).
export async function subscribeOwner(db, uid, cb, onError) {
  const { doc, collection, onSnapshot } = await import("firebase/firestore");

  const state = clone(EMPTY);
  const ready = new Set();
  const totalSources = ENTITY_COLLECTIONS.length + 1; // +1 למסמך השורש
  const unsubs = [];

  const emit = () => cb(clone(state));
  const markReady = (key) => {
    ready.add(key);
    if (ready.size >= totalSources) emit();
    else emit(); // פליטה מוקדמת גם על מקורות חלקיים — ה-UI מתמלא בהדרגה
  };

  // מסמך שורש: settings + schemaVersion
  unsubs.push(
    onSnapshot(
      doc(db, "owners", uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        state.settings = { ...EMPTY.settings, ...(d.settings || {}) };
        state.schemaVersion = d.schemaVersion || EMPTY.schemaVersion;
        markReady("root");
      },
      onError
    )
  );

  // כל תת-אוסף
  for (const c of ENTITY_COLLECTIONS) {
    unsubs.push(
      onSnapshot(
        collection(db, "owners", uid, c),
        (qs) => {
          state[c] = qs.docs.map((d) => d.data());
          markReady(c);
        },
        onError
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}

// writeOwnerDiff — כותב את השינויים בין prev ל-next כמסמכים בודדים בתת-אוספים.
// כותב רק מה שהשתנה (setDoc), ומוחק ישויות שהוסרו (deleteDoc). settings → מסמך השורש.
export async function writeOwnerDiff(db, uid, prev, next) {
  const { doc, setDoc, deleteDoc } = await import("firebase/firestore");

  // מסמך שורש — settings (merge כדי לא לדרוס תת-אוספים)
  if (JSON.stringify(prev?.settings) !== JSON.stringify(next.settings)) {
    await setDoc(
      doc(db, "owners", uid),
      { settings: next.settings, schemaVersion: next.schemaVersion || 1 },
      { merge: true }
    );
  }

  for (const c of ENTITY_COLLECTIONS) {
    const prevArr = prev?.[c] || [];
    const nextArr = next[c] || [];
    const prevById = Object.fromEntries(prevArr.map((e) => [e.id, e]));
    const nextIds = new Set(nextArr.map((e) => e.id));

    // הוספה/עדכון של מה שהשתנה
    for (const e of nextArr) {
      if (JSON.stringify(prevById[e.id]) !== JSON.stringify(e)) {
        await setDoc(doc(db, "owners", uid, c, e.id), e);
      }
    }
    // מחיקה של מה שהוסר
    for (const e of prevArr) {
      if (!nextIds.has(e.id)) {
        await deleteDoc(doc(db, "owners", uid, c, e.id));
      }
    }
  }
}
