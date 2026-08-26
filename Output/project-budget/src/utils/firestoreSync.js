// ============================================================================
// firestoreSync.js — מיפוי בין המודל בזיכרון (אובייקט אחד עם מערכים) לבין
// המבנה בענן:
//
//   projects/{pid}                       ← מסמך הפרויקט + memberRoles/memberEmails
//   projects/{pid}/boqItems/{id}
//   projects/{pid}/costLines/{id}
//   projects/{pid}/vendors/{id}
//   projects/{pid}/invoices/{id}
//   projects/{pid}/payments/{id}
//   projects/{pid}/claimBatches/{id}
//   projects/{pid}/fundingEvents/{id}
//   projects/{pid}/documents/{id}
//
// למה תת-אוספים ולא מסמך אחד: מסמך Firestore מוגבל ל-1MB, ו-91 סעיפי כתב
// כמויות + חשבוניות מצטברות עוברים אותו. חשוב מזה — אי אפשר לבטא הרשאה
// פרטנית ("חברת הניהול כותבת חשבוניות אך לא תקציב") על מסמך יחיד.
//
// הכתיבה היא **דלתא**: רק מה שהשתנה נשלח, אחרת כל הקלדה הייתה כותבת מחדש
// את כל הפרויקט וגם דורסת שינויים של משתמש אחר שעבד במקביל.
// ============================================================================

import { ENTITY_COLLECTIONS } from "../constants.js";
import { memberEmailsOf } from "./access.js";

/** שדות שלא נשמרים על מסמך הפרויקט (הם חיים בתת-אוספים או מקומיים בלבד). */
const PROJECT_OMIT = new Set([...ENTITY_COLLECTIONS, "projects", "settings", "_import"]);

const projectPayload = (project) => {
  const out = {};
  for (const [k, v] of Object.entries(project)) {
    if (PROJECT_OMIT.has(k) || v === undefined) continue;
    out[k] = v;
  }
  // הרשימה שהשאילתה מסתמכת עליה נגזרת תמיד ממפת התפקידים — לעולם לא נערכת
  // בנפרד, כדי ששתיהן לא ייפרדו (הכללים דוחים חוסר-עקביות ביניהן).
  out.memberEmails = memberEmailsOf(project);
  return out;
};

/**
 * מאזין לפרויקט אחד ולכל תת-האוספים שלו.
 * @returns unsubscribe
 */
export async function subscribeProject(db, projectId, onData, onError) {
  const { doc, collection, onSnapshot } = await import("firebase/firestore");

  const state = { project: null, collections: {} };
  for (const c of ENTITY_COLLECTIONS) state.collections[c] = [];
  let ready = false;

  const emit = () => {
    if (!ready || !state.project) return;
    onData({
      projects: [state.project],
      ...Object.fromEntries(ENTITY_COLLECTIONS.map((c) => [c, state.collections[c]])),
    });
  };

  const unsubs = [];

  unsubs.push(
    onSnapshot(
      doc(db, "projects", projectId),
      (snap) => {
        state.project = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        emit();
      },
      onError,
    ),
  );

  for (const c of ENTITY_COLLECTIONS) {
    unsubs.push(
      onSnapshot(
        collection(db, "projects", projectId, c),
        (snap) => {
          state.collections[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          emit();
        },
        onError,
      ),
    );
  }

  ready = true;
  emit();
  return () => unsubs.forEach((u) => u());
}

/** הפרויקטים שהמשתמש חבר בהם. השאילתה **חייבת** לשאת את ה-array-contains — */
/** בלעדיו הכללים חוסמים אותה, וזו ההתנהגות הרצויה (כללים אינם מסננים). */
export async function listMyProjects(db, email) {
  const { collection, getDocs, query, where } = await import("firebase/firestore");
  const snap = await getDocs(
    query(collection(db, "projects"), where("memberEmails", "array-contains", String(email).toLowerCase())),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveProject(db, project) {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "projects", project.id), projectPayload(project), { merge: true });
}

/** השוואה רדודה מספיקה: כל הישויות הן אובייקטים שטוחים עם ערכים פרימיטיביים
 *  או מערכים קטנים, ו-JSON.stringify עליהן יציב כי ה-factories בונות אותן
 *  תמיד באותו סדר מפתחות. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * כותב רק את ההפרש בין שני מצבים. מחזיר את מספר הכתיבות שבוצעו — שימושי
 * לאימות שהשמירה באמת חסכונית ולא כותבת הכול בכל הקלדה.
 */
export async function writeProjectDiff(db, projectId, prev, next) {
  const { doc, writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  let writes = 0;

  for (const c of ENTITY_COLLECTIONS) {
    const before = new Map((prev?.[c] || []).map((x) => [x.id, x]));
    const after = new Map((next?.[c] || []).map((x) => [x.id, x]));

    for (const [id, row] of after) {
      if (!same(before.get(id), row)) {
        batch.set(doc(db, "projects", projectId, c, id), row);
        writes++;
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) {
        batch.delete(doc(db, "projects", projectId, c, id));
        writes++;
      }
    }
  }

  const prevProject = (prev?.projects || []).find((p) => p.id === projectId);
  const nextProject = (next?.projects || []).find((p) => p.id === projectId);
  if (nextProject && !same(projectPayload(prevProject || {}), projectPayload(nextProject))) {
    batch.set(doc(db, "projects", projectId), projectPayload(nextProject), { merge: true });
    writes++;
  }

  if (writes) await batch.commit();
  return writes;
}
