/**
 * CoachTrack — חישובי אחוזי השלמה
 *
 * פונקציות טהורות בלבד: אין כאן קריאה ל-Firestore, אין תאריכים ואין `Date.now()`.
 * זה המקום היחיד שבו אחוז מחושב (CLAUDE.md → מוסכמות קוד).
 *
 * הכלל שקל לטעות בו (מלכודת #3 ב-TASKS.md):
 *   • אחוז לתרגיל בודד — **לא נחסם**. שחקן שזרק 900 מתוך 300 יראה 300%.
 *   • אחוז כללי לשבוע — **כל תרגיל נחסם ב-100 לפני הממוצע**, כדי ש-300% בזריקות
 *     לא יכסה על 0% בכושר.
 */

/** כל אובייקט שיש לו כמות. `Entry` מקיים אותו, וכך גם ערך בדיקה מינימלי. */
export interface CountableEntry {
  amount: number;
  /** דיווח שנמחק-רכות לא נספר. שדה אופציונלי כדי שאפשר יהיה להעביר גם ערך חלקי. */
  deleted?: boolean;
}

/** כל אובייקט שיש לו תרגיל ויעד. `PlanItem` מקיים אותו. */
export interface TargetedItem {
  exerciseId: string;
  target: number;
}

/** מיפוי מזהה-תרגיל לדיווחים שלו. `overallPct` מקבל אותו. */
export type EntriesByExercise = Readonly<Record<string, readonly CountableEntry[] | undefined>>;

/** האחוז שמעליו לא סופרים בממוצע הכללי. */
export const OVERALL_PCT_CAP = 100;

/**
 * סכום הכמויות שנספרות בפועל.
 *
 * מסונן: דיווחים שנמחקו-רכות (`deleted: true`), וכמויות שאינן מספר סופי חיובי.
 * הכלל ב-`firestore.rules` כבר דורש `amount > 0`, אבל נתון פגום מהיסטוריה
 * לא אמור להפוך אחוז ל-`NaN` על המסך של ילד בן 13.
 */
export function sumEntries(entries: readonly CountableEntry[] | undefined | null): number {
  if (!entries) return 0;

  let total = 0;
  for (const entry of entries) {
    if (!entry || entry.deleted === true) continue;
    const amount = entry.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue;
    total += amount;
  }
  return total;
}

/**
 * אחוז ההשלמה של תרגיל בודד. **לא נחסם ב-100** — זו התצוגה בכרטיס התרגיל.
 *
 * `target` שאינו חיובי מחזיר 0: אין יעד, אין מה להשלים. זו הגנה בלבד —
 * מסך בניית התוכנית (שלב 3) לא יאפשר יעד 0 — והיא מונעת `Infinity` ו-`NaN`.
 */
export function pctForExercise(
  entries: readonly CountableEntry[] | undefined | null,
  target: number,
): number {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return 0;
  return (sumEntries(entries) / target) * 100;
}

/** חוסם אחוז לטווח שנספר בממוצע הכללי. */
export function capPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(pct, OVERALL_PCT_CAP);
}

/**
 * האחוז הכללי לשבוע — ממוצע פשוט על כל פריטי התוכנית, כשכל פריט נחסם ב-100 קודם.
 *
 * • תוכנית בלי פריטים מחזירה 0 (ולא `NaN` מחלוקה באפס).
 * • תרגיל שאין לו אף דיווח נספר כ-0 ולא מושמט — אחרת שחקן שדיווח על תרגיל אחד
 *   מתוך חמישה היה מקבל 100%.
 */
export function overallPct(
  items: readonly TargetedItem[] | undefined | null,
  entriesByExercise: EntriesByExercise | undefined | null,
): number {
  if (!items || items.length === 0) return 0;

  let sum = 0;
  for (const item of items) {
    const entries = entriesByExercise ? entriesByExercise[item.exerciseId] : undefined;
    sum += capPct(pctForExercise(entries, item.target));
  }
  return sum / items.length;
}

/**
 * מקבץ רשימת דיווחים שטוחה לפי תרגיל — הצורה ש-`overallPct` מצפה לה.
 * דיווחים שנמחקו-רכות נשמרים בקיבוץ; הסינון קורה ב-`sumEntries`,
 * כדי שמסך היסטוריה יוכל להציג אותם אם ירצה.
 */
export function groupEntriesByExercise<T extends CountableEntry & { exerciseId: string }>(
  entries: readonly T[] | undefined | null,
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  if (!entries) return grouped;

  for (const entry of entries) {
    if (!entry) continue;
    const bucket = grouped[entry.exerciseId];
    if (bucket) bucket.push(entry);
    else grouped[entry.exerciseId] = [entry];
  }
  return grouped;
}

/**
 * דרגת האחוז — הסף שקובע את הצבע על המסך.
 *
 * הספים מגיעים מ-PRD §7.3א (אדום < 50, כתום 50–79, ירוק ≥ 80) והם **החלטת
 * מוצר, לא עיצוב**: אותה דרגה בדיוק צובעת את מטריצת המאמן בשלב 5 ואת כרטיס
 * התרגיל של השחקן. לכן היא יושבת כאן, עם טסטים, ולא בתוך קומפוננטה.
 *
 * מיפוי דרגה→צבע נשאר בקומפוננטה — זה כן עיצוב.
 */
export type PctTone = 'low' | 'mid' | 'high';

export function pctTone(pct: number): PctTone {
  if (!Number.isFinite(pct) || pct < 50) return 'low';
  if (pct < 80) return 'mid';
  return 'high';
}

/** אחוז מעוגל להצגה. העיגול הוא בתצוגה בלבד — החישוב עצמו נשאר מדויק. */
export function roundPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(pct);
}

/**
 * האם השבוע נחשב "רצף התמדה" — מעל הסף שמוגדר ב-`teams.settings.streakThreshold`.
 * החישוב כאן, ליד שאר האחוזים; השימוש יגיע במסך ההיסטוריה (שלב 4).
 */
export function meetsStreakThreshold(overall: number, threshold: number): boolean {
  if (!Number.isFinite(overall) || !Number.isFinite(threshold)) return false;
  return overall >= threshold;
}
