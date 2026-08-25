/**
 * טסטי רינדור לספריית התרגילים.
 *
 * הרשימה שמוזנת לטסט היא **הקטלוג האמיתי** (`data/exercise-catalog.json`,
 * 30 תרגילים) ולא נתוני דמה — כי מה שצריך להיבדק הוא שהמסך מציג את מה שיושב
 * במסד: 30 תרגילים, כל הקטגוריות, וההנחיות בעברית.
 *
 * הבדיקה החשובה כאן היא **אילו כפתורים מקבל כל סוג כרטיס**:
 *
 * | הכרטיס | עריכה | חזרה למקור | השבתה |
 * |---|---|---|---|
 * | קטלוג  | ✅ (תיצור עותק) | — | — |
 * | נערך   | ✅ | ✅ | — |
 * | שלי    | ✅ | — | ✅ |
 *
 * "השבתה" על תרגיל קטלוג הייתה מובילה ישר ל-PERMISSION_DENIED: המסמך אינו של
 * המאמן. "חזרה למקור" על תרגיל שהמאמן יצר בעצמו היא חסרת משמעות — אין מקור.
 *
 * מה שלא נבדק כאן ודורש עין אנושית: הקלדה בשדה החיפוש ובחירה בסינון (תלויות
 * באינטראקציה) — הלוגיקה עצמה נבדקת ב-`lib/exercises.test.ts` מול אותו קטלוג.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseLibraryView } from './ExerciseLibraryView';
import type { ExerciseLibraryViewProps } from './ExerciseLibraryView';
import { ExerciseForm } from './ExerciseForm';
import { buildExerciseLibrary, suggestedTarget } from '../../lib/exercises';
import { he, t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { Exercise, ExerciseDoc } from '../../types/types';

const ORG_ID = 'org_kiryat_ono';
const COACH = 'uid_emanuel';

const catalog = JSON.parse(readFileSync('data/exercise-catalog.json', 'utf8')) as {
  exercises: (Exercise & { id: string })[];
};

const globalCatalog: ExerciseDoc[] = catalog.exercises.map((exercise) => ({ ...exercise }));

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
    description: 'הנחיות של המאמן',
    videoUrl: null,
    tracksSuccess: false,
    successCapable: false,
    defaultTargets: {},
    active: true,
    ...overrides,
  };
}

function overrideOf(source: ExerciseDoc, overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return coachExercise(`copy_${source.id}`, {
    sourceExerciseId: source.id,
    name: 'זריקות בגרסה שלי',
    category: source.category,
    unit: source.unit,
    ...overrides,
  });
}

function render(overrides: Partial<ExerciseLibraryViewProps> = {}): string {
  const props: ExerciseLibraryViewProps = {
    status: 'ready',
    entries: buildExerciseLibrary(globalCatalog, []),
    onCreate: async () => true,
    onSave: async () => true,
    onRevert: async () => true,
    onSetActive: async () => true,
    busyId: null,
    feedback: null,
    ...overrides,
  };

  return renderToStaticMarkup(<ExerciseLibraryView {...props} />);
}

function withMine(mine: ExerciseDoc[]): Partial<ExerciseLibraryViewProps> {
  return { entries: buildExerciseLibrary(globalCatalog, mine) };
}

/**
 * כמה **כפתורים** עם התווית הזו יש במסך.
 *
 * לא `split(label)` על כל ה-HTML: התווית "עריכה" מופיעה גם בתוך פסקת ההסבר
 * ("עריכה של תרגיל מהקטלוג שומרת גרסה פרטית שלך..."), והספירה הייתה מקבלת 31
 * במקום 30 בלי שאף כפתור נוסף.
 */
function countButtons(html: string, label: string): number {
  return html.split(`>${label}</button>`).length - 1;
}

describe('מצבי המסך', () => {
  it('טעינה', () => {
    expect(render({ status: 'loading' })).toContain(he.coach.exercises.loading);
  });

  it('שגיאה — ולא "אין תרגילים"', () => {
    const html = render({ status: 'error' });
    expect(html).toContain(he.coach.exercises.loadError);
    expect(html).not.toContain(he.coach.exercises.empty);
  });

  it('ספרייה ריקה', () => {
    expect(render({ entries: [] })).toContain(he.coach.exercises.empty);
  });
});

describe('הקטלוג על המסך', () => {
  const html = render();

  it('כל 30 התרגילים מוצגים בשמם', () => {
    for (const exercise of globalCatalog) {
      expect(html, `תרגיל חסר במסך: ${exercise.name}`).toContain(exercise.name);
    }
    expect(html).toContain(t('coach.exercises.count', { shown: 30, total: 30 }));
  });

  it('כל הקטגוריות זמינות לסינון', () => {
    for (const category of new Set(globalCatalog.map((exercise) => exercise.category))) {
      expect(html).toContain(`<option value="${category}">${category}</option>`);
    }
    expect(html).toContain(he.coach.exercises.allCategories);
  });

  it('מוצגות הנחיות הביצוע ויעד מוצע', () => {
    const first = globalCatalog[0];
    expect(html).toContain(first.description);

    const target = suggestedTarget(first);
    expect(target).not.toBeNull();
    expect(html).toContain(
      t('coach.exercises.targetSuggestion', {
        target: target as number,
        unit: t(`units.${first.unit}` as TranslationKey),
      }),
    );
  });

  it('תרגילי הקטלוג מסומנים ככאלה, ומוסבר שהעריכה פרטית', () => {
    expect(html).toContain(he.coach.exercises.globalBadge);
    expect(html).toContain(he.coach.exercises.privateEdits);
  });
});

describe('אילו כפתורים מקבל כל כרטיס', () => {
  it('כל 30 תרגילי הקטלוג ניתנים לעריכה — אבל אין עליהם השבתה ואין חזרה למקור', () => {
    const html = render();
    expect(countButtons(html, he.coach.exercises.actions.edit)).toBe(30);
    expect(countButtons(html, he.coach.exercises.actions.deactivate)).toBe(0);
    expect(countButtons(html, he.coach.exercises.actions.revert)).toBe(0);
    expect(html).not.toContain(he.coach.exercises.editedBadge);
  });

  it('תרגיל שהמאמן יצר מקבל השבתה ותג "שלי" — ולא חזרה למקור', () => {
    const html = render(withMine([coachExercise('mine_1')]));
    expect(countButtons(html, he.coach.exercises.actions.deactivate)).toBe(1);
    expect(countButtons(html, he.coach.exercises.actions.revert)).toBe(0);
    expect(html).toContain(he.coach.exercises.mineBadge);
  });

  it('עותק פרטי מוצג במקום המקור, עם תג "נערך" וכפתור חזרה למקור', () => {
    const source = globalCatalog[0];
    const html = render(withMine([overrideOf(source)]));

    expect(html).toContain(he.coach.exercises.editedBadge);
    expect(html).toContain(he.coach.exercises.editedNote);
    expect(countButtons(html, he.coach.exercises.actions.revert)).toBe(1);
    // עדיין 30 — העותק החליף את המקור, לא נוסף לו.
    expect(html).toContain(t('coach.exercises.count', { shown: 30, total: 30 }));
    expect(html).toContain('זריקות בגרסה שלי');
    expect(html).not.toContain(`>${source.name}</p>`);
  });

  it('עותק שבוטל — המקור חוזר למסך, בלי תג "נערך" ובלי כפתור חזרה', () => {
    const source = globalCatalog[0];
    const html = render(withMine([overrideOf(source, { active: false })]));

    expect(html).toContain(source.name);
    expect(html).not.toContain('זריקות בגרסה שלי');
    expect(html).not.toContain(he.coach.exercises.editedBadge);
    expect(countButtons(html, he.coach.exercises.actions.revert)).toBe(0);
    expect(html).toContain(t('coach.exercises.count', { shown: 30, total: 30 }));
  });

  it('תרגיל שלי שהושבת מסומן ומוצע להפעלה מחדש — אין מחיקה', () => {
    const html = render(withMine([coachExercise('mine_off', { active: false })]));
    expect(html).toContain(he.coach.exercises.inactiveBadge);
    expect(html).toContain(he.coach.exercises.actions.activate);
    expect(html).not.toContain(he.common.delete);
  });
});

describe('טופס תרגיל', () => {
  const formHtml = renderToStaticMarkup(
    <ExerciseForm
      mode="create"
      idPrefix="exercise-new"
      categories={['זריקה', 'כושר']}
      takenNames={[]}
      onSubmit={async () => true}
      onClose={() => {}}
    />,
  );

  it('מציע את ארבע יחידות המדידה המותרות', () => {
    for (const unit of [he.units.count, he.units.minutes, he.units.sessions, he.units.distance_km]) {
      expect(formHtml).toContain(unit);
    }
  });

  it('מציע קטגוריות קיימות אבל לא כולא את המאמן בהן', () => {
    expect(formHtml).toContain('<datalist');
    expect(formHtml).toContain('זריקה');
  });

  it('יש שדה הנחיות ביצוע — זה מה שהשחקן יראה', () => {
    expect(formHtml).toContain(he.coach.exercises.form.description);
    expect(formHtml).toContain('<textarea');
  });

  it('עריכת תרגיל קטלוג אומרת מראש שנשמרת גרסה פרטית', () => {
    // אחרת המאמן יניח שהוא ערך תרגיל שכל האגודה רואה.
    const overrideHtml = renderToStaticMarkup(
      <ExerciseForm
        mode="override"
        idPrefix="exercise-edit"
        categories={['זריקה']}
        takenNames={[]}
        onSubmit={async () => true}
        onClose={() => {}}
      />,
    );

    expect(overrideHtml).toContain(he.coach.exercises.form.overrideTitle);
    expect(overrideHtml).toContain(he.coach.exercises.form.overrideHint);
    expect(overrideHtml).toContain(he.coach.exercises.form.submitOverride);
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט עברי במסך ובטופס מגיע מ-i18n/he.ts או מהמסד', () => {
    const fromDatabase = globalCatalog.flatMap((exercise) => [
      exercise.name,
      exercise.category,
      exercise.description,
    ]);

    const targets = globalCatalog.map((exercise) =>
      t('coach.exercises.targetSuggestion', {
        target: suggestedTarget(exercise) ?? 0,
        unit: t(`units.${exercise.unit}` as TranslationKey),
      }),
    );

    const known = dictionaryStrings([
      ...fromDatabase,
      ...targets,
      'תרגיל של המאמן',
      'הנחיות של המאמן',
      'זריקות בגרסה שלי',
      t('coach.exercises.count', { shown: 30, total: 30 }),
      t('coach.exercises.count', { shown: 31, total: 31 }),
      t('coach.exercises.count', { shown: 1, total: 1 }),
      t('coach.exercises.count', { shown: 0, total: 0 }),
    ]);

    const screens = [
      render(),
      render({ entries: [] }),
      render({ status: 'error' }),
      render(withMine([coachExercise('mine_off', { active: false })])),
      render(withMine([overrideOf(globalCatalog[0])])),
      renderToStaticMarkup(
        <ExerciseForm
          mode="create"
          idPrefix="exercise-new"
          categories={['זריקה']}
          takenNames={[]}
          onSubmit={async () => true}
          onClose={() => {}}
        />,
      ),
      renderToStaticMarkup(
        <ExerciseForm
          mode="override"
          idPrefix="exercise-edit"
          categories={['זריקה']}
          takenNames={[]}
          onSubmit={async () => true}
          onClose={() => {}}
        />,
      ),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
