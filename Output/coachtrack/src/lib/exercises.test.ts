/**
 * טסטים ל-lib/exercises.ts
 *
 * הספרייה מגיעה משני מקורות ומתמזגת בלקוח, ולכן המיזוג, החיפוש והסינון הם קוד
 * אמיתי ולא "רק תצוגה". שני דברים נבדקים כאן מול **הקטלוג האמיתי**
 * (`data/exercise-catalog.json`) ולא מול נתוני דמה: שיש בו 30 תרגילים, ושחיפוש
 * וסינון עובדים על הטקסט העברי שבו — כי זה מה שהמאמן יראה בפועל.
 *
 * בנוסף נבדק `canCoachEditExercise`, שהוא תמונת-מראה של `firestore.rules`:
 * אם הוא יטעה, המאמן יקבל כפתור עריכה שמוביל ל-PERMISSION_DENIED.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  EXERCISE_NAME_MAX_LENGTH,
  UNITS,
  buildOrgExercise,
  canCoachEditExercise,
  exerciseCategories,
  exerciseToFormValues,
  exerciseUpdateFromForm,
  filterExercises,
  isExerciseFormValid,
  mergeExerciseSources,
  suggestedTarget,
  validateExerciseForm,
} from './exercises';
import type { ExerciseFormValues } from './exercises';
import { t } from '../i18n/he';
import type { Exercise, ExerciseDoc } from '../types/types';

const ORG_ID = 'org_kiryat_ono';

/** הקטלוג האמיתי שנטען למסד ב-seed — אותו קובץ ש-scripts/seed.js קורא. */
const catalog = JSON.parse(readFileSync('data/exercise-catalog.json', 'utf8')) as {
  exercises: (Exercise & { id: string })[];
};

const globalCatalog: ExerciseDoc[] = catalog.exercises.map((exercise) => ({ ...exercise }));

function orgExercise(id: string, overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return {
    id,
    scope: 'org',
    orgId: ORG_ID,
    name: 'תרגיל מועדון',
    category: 'כושר',
    unit: 'minutes',
    description: 'הנחיות',
    videoUrl: null,
    tracksSuccess: false,
    successCapable: false,
    defaultTargets: {},
    active: true,
    ...overrides,
  };
}

describe('הקטלוג האמיתי', () => {
  it('מכיל 30 תרגילים גלובליים — מה שאמור להיות במסד', () => {
    expect(globalCatalog).toHaveLength(30);
    expect(globalCatalog.every((exercise) => exercise.scope === 'global')).toBe(true);
    expect(globalCatalog.every((exercise) => exercise.orgId === null)).toBe(true);
  });

  it('כל יחידת מדידה בקטלוג היא אחת מארבע המותרות', () => {
    for (const exercise of globalCatalog) {
      expect(UNITS).toContain(exercise.unit);
    }
  });
});

describe('מיזוג שני המקורות', () => {
  it('מחזיר את שני המקורות יחד', () => {
    const merged = mergeExerciseSources(globalCatalog, [orgExercise('org_1')]);
    expect(merged).toHaveLength(31);
  });

  it('לא מכפיל מסמך שהופיע בשני המאזינים', () => {
    const duplicated = orgExercise(globalCatalog[0].id, { name: 'גרסת המועדון' });
    const merged = mergeExerciseSources(globalCatalog, [duplicated]);

    expect(merged).toHaveLength(30);
    expect(merged.find((exercise) => exercise.id === duplicated.id)?.name).toBe('גרסת המועדון');
  });

  it('ממוין לפי קטגוריה ואז לפי שם', () => {
    const merged = mergeExerciseSources(globalCatalog, []);
    const categories = merged.map((exercise) => exercise.category);
    expect([...categories]).toEqual([...categories].sort((a, b) => a.localeCompare(b, 'he')));
  });
});

describe('קטגוריות', () => {
  it('מוחזרות בלי כפילויות, ממוינות', () => {
    const categories = exerciseCategories(globalCatalog);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toContain('זריקה');
    expect(categories).toContain('כושר');
  });

  it('כוללות קטגוריה חדשה שהמאמן יצר', () => {
    const merged = mergeExerciseSources(globalCatalog, [
      orgExercise('org_1', { category: 'מנטלי' }),
    ]);
    expect(exerciseCategories(merged)).toContain('מנטלי');
  });
});

describe('חיפוש וסינון על הקטלוג האמיתי', () => {
  it('סינון לפי קטגוריה מחזיר רק אותה', () => {
    const shooting = filterExercises(globalCatalog, { category: 'זריקה' });
    expect(shooting.length).toBeGreaterThan(0);
    expect(shooting.every((exercise) => exercise.category === 'זריקה')).toBe(true);
  });

  it('חיפוש חופשי מוצא לפי שם', () => {
    const found = filterExercises(globalCatalog, { term: 'זריקות' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((exercise) => exercise.name.includes('זריקות'))).toBe(true);
  });

  it('חיפוש מוצא גם בתוך הנחיות הביצוע', () => {
    const withDescription = globalCatalog.find((exercise) => exercise.description.includes('קיר'));
    expect(withDescription).toBeDefined();
    const found = filterExercises(globalCatalog, { term: 'קיר' });
    expect(found.map((exercise) => exercise.id)).toContain(withDescription?.id);
  });

  it('חיפוש וסינון עובדים יחד', () => {
    const found = filterExercises(globalCatalog, { term: 'זריקות', category: 'זריקה' });
    expect(found.every((exercise) => exercise.category === 'זריקה')).toBe(true);
    expect(found.length).toBeLessThanOrEqual(
      filterExercises(globalCatalog, { term: 'זריקות' }).length,
    );
  });

  it('חיפוש ריק מחזיר הכל', () => {
    expect(filterExercises(globalCatalog, { term: '  ' })).toHaveLength(30);
    expect(filterExercises(globalCatalog, {})).toHaveLength(30);
  });

  it('חיפוש שלא נמצא מחזיר רשימה ריקה, לא הכל', () => {
    expect(filterExercises(globalCatalog, { term: 'קפיצה במוט' })).toHaveLength(0);
  });
});

describe('מי רשאי לערוך — מראה של firestore.rules', () => {
  it('תרגיל גלובלי אינו ניתן לעריכה בידי מאמן', () => {
    expect(canCoachEditExercise(globalCatalog[0], ORG_ID)).toBe(false);
  });

  it('תרגיל של הארגון כן', () => {
    expect(canCoachEditExercise(orgExercise('org_1'), ORG_ID)).toBe(true);
  });

  it('תרגיל של ארגון אחר — לא', () => {
    expect(canCoachEditExercise(orgExercise('org_1', { orgId: 'org_other' }), ORG_ID)).toBe(false);
  });
});

describe('ולידציה של טופס תרגיל', () => {
  const valid: ExerciseFormValues = {
    name: 'זריקות מהפינה',
    category: 'זריקה',
    unit: 'count',
    description: 'עשר סדרות מכל פינה.',
    target: '200',
  };

  it('טופס תקין', () => {
    expect(isExerciseFormValid(validateExerciseForm(valid))).toBe(true);
  });

  it('שם חסר, ארוך מדי, ותפוס', () => {
    expect(validateExerciseForm({ ...valid, name: ' ' }).name).toBe(
      'coach.exercises.errors.nameRequired',
    );
    expect(
      validateExerciseForm({ ...valid, name: 'א'.repeat(EXERCISE_NAME_MAX_LENGTH + 1) }).name,
    ).toBe('coach.exercises.errors.nameTooLong');
    expect(validateExerciseForm(valid, ['זריקות מהפינה']).name).toBe(
      'coach.exercises.errors.nameTaken',
    );
  });

  it('קטגוריה חסרה', () => {
    expect(validateExerciseForm({ ...valid, category: '  ' }).category).toBe(
      'coach.exercises.errors.categoryRequired',
    );
  });

  it('יעד לא מספרי או אפס', () => {
    expect(validateExerciseForm({ ...valid, target: 'הרבה' }).target).toBe(
      'coach.exercises.errors.targetInvalid',
    );
    expect(validateExerciseForm({ ...valid, target: '0' }).target).toBe(
      'coach.exercises.errors.targetInvalid',
    );
    expect(validateExerciseForm({ ...valid, target: '-5' }).target).toBe(
      'coach.exercises.errors.targetInvalid',
    );
  });

  it('יעד ריק מותר — הוא הצעה, לא חובה', () => {
    expect(validateExerciseForm({ ...valid, target: '' }).target).toBeUndefined();
  });

  it('כל מפתח שגיאה קיים במילון העברי', () => {
    const broken: ExerciseFormValues = {
      name: 'א'.repeat(200),
      category: '',
      unit: 'count',
      description: 'ב'.repeat(700),
      target: 'לא מספר',
    };

    for (const key of Object.values(validateExerciseForm(broken))) {
      expect(t(key), `מפתח חסר במילון: ${key}`).not.toBe(key);
    }
  });
});

describe('בניית מסמך תרגיל', () => {
  const values: ExerciseFormValues = {
    name: '  זריקות מהפינה  ',
    category: ' זריקה ',
    unit: 'count',
    description: '  עשר סדרות.  ',
    target: '200',
  };

  it('קובעת scope ו-orgId בעצמה — הם מה שה-rules בודקים', () => {
    const built = buildOrgExercise(values, ORG_ID);
    expect(built.scope).toBe('org');
    expect(built.orgId).toBe(ORG_ID);
  });

  it('מנקה רווחים ושומרת את היעד תחת שכבת הגיל של ה-MVP', () => {
    const built = buildOrgExercise(values, ORG_ID);
    expect(built.name).toBe('זריקות מהפינה');
    expect(built.category).toBe('זריקה');
    expect(built.description).toBe('עשר סדרות.');
    expect(built.defaultTargets).toEqual({ cadets_13_15: 200 });
  });

  it('בלי יעד — אין הצעת יעד בכלל', () => {
    expect(buildOrgExercise({ ...values, target: '' }, ORG_ID).defaultTargets).toEqual({});
  });

  it('שדות התשתית נשארים על ברירת המחדל של ה-MVP', () => {
    const built = buildOrgExercise(values, ORG_ID);
    expect(built.tracksSuccess).toBe(false);
    expect(built.videoUrl).toBeNull();
    expect(built.active).toBe(true);
  });

  it('עדכון לא נוגע ב-scope, ב-orgId ובמצב הפעיל', () => {
    const update = exerciseUpdateFromForm(values);
    expect(Object.keys(update).sort()).toEqual(
      ['category', 'defaultTargets', 'description', 'name', 'unit'].sort(),
    );
  });
});

describe('המרה לערכי טופס והצעת יעד', () => {
  it('הלוך ושוב על תרגיל אמיתי מהקטלוג', () => {
    const withTarget = globalCatalog.find((exercise) => suggestedTarget(exercise) !== null);
    expect(withTarget).toBeDefined();

    const values = exerciseToFormValues(withTarget as ExerciseDoc);
    expect(values.name).toBe(withTarget?.name);
    expect(Number(values.target)).toBe(suggestedTarget(withTarget as ExerciseDoc));
  });

  it('תרגיל בלי הצעת יעד מחזיר שדה ריק', () => {
    expect(exerciseToFormValues(orgExercise('org_1')).target).toBe('');
    expect(suggestedTarget(orgExercise('org_1'))).toBeNull();
  });
});
