/**
 * CoachTrack — הלוגיקה הטהורה של ספריית התרגילים.
 *
 * ## מה המאמן רואה
 *
 * הספרייה היא **איחוד של שני מקורות**: הקטלוג הגלובלי (30 תרגילים,
 * `scope: 'global'`) והתרגילים של המאמן עצמו (`scope: 'coach'`,
 * `coachUid === uid`). המיזוג נעשה כאן, בצד הלקוח, כי הוא חייב להיעשות בצד
 * הלקוח — ראה `hooks/useExerciseLibrary.ts`.
 *
 * ## עותק פרטי במקום הסרת נעילה (25.8.2026)
 *
 * מאמן רוצה לתקן תרגיל קטלוג לעצמו. **אסור** לתת לו לערוך את המסמך הגלובלי:
 * תרגיל `scope: 'global'` נקרא בידי כל מחובר בכל ארגון, ועריכה שלו הייתה מופיעה
 * מיד בספרייה של כל אגודה אחרת — הזליגה החוצת-ארגונים שנחסמה בסקירת עדי.
 *
 * הפתרון: העריכה יוצרת **עותק פרטי** של המאמן, עם `sourceExerciseId` שמצביע על
 * המקור. הספרייה מציגה את העותק **במקום** המקור — עדיין 30 תרגילים, לא 60 —
 * עם תג "נערך" וכפתור "חזרה למקור". הגלובלי עצמו לא משתנה בכהוא זה.
 *
 * ## הביטול אינו מחיקה
 *
 * "חזרה למקור" מסמנת את העותק `active: false` (כלל 5: `allow delete: if false`).
 * ומכאן הדבר הכי קל לפספס בקובץ הזה: **רק עותק פעיל מסתיר את המקור**. עותק
 * מבוטל שממשיך להסתיר היה מעלים את התרגיל לגמרי — לא המקור ולא העותק. ראה
 * `buildExerciseLibrary` והטסטים שנצמדים לזה.
 *
 * ## למה כל תרגיל חדש הוא של המאמן ולא של הארגון
 *
 * אם העריכה פרטית והיצירה משותפת, שני מאמנים היו חולקים תרגיל שאף אחד מהם לא
 * יכול לתקן לעצמו — בדיוק ההתנגשות שהפיצ'ר הזה בא לפתור, רק דרך דלת אחרת.
 * `scope: 'org'` נשאר בסכמה ובכללים (admin בלבד), אבל האפליקציה לא מייצרת
 * אותו. במסד היו 0 תרגילי org ברגע השינוי, ולכן אין מיגרציה.
 */

import type { TranslationKey } from '../i18n/he';
import type { Exercise, ExerciseDoc, Unit } from '../types/types';

/** ארבע יחידות המדידה המותרות. אותו סדר שבו הן מוצגות בטופס. */
export const UNITS: readonly Unit[] = ['count', 'minutes', 'sessions', 'distance_km'];

/** שכבת הגיל היחידה ב-MVP — המפתח שבו נשמרת הצעת היעד. */
const MVP_COHORT = 'cadets_13_15';

export const EXERCISE_NAME_MAX_LENGTH = 60;
export const EXERCISE_DESCRIPTION_MAX_LENGTH = 600;

/**
 * מה הכרטיס בספרייה מייצג. קובע אילו כפתורים מוצגים עליו.
 *
 * - `catalog` — תרגיל קטלוג שהמאמן לא נגע בו. עריכה תיצור עותק.
 * - `edited` — העותק הפרטי של המאמן, מוצג במקום המקור. תג "נערך" + "חזרה למקור".
 * - `mine` — תרגיל שהמאמן יצר בעצמו. עריכה והשבתה רגילות.
 */
export type ExerciseOrigin = 'catalog' | 'edited' | 'mine';

export interface LibraryEntry {
  /** המסמך שמוצג בפועל — העותק, כשיש כזה. */
  exercise: ExerciseDoc;
  origin: ExerciseOrigin;
  /** מזהה תרגיל הקטלוג שמאחורי הכרטיס. שווה ל-`exercise.id` כשאין עותק. */
  sourceId: string;
}

/** מיון קבוע: קטגוריה ואז שם, שניהם בעברית. */
function byCategoryThenName(a: LibraryEntry, b: LibraryEntry): number {
  const byCategory = a.exercise.category.localeCompare(b.exercise.category, 'he');
  if (byCategory !== 0) return byCategory;
  return a.exercise.name.localeCompare(b.exercise.name, 'he');
}

/**
 * בונה את הרשימה שהמאמן רואה משני המאזינים.
 *
 * @param catalog התוצאה של `where('scope','==','global')`
 * @param mine    התוצאה של `where('coachUid','==',uid)` — **כולל עותקים מבוטלים**
 *
 * שלושה כללים, לפי הסדר:
 *
 * 1. **רק עותק פעיל מסתיר את המקור.** `active: false` על עותק פירושו "בוטל",
 *    והמקור חוזר לרשימה. סינון העותקים המבוטלים חייב לקרות **לפני** חישוב
 *    ההסתרה, אחרת התרגיל נעלם משני הצדדים.
 * 2. **עותק פעיל שהמקור שלו לא נמצא** (נמחק מהקטלוג, או שהמקור היה תרגיל org
 *    שכבר לא נטען) מוצג בכל זאת כ-`edited`. עדיף יתום גלוי מאשר תרגיל שנעלם.
 * 3. **תרגיל מקורי של המאמן מוצג גם כשהוא מושבת** — שם `active: false` פירושו
 *    "השבתה", והמאמן צריך דרך להפעיל אותו מחדש. זה ההבדל בין שתי המשמעויות
 *    של אותו שדה, והוא נשען על `sourceExerciseId`.
 */
export function buildExerciseLibrary(
  catalog: ExerciseDoc[],
  mine: ExerciseDoc[],
): LibraryEntry[] {
  // (1) רק עותקים פעילים נכנסים למפת ההסתרה.
  const overrides = new Map<string, ExerciseDoc>();
  for (const exercise of mine) {
    const sourceId = exercise.sourceExerciseId;
    if (!sourceId || !exercise.active) continue;
    overrides.set(sourceId, exercise);
  }

  const entries: LibraryEntry[] = [];
  const shownSources = new Set<string>();

  for (const exercise of catalog) {
    const override = overrides.get(exercise.id);
    if (override) shownSources.add(exercise.id);
    entries.push(
      override
        ? { exercise: override, origin: 'edited', sourceId: exercise.id }
        : { exercise, origin: 'catalog', sourceId: exercise.id },
    );
  }

  for (const exercise of mine) {
    const sourceId = exercise.sourceExerciseId;

    // (3) תרגיל מקורי של המאמן — תמיד ברשימה, גם מושבת.
    if (!sourceId) {
      entries.push({ exercise, origin: 'mine', sourceId: exercise.id });
      continue;
    }

    if (!exercise.active) continue; // בוטל — המקור כבר ברשימה במקומו
    if (shownSources.has(sourceId)) continue; // כבר הוצג במקום המקור

    // (2) יתום.
    shownSources.add(sourceId);
    entries.push({ exercise, origin: 'edited', sourceId });
  }

  return entries.sort(byCategoryThenName);
}

/** התרגילים כפי שהם מוצגים — הקלט של בורר התרגילים בתוכנית ושל החיפוש. */
export function libraryExercises(entries: LibraryEntry[]): ExerciseDoc[] {
  return entries.map((entry) => entry.exercise);
}

/**
 * העותק הקיים של המאמן עבור מקור נתון, אם יש כזה — **כולל עותק מבוטל**.
 *
 * זה מה שמונע עותק שני: מאמן שערך, ביטל, וערך שוב, חוזר לאותו מסמך במקום ליצור
 * חדש. החיפוש נעשה ברשימה שכבר בזיכרון מה-`onSnapshot`, ולא ב-`getDoc` —
 * `getDoc` על מסמך שאולי אינו קיים נחסם בכללים ומחזיר PERMISSION_DENIED שנראה
 * בדיוק כמו תקלה.
 */
export function findOverrideFor(mine: ExerciseDoc[], sourceId: string): ExerciseDoc | null {
  return (
    mine.find((exercise) => exercise.sourceExerciseId === sourceId && exercise.active) ??
    mine.find((exercise) => exercise.sourceExerciseId === sourceId) ??
    null
  );
}

/** הקטגוריות הקיימות בפועל ברשימה, ממוינות בעברית. לא רשימה קשיחה — היא מגיעה מהמסד. */
export function exerciseCategories(exercises: ExerciseDoc[]): string[] {
  const categories = new Set(exercises.map((exercise) => exercise.category).filter(Boolean));
  return [...categories].sort((a, b) => a.localeCompare(b, 'he'));
}

export interface ExerciseFilter {
  /** חיפוש חופשי בשם, בקטגוריה ובהנחיות. */
  term?: string;
  /** קטגוריה מדויקת, או null = כל הקטגוריות. */
  category?: string | null;
}

/**
 * האם התרגיל עומד בחיפוש ובסינון. מופרד מ-`filterExercises` כדי שהספרייה
 * תוכל לסנן `LibraryEntry` בלי לפרק אותו ולהרכיב אותו מחדש.
 */
export function matchesExerciseFilter(
  exercise: ExerciseDoc,
  { term = '', category = null }: ExerciseFilter,
): boolean {
  if (category && exercise.category !== category) return false;

  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return (
    exercise.name.toLowerCase().includes(needle) ||
    exercise.category.toLowerCase().includes(needle) ||
    exercise.description.toLowerCase().includes(needle)
  );
}

/** חיפוש וסינון — שניהם יחד, שניהם בצד הלקוח. */
export function filterExercises(
  exercises: ExerciseDoc[],
  filter: ExerciseFilter,
): ExerciseDoc[] {
  return exercises.filter((exercise) => matchesExerciseFilter(exercise, filter));
}

/**
 * האם המסמך הזה שייך למאמן המחובר — כלומר האם `updateDoc` עליו יעבור.
 *
 * זו תמונת-מראה של `firestore.rules` ולא מקור אמת נוסף: הכלל הוא שקובע, וזה
 * רק מונע מהמאמן להקליד טופס שלם ואז לקבל "אין הרשאה".
 *
 * שים לב שהיא **לא** עונה על "האם אפשר לערוך את הכרטיס": תרגיל קטלוג ניתן
 * לעריכה, אבל העריכה יוצרת מסמך חדש במקום לעדכן את הקיים. את ההבחנה הזו עושה
 * `ExerciseOrigin`.
 */
export function isOwnExercise(exercise: ExerciseDoc, coachUid: string): boolean {
  return exercise.scope === 'coach' && exercise.coachUid === coachUid;
}

/** הצעת היעד לשכבת הגיל של ה-MVP, אם קיימת. */
export function suggestedTarget(exercise: ExerciseDoc): number | null {
  return exercise.defaultTargets[MVP_COHORT] ?? null;
}

export interface ExerciseFormValues {
  name: string;
  category: string;
  unit: Unit;
  description: string;
  /** מחרוזת מהטופס. ריק = בלי הצעת יעד. */
  target: string;
}

export interface ExerciseFormErrors {
  name?: TranslationKey;
  category?: TranslationKey;
  target?: TranslationKey;
  description?: TranslationKey;
}

export const EMPTY_EXERCISE_FORM: ExerciseFormValues = {
  name: '',
  category: '',
  unit: 'count',
  description: '',
  target: '',
};

/**
 * ולידציה של טופס תרגיל.
 *
 * `takenNames` מונע שני תרגילים באותו שם — בתוכנית הם ייראו זהים לחלוטין
 * לשחקן. בעריכה מעבירים את הרשימה בלי השם הנוכחי.
 */
export function validateExerciseForm(
  values: ExerciseFormValues,
  takenNames: string[] = [],
): ExerciseFormErrors {
  const errors: ExerciseFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'coach.exercises.errors.nameRequired';
  } else if (name.length > EXERCISE_NAME_MAX_LENGTH) {
    errors.name = 'coach.exercises.errors.nameTooLong';
  } else if (takenNames.some((taken) => taken.trim() === name)) {
    errors.name = 'coach.exercises.errors.nameTaken';
  }

  if (!values.category.trim()) {
    errors.category = 'coach.exercises.errors.categoryRequired';
  }

  if (values.description.trim().length > EXERCISE_DESCRIPTION_MAX_LENGTH) {
    errors.description = 'coach.exercises.errors.descriptionTooLong';
  }

  if (values.target.trim()) {
    const target = Number(values.target);
    if (!Number.isFinite(target) || target <= 0) {
      errors.target = 'coach.exercises.errors.targetInvalid';
    }
  }

  return errors;
}

export function isExerciseFormValid(errors: ExerciseFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * בונה תרגיל **של המאמן** מתוך ערכי הטופס.
 *
 * `scope`, `orgId` ו-`coachUid` הם מה שה-rules בודקים ביצירה, ולכן הם לא
 * מגיעים מהטופס אלא נקבעים כאן. `orgId` נשמר גם על תרגיל פרטי — הוא מה
 * ששומר על הבידוד הרב-ארגוני, ומאמן לא יכול ליצור מסמך על שם ארגון אחר.
 * `tracksSuccess` נשאר false — תשתית בלבד ב-MVP.
 */
export function buildCoachExercise(
  values: ExerciseFormValues,
  orgId: string,
  coachUid: string,
): Exercise {
  const target = values.target.trim() ? Number(values.target) : null;

  return {
    scope: 'coach',
    orgId,
    coachUid,
    sourceExerciseId: null,
    name: values.name.trim(),
    category: values.category.trim(),
    unit: values.unit,
    description: values.description.trim(),
    videoUrl: null,
    tracksSuccess: false,
    successCapable: false,
    defaultTargets: target === null ? {} : { [MVP_COHORT]: target },
    active: true,
  };
}

/**
 * בונה **עותק פרטי** של תרגיל קיים.
 *
 * זהה ל-`buildCoachExercise`, בתוספת `sourceExerciseId` שמצביע על המקור —
 * זה השדה שגורם לספרייה להציג את העותק **במקום** המקור.
 *
 * השדות שאין להם שדה בטופס (`videoUrl`, `successCapable`) נלקחים מהמקור ולא
 * מאופסים: אחרת עריכת ניסוח של הנחיה הייתה מוחקת בשקט וידאו הדגמה.
 */
export function buildExerciseOverride(
  source: ExerciseDoc,
  values: ExerciseFormValues,
  orgId: string,
  coachUid: string,
): Exercise {
  return {
    ...buildCoachExercise(values, orgId, coachUid),
    sourceExerciseId: source.id,
    videoUrl: source.videoUrl,
    successCapable: source.successCapable,
  };
}

/** ערכי הטופס מתוך תרגיל קיים — לעריכה. */
export function exerciseToFormValues(exercise: ExerciseDoc): ExerciseFormValues {
  const target = suggestedTarget(exercise);

  return {
    name: exercise.name,
    category: exercise.category,
    unit: exercise.unit,
    description: exercise.description,
    target: target === null ? '' : String(target),
  };
}

/**
 * השדות שמותר לעדכן בתרגיל קיים.
 *
 * `scope`, `orgId`, `coachUid` ו-`sourceExerciseId` לעולם לא נשלחים —
 * `firestore.rules` חוסמים אותם ב-`unchanged`, וגם `active` נשאר מחוץ לרשימה
 * כדי שעריכת תוכן לא תפעיל בטעות תרגיל מושבת.
 */
export function exerciseUpdateFromForm(values: ExerciseFormValues): Partial<Exercise> {
  const built = buildCoachExercise(values, '', '');
  return {
    name: built.name,
    category: built.category,
    unit: built.unit,
    description: built.description,
    defaultTargets: built.defaultTargets,
  };
}

/**
 * אותו עדכון, בתוספת `active: true`.
 *
 * משמש כשמאמן עורך מחדש תרגיל קטלוג שכבר יש לו עבורו עותק **מבוטל**: במקום
 * ליצור עותק שני, אותו מסמך חוזר לחיים. בלי `active: true` העותק היה נשמר
 * מעודכן אבל ממשיך להיות מוסתר, והמאמן היה רואה שוב את גרסת הקטלוג.
 */
export function overrideRevivalFromForm(values: ExerciseFormValues): Partial<Exercise> {
  return { ...exerciseUpdateFromForm(values), active: true };
}
