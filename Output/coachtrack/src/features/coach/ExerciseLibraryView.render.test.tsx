/**
 * טסטי רינדור לספריית התרגילים.
 *
 * הרשימה שמוזנת לטסט היא **הקטלוג האמיתי** (`data/exercise-catalog.json`,
 * 30 תרגילים) ולא נתוני דמה — כי מה שצריך להיבדק הוא שהמסך מציג את מה שיושב
 * במסד: 30 תרגילים, כל הקטגוריות, וההנחיות בעברית.
 *
 * הבדיקה החשובה כאן היא **מי מקבל כפתור עריכה**: `firestore.rules` מתירים למאמן
 * לעדכן תרגילים של הארגון בלבד. אם כפתור עריכה יופיע על תרגיל קטלוג, המאמן ימלא
 * טופס שלם ויקבל PERMISSION_DENIED.
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
import { mergeExerciseSources, suggestedTarget } from '../../lib/exercises';
import { he, t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { Exercise, ExerciseDoc } from '../../types/types';

const ORG_ID = 'org_kiryat_ono';

const catalog = JSON.parse(readFileSync('data/exercise-catalog.json', 'utf8')) as {
  exercises: (Exercise & { id: string })[];
};

const globalCatalog: ExerciseDoc[] = catalog.exercises.map((exercise) => ({ ...exercise }));

function orgExercise(id: string, overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return {
    id,
    scope: 'org',
    orgId: ORG_ID,
    name: 'תרגיל של המועדון',
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

function render(overrides: Partial<ExerciseLibraryViewProps> = {}): string {
  const props: ExerciseLibraryViewProps = {
    status: 'ready',
    exercises: globalCatalog,
    orgId: ORG_ID,
    onCreate: async () => true,
    onUpdate: async () => true,
    onSetActive: async () => true,
    busyId: null,
    feedback: null,
    ...overrides,
  };

  return renderToStaticMarkup(<ExerciseLibraryView {...props} />);
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
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
    expect(render({ exercises: [] })).toContain(he.coach.exercises.empty);
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

  it('תרגילי הקטלוג מסומנים ככאלה', () => {
    expect(html).toContain(he.coach.exercises.globalBadge);
  });
});

describe('מי ניתן לעריכה — מראה של firestore.rules', () => {
  it('בקטלוג בלבד אין אף כפתור עריכה, ויש הסבר למה', () => {
    const html = render();
    expect(countOccurrences(html, he.coach.exercises.actions.edit)).toBe(0);
    expect(html).toContain(he.coach.exercises.globalReadOnly);
  });

  it('תרגיל של המועדון מקבל עריכה והשבתה — ורק הוא', () => {
    const html = render({
      exercises: mergeExerciseSources(globalCatalog, [orgExercise('org_1')]),
    });

    expect(countOccurrences(html, he.coach.exercises.actions.edit)).toBe(1);
    expect(countOccurrences(html, he.coach.exercises.actions.deactivate)).toBe(1);
    expect(html).toContain(he.coach.exercises.orgBadge);
  });

  it('תרגיל של ארגון אחר אינו ניתן לעריכה', () => {
    const html = render({
      exercises: [orgExercise('org_other', { orgId: 'org_zzz' })],
    });
    expect(countOccurrences(html, he.coach.exercises.actions.edit)).toBe(0);
  });

  it('תרגיל מושבת מסומן ומוצע להפעלה מחדש — אין מחיקה', () => {
    const html = render({ exercises: [orgExercise('org_1', { active: false })] });
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
      'תרגיל של המועדון',
      'הנחיות של המאמן',
      t('coach.exercises.count', { shown: 30, total: 30 }),
      t('coach.exercises.count', { shown: 1, total: 1 }),
      t('coach.exercises.count', { shown: 0, total: 0 }),
    ]);

    const screens = [
      render(),
      render({ exercises: [] }),
      render({ status: 'error' }),
      render({ exercises: [orgExercise('org_1', { active: false })] }),
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
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
