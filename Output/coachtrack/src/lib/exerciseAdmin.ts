/**
 * CoachTrack — כתיבות על ספריית התרגילים.
 *
 * כולן נוגעות **רק במסמכים שהמאמן המחובר הוא הבעלים שלהם**
 * (`scope: 'coach'`, `coachUid === uid`). הקטלוג הגלובלי הוא לקריאה בלבד:
 * כתיבה אליו מותרת ל-admin בלבד ומגיעה מ-`scripts/seed.js`.
 *
 * זה הלב של הפיצ'ר: מאמן שמתקן תרגיל קטלוג **לא נוגע במסמך הגלובלי** אלא יוצר
 * עותק פרטי. המסמך הגלובלי נקרא בידי כל ארגון במערכת, ועריכה שלו הייתה זליגה
 * חוצת-ארגונים (ראה `firestore.rules` → exercises).
 *
 * אין כאן מחיקה — כלל 5. "חזרה למקור" היא `active: false` על העותק.
 */

import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  buildCoachExercise,
  buildExerciseOverride,
  exerciseUpdateFromForm,
  overrideRevivalFromForm,
} from './exercises';
import type { ExerciseFormValues } from './exercises';
import type { ExerciseDoc } from '../types/types';

/**
 * יוצרת תרגיל חדש של המאמן ומחזירה את המזהה שנוצר.
 *
 * `addDoc` ולא `setDoc` עם מזהה שנגזר מהשם: לתרגילי הקטלוג יש מזהים קריאים
 * (`shoot_form`) כי הם נכתבים בסקריפט seed, אבל מזהה שנגזר משם בעברית שהמאמן
 * הקליד היה שביר — ושינוי שם היה מחייב מסמך חדש.
 */
export async function createCoachExercise(
  values: ExerciseFormValues,
  orgId: string,
  coachUid: string,
): Promise<string> {
  const reference = await addDoc(
    collection(db, 'exercises'),
    buildCoachExercise(values, orgId, coachUid),
  );
  return reference.id;
}

/**
 * שומרת עריכה של תרגיל קטלוג כ**עותק פרטי** — בלי לגעת במקור.
 *
 * `existingCopy` הוא העותק שכבר קיים למאמן עבור אותו מקור, אם יש כזה
 * (`findOverrideFor`). כשהוא קיים מעדכנים אותו במקום ליצור עותק שני — כולל
 * המקרה שבו הוא היה מבוטל, ואז `overrideRevivalFromForm` מחזיר אותו לפעיל.
 *
 * החיפוש נעשה ברשימה שכבר הגיעה מה-`onSnapshot` ולא ב-`getDoc`: `getDoc` על
 * מסמך שאולי אינו קיים נחסם בכללים, ומחזיר PERMISSION_DENIED שנראה כמו תקלה.
 */
export async function saveExerciseOverride(
  source: ExerciseDoc,
  values: ExerciseFormValues,
  orgId: string,
  coachUid: string,
  existingCopy: ExerciseDoc | null,
): Promise<string> {
  if (existingCopy) {
    await updateDoc(doc(db, 'exercises', existingCopy.id), overrideRevivalFromForm(values));
    return existingCopy.id;
  }

  const reference = await addDoc(
    collection(db, 'exercises'),
    buildExerciseOverride(source, values, orgId, coachUid),
  );
  return reference.id;
}

/** עדכון שם, קטגוריה, יחידה, הנחיות והצעת יעד במסמך של המאמן עצמו. */
export async function updateCoachExercise(
  exerciseId: string,
  values: ExerciseFormValues,
): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), exerciseUpdateFromForm(values));
}

/**
 * "חזרה למקור" — **אינה מחיקה**.
 *
 * מסמנת את העותק `active: false`, ומאותו רגע הספרייה מפסיקה להסתיר בעזרתו את
 * תרגיל הקטלוג והמקור חוזר להופיע. העותק נשאר במסד: אם המאמן יערוך שוב, אותו
 * מסמך יחזור לחיים במקום להיווצר מחדש.
 *
 * מקבלת מזהה שנשמר על המסמך שקראנו — לא שאילתה ולא לולאת מחיקה.
 */
export async function revertExerciseOverride(copyId: string): Promise<void> {
  await updateDoc(doc(db, 'exercises', copyId), { active: false });
}

/** השבתה או הפעלה מחדש של תרגיל שהמאמן יצר בעצמו. */
export async function setExerciseActive(exerciseId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), { active });
}
