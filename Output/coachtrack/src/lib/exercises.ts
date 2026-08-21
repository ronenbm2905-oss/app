/**
 * CoachTrack — הלוגיקה הטהורה של ספריית התרגילים.
 *
 * הספרייה שהמאמן רואה היא **איחוד של שני מקורות**: הקטלוג הגלובלי (30 תרגילים,
 * `scope: 'global'`) והתרגילים שהמועדון יצר לעצמו (`scope: 'org'`). המיזוג נעשה
 * כאן, בצד הלקוח, כי הוא חייב להיעשות בצד הלקוח — ראה `hooks/useExerciseLibrary.ts`.
 *
 * מה שאסור לשכוח: מאמן רשאי לערוך **רק תרגילים של הארגון שלו**. תרגיל גלובלי
 * הוא לקריאה בלבד עבורו, וזו לא החלטת UI — `firestore.rules` חוסמים את העדכון
 * (`isCoach() && resource.data.scope == 'org'`). המסך רק מסביר את זה מראש
 * במקום להראות טופס שייכשל.
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
 * מיזוג שני המקורות לרשימה אחת.
 *
 * דה-דופליקציה לפי מזהה כי שני ה-`onSnapshot` הם מאזינים נפרדים שיכולים
 * להתעדכן בסדר כלשהו; תרגיל של הארגון גובר על גלובלי עם אותו מזהה (מצב שלא
 * אמור לקרות, אבל רשימה כפולה על המסך היא באג שקשה לאתר).
 */
export function mergeExerciseSources(
  globalExercises: ExerciseDoc[],
  orgExercises: ExerciseDoc[],
): ExerciseDoc[] {
  const byId = new Map<string, ExerciseDoc>();
  for (const exercise of globalExercises) byId.set(exercise.id, exercise);
  for (const exercise of orgExercises) byId.set(exercise.id, exercise);

  return [...byId.values()].sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, 'he');
    if (byCategory !== 0) return byCategory;
    return a.name.localeCompare(b.name, 'he');
  });
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

/** חיפוש וסינון — שניהם יחד, שניהם בצד הלקוח. */
export function filterExercises(
  exercises: ExerciseDoc[],
  { term = '', category = null }: ExerciseFilter,
): ExerciseDoc[] {
  const needle = term.trim().toLowerCase();

  return exercises.filter((exercise) => {
    if (category && exercise.category !== category) return false;
    if (!needle) return true;

    return (
      exercise.name.toLowerCase().includes(needle) ||
      exercise.category.toLowerCase().includes(needle) ||
      exercise.description.toLowerCase().includes(needle)
    );
  });
}

/**
 * האם המאמן רשאי לערוך את התרגיל.
 *
 * זו תמונת-מראה של `firestore.rules` ולא מקור אמת נוסף: הכלל הוא שקובע,
 * וזה רק מונע מהמאמן להקליד טופס שלם ואז לקבל "אין הרשאה".
 */
export function canCoachEditExercise(exercise: ExerciseDoc, orgId: string): boolean {
  return exercise.scope === 'org' && exercise.orgId === orgId;
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
 * בונה מסמך תרגיל של הארגון מתוך ערכי הטופס.
 *
 * `scope: 'org'` ו-`orgId` הם מה שה-rules בודקים ביצירה, ולכן הם לא מגיעים
 * מהטופס אלא נקבעים כאן. `tracksSuccess` נשאר false — תשתית בלבד ב-MVP.
 */
export function buildOrgExercise(values: ExerciseFormValues, orgId: string): Exercise {
  const target = values.target.trim() ? Number(values.target) : null;

  return {
    scope: 'org',
    orgId,
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

/** השדות שמותר לעדכן בתרגיל קיים של הארגון. `scope`/`orgId` לעולם לא משתנים. */
export function exerciseUpdateFromForm(values: ExerciseFormValues): Partial<Exercise> {
  const built = buildOrgExercise(values, '');
  return {
    name: built.name,
    category: built.category,
    unit: built.unit,
    description: built.description,
    defaultTargets: built.defaultTargets,
  };
}
