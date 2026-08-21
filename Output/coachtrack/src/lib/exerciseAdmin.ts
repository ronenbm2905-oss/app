/**
 * CoachTrack — כתיבות על ספריית התרגילים.
 *
 * שלושתן נוגעות **רק בתרגילים של הארגון** (`scope: 'org'`). הקטלוג הגלובלי הוא
 * לקריאה בלבד למאמן; כתיבה אליו מותרת ל-admin בלבד, ומגיעה מ-`scripts/seed.js`.
 *
 * אין כאן מחיקה — כלל 5. תרגיל שנוצר בטעות מסומן `active: false`.
 */

import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { buildOrgExercise, exerciseUpdateFromForm } from './exercises';
import type { ExerciseFormValues } from './exercises';

/**
 * יוצרת תרגיל של הארגון ומחזירה את המזהה שנוצר.
 *
 * `addDoc` ולא `setDoc` עם מזהה שנגזר מהשם: לתרגילי הקטלוג יש מזהים קריאים
 * (`shoot_form`) כי הם נכתבים בסקריפט seed, אבל מזהה שנגזר משם בעברית שהמאמן
 * הקליד היה שביר — ושינוי שם היה מחייב מסמך חדש.
 */
export async function createOrgExercise(
  values: ExerciseFormValues,
  orgId: string,
): Promise<string> {
  const reference = await addDoc(collection(db, 'exercises'), buildOrgExercise(values, orgId));
  return reference.id;
}

/** עדכון שם, קטגוריה, יחידה, הנחיות והצעת יעד. `scope` ו-`orgId` לא נשלחים בכלל. */
export async function updateOrgExercise(
  exerciseId: string,
  values: ExerciseFormValues,
): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), exerciseUpdateFromForm(values));
}

/** השבתה או הפעלה מחדש של תרגיל של הארגון. */
export async function setExerciseActive(exerciseId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), { active });
}
