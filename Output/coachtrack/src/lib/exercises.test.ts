/**
 * טסטים ל-lib/exercises.ts
 *
 * הספרייה מגיעה משני מקורות ומתמזגת בלקוח, ולכן המיזוג, החיפוש והסינון הם קוד
 * אמיתי ולא "רק תצוגה". שני דברים נבדקים כאן מול **הקטלוג האמיתי**
 * (`data/exercise-catalog.json`) ולא מול נתוני דמה: שיש בו 30 תרגילים, ושחיפוש
 * וסינון עובדים על הטקסט העברי שבו — כי זה מה שהמאמן יראה בפועל.
 *
 * ## מה חשוב כאן יותר מהכול
 *
 * `buildExerciseLibrary` הוא המקום שבו "כל מאמן מתקן לעצמו" הופך לרשימה על
 * המסך, ויש בו תרחיש אחד שנכשל בשקט אם סדר הפעולות מתהפך: **עותק שבוטל
 * (`active: false`) חייב להפסיק להסתיר את המקור.** אם ההסתרה מחושבת לפני סינון
 * העותקים המבוטלים, התרגיל נעלם משני הצדדים — לא המקור ולא העותק — והמאמן רואה
 * 29 תרגילים בלי להבין למה. זה הטסט שלא מוחקים.
 *
 * בנוסף נבדק `isOwnExercise`, שהוא תמונת-מראה של `firestore.rules`:
 * אם הוא יטעה, המאמן יקבל כפתור שמוביל ל-PERMISSION_DENIED.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  EXERCISE_NAME_MAX_LENGTH,
  UNITS,
  buildCoachExercise,
  buildExerciseLibrary,
  buildExerciseOverride,
  exerciseCategories,
  exerciseToFormValues,
  exerciseUpdateFromForm,
  filterExercises,
  findOverrideFor,
  isExerciseFormValid,
  isOwnExercise,
  libraryExercises,
  overrideRevivalFromForm,
  suggestedTarget,
  validateExerciseForm,
} from './exercises';
import type { ExerciseFormValues } from './exercises';
import { t } from '../i18n/he';
import type { Exercise, ExerciseDoc } from '../types/types';

const ORG_ID = 'org_kiryat_ono';
const COACH = 'uid_emanuel';
const OTHER_COACH = 'uid_other_coach';

/** הקטלוג האמיתי שנטען למסד ב-seed — אותו קובץ ש-scripts/seed.js קורא. */
const catalog = JSON.parse(readFileSync('data/exercise-catalog.json', 'utf8')) as {
  exercises: (Exercise & { id: string })[];
};

const globalCatalog: ExerciseDoc[] = catalog.exercises.map((exercise) => ({ ...exercise }));

/** תרגיל שהמאמן יצר בעצמו — לא עותק של דבר. */
function coachExercise(id: string, overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return {
    id,
    scope: 'coach',
    orgId: ORG_ID,
    coachUid: COACH,
    sourceExerciseId: null,
    name: 'תרגיל של המאמן',
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

/** עותק פרטי של תרגיל קטלוג. */
function overrideOf(source: ExerciseDoc, overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return coachExercise(`copy_${source.id}`, {
    sourceExerciseId: source.id,
    name: `${source.name} — הגרסה שלי`,
    category: source.category,
    unit: source.unit,
    ...overrides,
  });
}

describe('הקטלוג האמיתי', () => {
  it('מכיל 30 תרגילים גלובליים — מה שאמור להיות במסד', () => {
    expect(globalCatalog).toHaveLength(30);
    expect(globalCatalog.every((exercise) => exercise.scope === 'global')).toBe(true);
    expect(globalCatalog.every((exercise) => exercise.orgId === null)).toBe(true);
  });

  it('אין בו שדה coachUid — הקטלוג נשאר בדיוק כפי שהוא, בלי מיגרציה', () => {
    // זה מה שמאפשר ל-where('coachUid','==',uid) פשוט לא להתאים לו.
    expect(globalCatalog.every((exercise) => exercise.coachUid === undefined)).toBe(true);
    expect(globalCatalog.every((exercise) => exercise.sourceExerciseId === undefined)).toBe(true);
  });

  it('כל יחידת מדידה בקטלוג היא אחת מארבע המותרות', () => {
    for (const exercise of globalCatalog) {
      expect(UNITS).toContain(exercise.unit);
    }
  });
});

describe('בניית הספרייה — עותק פרטי מחליף את המקור', () => {
  const source = globalCatalog[0];

  it('בלי תרגילים משלי — הספרייה היא הקטלוג', () => {
    const entries = buildExerciseLibrary(globalCatalog, []);
    expect(entries).toHaveLength(30);
    expect(entries.every((entry) => entry.origin === 'catalog')).toBe(true);
  });

  it('עותק פעיל מחליף את המקור — עדיין 30 תרגילים, לא 31', () => {
    const copy = overrideOf(source);
    const entries = buildExerciseLibrary(globalCatalog, [copy]);

    expect(entries).toHaveLength(30);

    const names = entries.map((entry) => entry.exercise.name);
    expect(names).toContain(copy.name);
    expect(names).not.toContain(source.name);

    const edited = entries.find((entry) => entry.exercise.id === copy.id);
    expect(edited?.origin).toBe('edited');
    expect(edited?.sourceId).toBe(source.id);
  });

  it('⚠️ עותק שבוטל מפסיק להסתיר — המקור חוזר, והתרגיל לא נעלם', () => {
    // התרחיש שנכשל בשקט אם ההסתרה מחושבת לפני סינון העותקים המבוטלים:
    // לא המקור ולא העותק, והמאמן רואה 29 תרגילים.
    const reverted = overrideOf(source, { active: false });
    const entries = buildExerciseLibrary(globalCatalog, [reverted]);

    expect(entries).toHaveLength(30);

    const names = entries.map((entry) => entry.exercise.name);
    expect(names).toContain(source.name);
    expect(names).not.toContain(reverted.name);

    const restored = entries.find((entry) => entry.exercise.id === source.id);
    expect(restored?.origin).toBe('catalog');
  });

  it('ביטול והחייאה — הרשימה חוזרת לעותק בלי שנוצר מסמך שני', () => {
    const copy = overrideOf(source, { active: false });
    expect(
      buildExerciseLibrary(globalCatalog, [copy]).find((e) => e.exercise.id === source.id)?.origin,
    ).toBe('catalog');

    const revived = { ...copy, active: true };
    const entries = buildExerciseLibrary(globalCatalog, [revived]);
    expect(entries).toHaveLength(30);
    expect(entries.find((e) => e.exercise.id === copy.id)?.origin).toBe('edited');
  });

  it('שני עותקים לאותו מקור — הפעיל מנצח, והרשימה לא מתארכת', () => {
    // לא אמור לקרות (findOverrideFor מונע יצירת שני), אבל רשימה כפולה על המסך
    // היא באג שקשה לאתר, ולכן המיזוג עמיד לזה.
    const stale = overrideOf(source, { active: false });
    const live = overrideOf(source, { active: true });
    live.id = 'copy_live';

    const entries = buildExerciseLibrary(globalCatalog, [stale, live]);
    expect(entries).toHaveLength(30);
    expect(entries.find((e) => e.sourceId === source.id)?.exercise.id).toBe('copy_live');
  });

  it('תרגיל שהמאמן יצר בעצמו מתווסף לרשימה — 31', () => {
    const entries = buildExerciseLibrary(globalCatalog, [coachExercise('mine_1')]);
    expect(entries).toHaveLength(31);
    expect(entries.find((e) => e.exercise.id === 'mine_1')?.origin).toBe('mine');
  });

  it('תרגיל שלי שהושבת נשאר ברשימה — שם active:false פירושו השבתה, לא ביטול', () => {
    // אותו שדה, שתי משמעויות. ההבחנה נשענת על sourceExerciseId:
    // עותק מבוטל נעלם והמקור חוזר; תרגיל מקורי מושבת נשאר כדי שאפשר יהיה
    // להפעיל אותו מחדש. אין מחיקה קשיחה בשום מסלול.
    const entries = buildExerciseLibrary(globalCatalog, [
      coachExercise('mine_off', { active: false }),
    ]);
    expect(entries).toHaveLength(31);
    expect(entries.find((e) => e.exercise.id === 'mine_off')?.origin).toBe('mine');
  });

  it('עותק יתום — המקור לא ברשימה — מוצג ולא נבלע', () => {
    const orphan = coachExercise('orphan', { sourceExerciseId: 'ex_that_vanished' });
    const entries = buildExerciseLibrary(globalCatalog, [orphan]);
    expect(entries).toHaveLength(31);
    expect(entries.find((e) => e.exercise.id === 'orphan')?.origin).toBe('edited');
  });

  it('עותק יתום שבוטל — לא מוצג, ואין מה להחזיר במקומו', () => {
    const orphan = coachExercise('orphan', {
      sourceExerciseId: 'ex_that_vanished',
      active: false,
    });
    expect(buildExerciseLibrary(globalCatalog, [orphan])).toHaveLength(30);
  });

  it('ממוין לפי קטגוריה ואז לפי שם', () => {
    const categories = buildExerciseLibrary(globalCatalog, [coachExercise('mine_1')]).map(
      (entry) => entry.exercise.category,
    );
    expect([...categories]).toEqual([...categories].sort((a, b) => a.localeCompare(b, 'he')));
  });

  it('libraryExercises מחזיר את המסמכים שמוצגים בפועל — כולל העותק', () => {
    const copy = overrideOf(source);
    const shown = libraryExercises(buildExerciseLibrary(globalCatalog, [copy]));
    expect(shown.map((exercise) => exercise.id)).toContain(copy.id);
    expect(shown.map((exercise) => exercise.id)).not.toContain(source.id);
  });
});

describe('איתור עותק קיים — כדי לא ליצור שני', () => {
  const source = globalCatalog[0];

  it('אין עותק — null', () => {
    expect(findOverrideFor([coachExercise('mine_1')], source.id)).toBeNull();
  });

  it('מוצא גם עותק מבוטל — זה מה שמחיה אותו במקום ליצור חדש', () => {
    const reverted = overrideOf(source, { active: false });
    expect(findOverrideFor([reverted], source.id)?.id).toBe(reverted.id);
  });

  it('כשיש גם פעיל וגם מבוטל — הפעיל מנצח', () => {
    const stale = overrideOf(source, { active: false });
    const live = { ...overrideOf(source), id: 'copy_live' };
    expect(findOverrideFor([stale, live], source.id)?.id).toBe('copy_live');
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
    const shown = libraryExercises(
      buildExerciseLibrary(globalCatalog, [coachExercise('mine_1', { category: 'מנטלי' })]),
    );
    expect(exerciseCategories(shown)).toContain('מנטלי');
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

describe('על מי updateDoc יעבור — מראה של firestore.rules', () => {
  it('תרגיל גלובלי אינו נכתב בידי מאמן — גם לא אחרי שיש לו עותק', () => {
    expect(isOwnExercise(globalCatalog[0], COACH)).toBe(false);
  });

  it('תרגיל של המאמן עצמו — כן', () => {
    expect(isOwnExercise(coachExercise('mine_1'), COACH)).toBe(true);
    expect(isOwnExercise(overrideOf(globalCatalog[0]), COACH)).toBe(true);
  });

  it('העותק של מאמן אחר — לא, גם באותו ארגון', () => {
    const theirs = coachExercise('theirs', { coachUid: OTHER_COACH });
    expect(isOwnExercise(theirs, COACH)).toBe(false);
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

  it('קובעת scope, orgId ו-coachUid בעצמה — הם מה שה-rules בודקים', () => {
    const built = buildCoachExercise(values, ORG_ID, COACH);
    expect(built.scope).toBe('coach');
    expect(built.orgId).toBe(ORG_ID);
    expect(built.coachUid).toBe(COACH);
    expect(built.sourceExerciseId).toBeNull();
  });

  it('מנקה רווחים ושומרת את היעד תחת שכבת הגיל של ה-MVP', () => {
    const built = buildCoachExercise(values, ORG_ID, COACH);
    expect(built.name).toBe('זריקות מהפינה');
    expect(built.category).toBe('זריקה');
    expect(built.description).toBe('עשר סדרות.');
    expect(built.defaultTargets).toEqual({ cadets_13_15: 200 });
  });

  it('בלי יעד — אין הצעת יעד בכלל', () => {
    expect(buildCoachExercise({ ...values, target: '' }, ORG_ID, COACH).defaultTargets).toEqual({});
  });

  it('שדות התשתית נשארים על ברירת המחדל של ה-MVP', () => {
    const built = buildCoachExercise(values, ORG_ID, COACH);
    expect(built.tracksSuccess).toBe(false);
    expect(built.videoUrl).toBeNull();
    expect(built.active).toBe(true);
  });

  it('עותק פרטי נושא את המקור, ולא מאפס שדות שאין להם שדה בטופס', () => {
    const source: ExerciseDoc = {
      ...globalCatalog[0],
      videoUrl: 'https://example.com/clip',
      successCapable: true,
    };
    const built = buildExerciseOverride(source, values, ORG_ID, COACH);

    expect(built.scope).toBe('coach');
    expect(built.coachUid).toBe(COACH);
    expect(built.sourceExerciseId).toBe(source.id);
    // אחרת עריכת ניסוח של הנחיה הייתה מוחקת בשקט וידאו הדגמה.
    expect(built.videoUrl).toBe('https://example.com/clip');
    expect(built.successCapable).toBe(true);
  });

  it('עדכון לא נוגע בשדות הזהות ולא במצב הפעיל', () => {
    const update = exerciseUpdateFromForm(values);
    expect(Object.keys(update).sort()).toEqual(
      ['category', 'defaultTargets', 'description', 'name', 'unit'].sort(),
    );
  });

  it('החייאת עותק מבוטל מוסיפה active:true — ורק אותו', () => {
    // בלי זה העותק היה נשמר מעודכן אבל ממשיך להיות מוסתר, והמאמן היה רואה
    // שוב את גרסת הקטלוג אחרי שערך.
    const update = overrideRevivalFromForm(values);
    expect(update.active).toBe(true);
    expect(Object.keys(update).sort()).toEqual(
      ['active', 'category', 'defaultTargets', 'description', 'name', 'unit'].sort(),
    );
    expect(update.scope).toBeUndefined();
    expect(update.orgId).toBeUndefined();
    expect(update.coachUid).toBeUndefined();
    expect(update.sourceExerciseId).toBeUndefined();
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
    expect(exerciseToFormValues(coachExercise('mine_1')).target).toBe('');
    expect(suggestedTarget(coachExercise('mine_1'))).toBeNull();
  });
});
