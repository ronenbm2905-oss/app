// ============================================================================
// cloudWrites.js — תרגום מוטציה לתוכנית כתיבה ל-Firestore. פונקציות טהורות.
//
// ⚠ **למה זה קובץ נפרד וטהור:** מגבלת ה-500 של `writeBatch` היא בדיוק מהסוג
// שמתגלה בייצור. הייבוא כותב ~3,300 מסמכים; מחיקת בניין נוגעת ב-4 אוספים.
// כאן זה נחתך למנות ונבדק ב-smoke בלי Firebase, בלי רשת ובלי פרויקט.
//
// הפונקציות מחזירות `[{ op, collection, id, data }]` — תיאור, לא ביצוע.
// ה-hook הוא היחיד שמתרגם אותן ל-`setDoc`/`deleteDoc` אמיתיים.
// ============================================================================

import { ENTITY_COLLECTIONS } from "../constants.js";

/** מגבלת Firestore: 500 פעולות ל-batch. עוצרים ב-450 כדי להשאיר אוויר. */
export const BATCH_LIMIT = 450;

/** חיתוך רשימת פעולות למנות שכל אחת חוקית מול Firestore. */
export function chunkOps(ops, limit = BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < ops.length; i += limit) out.push(ops.slice(i, i + limit));
  return out;
}

/**
 * ⚠ Firestore אינו מקבל `undefined` בשום שדה — הכתיבה **נכשלת כולה**, לא
 * מתעלמת מהשדה. `null` מותר ומשמעותי אצלנו (״הוועד משלם ישירות״, ״ללא ספק״),
 * ולכן מסננים רק `undefined` ומשאירים `null` כמות שהוא.
 */
export function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) out[k] = v;
  return out;
}

const setOp = (collection, entity) => ({
  op: "set", collection, id: entity.id, data: stripUndefined(entity),
});

/** עדכון ישות בודדת → merge של השדות שהשתנו בלבד. */
export function planUpdate(collection, id, patch) {
  return [{ op: "merge", collection, id, data: stripUndefined(patch) }];
}

export function planAdd(collection, entity) {
  return [setOp(collection, entity)];
}

/** `applyBatch` — עדכונים ויצירות באוסף אחד. */
export function planApplyBatch(collection, { updates = [], creates = [] }) {
  return [
    ...updates.map((u) => ({ op: "merge", collection, id: u.id, data: stripUndefined(u.patch) })),
    ...creates.map((c) => setOp(collection, c)),
  ];
}

export function planRemove(collection, id) {
  return [{ op: "delete", collection, id }];
}

/** `removeMany` — מחיקה חוצת-אוספים, כמו מחיקת בניין על תלוייו. */
export function planRemoveMany(byCollection) {
  const ops = [];
  for (const [collection, ids] of Object.entries(byCollection || {})) {
    for (const id of ids || []) ops.push({ op: "delete", collection, id });
  }
  return ops;
}

/**
 * `replaceAll` — הייבוא. **מוחק את מה שלא נמצא בקלט החדש** ואז כותב הכל.
 *
 * ⚠ בלי המחיקה, ייבוא של גיליון מעודכן היה **מוסיף** לענן ולא מחליף: בניין
 * שנמחק מהגיליון היה נשאר במערכת לנצח, והסה״כ היה מפסיק להתאים לגיליון —
 * בדיוק הבאג שהמערכת נבנתה כדי למנוע. לכן צריך את המצב הקיים כדי לדעת מה לגרוע.
 */
export function planReplaceAll(nextData, currentData) {
  const ops = [];
  for (const collection of ENTITY_COLLECTIONS) {
    const next = nextData?.[collection] || [];
    const keep = new Set(next.map((x) => x.id));
    for (const old of currentData?.[collection] || []) {
      if (!keep.has(old.id)) ops.push({ op: "delete", collection, id: old.id });
    }
    for (const entity of next) ops.push(setOp(collection, entity));
  }
  return ops;
}
