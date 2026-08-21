/**
 * טסטי רינדור לחלון הדיווח.
 *
 * שלושה דברים שנבדקים כאן ולא במקום אחר:
 *
 * 1. **כפתורי הקיצור נגזרים מהיעד** — יעד 500 חייב להראות בדיוק
 *    `+10 / +25 / +50 / +100`, מה שה-PRD מדגים. ערכים קשיחים בקוד היו עוברים
 *    את הטסט הזה בטעות, ולכן יש גם בדיקה ליעד קטן.
 * 2. **בורר התאריך מציע 8 אפשרויות בלבד** — היום ועד 7 ימים אחורה. כל דבר
 *    מעבר לזה ייחסם ב-`firestore.rules`, ומסך שמציע פעולה שתיחסם הוא באג.
 * 3. **טקסט העזר של ההערה מופיע** — מיתון דגל M1 של עדי (21.8.2026). הבדיקה
 *    כאן היא מה שיתפוס מחיקה של המשפט הזה בעריכה עתידית.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportDialog } from './ReportDialog';
import type { ReportDialogProps } from './ReportDialog';
import { MAX_BACKDATE_DAYS, NOTE_MAX_LENGTH, newEntryDraft } from '../../lib/entries';
import { he, t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';

const NOW = new Date('2026-08-20T09:00:00Z');
const EXERCISE = 'זריקות טכניקה מקרוב';

function render(overrides: Partial<ReportDialogProps> = {}): string {
  const props: ReportDialogProps = {
    mode: 'create',
    exerciseName: EXERCISE,
    unit: 'count',
    target: 500,
    initialDraft: newEntryDraft(NOW),
    now: NOW,
    busy: false,
    error: null,
    onSubmit: async () => true,
    onClose: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(<ReportDialog {...props} />);
}

describe('חלון הדיווח', () => {
  it('הכותרת נושאת את שם התרגיל ואת היעד', () => {
    const html = render();
    expect(html).toContain(t('player.report.title', { exercise: EXERCISE }));
    expect(html).toContain(t('player.report.targetLine', { target: 500, unit: he.units.count }));
    expect(html).toContain('aria-modal="true"');
  });

  it('שדה הכמות פותח מקלדת מספרית', () => {
    const html = render();
    // React 19 פולט את שם התכונה כמו שהוא; HTML אינו רגיש לרישיות בשמות תכונות.
    expect(html.toLowerCase()).toContain('inputmode="numeric"');
    expect(html).toContain(t('player.report.amount', { unit: he.units.count }));
  });

  it('כפתורי הקיצור של יעד 500 הם +10 / +25 / +50 / +100', () => {
    const html = render();
    for (const value of [10, 25, 50, 100]) {
      expect(html).toContain(t('player.report.quickAddValue', { value }));
    }
  });

  it('יעד קטן מקבל כפתורים אחרים — הם נגזרים ולא קשיחים', () => {
    const html = render({ target: 15, unit: 'minutes' });
    expect(html).toContain(t('player.report.quickAddValue', { value: 15 }));
    expect(html).not.toContain(t('player.report.quickAddValue', { value: 100 }));
  });

  it('תרגיל בלי יעד — בלי כפתורי קיצור ובלי שורת יעד', () => {
    const html = render({ target: null });
    expect(html).not.toContain(he.player.report.quickAdd);
  });

  it('בורר התאריך מציע את היום ועוד שבעה ימים אחורה בלבד', () => {
    const html = render();
    const options = html.match(/<option/g) ?? [];

    expect(options).toHaveLength(MAX_BACKDATE_DAYS + 1);
    expect(html).toContain(he.player.report.today);
    expect(html).toContain(he.player.report.yesterday);
    expect(html).toContain(t('player.report.daysAgo', { count: 7 }));
    expect(html).toContain(t('player.report.dateHint', { days: MAX_BACKDATE_DAYS }));
  });

  it('התאריך שנבחר מוצג במפורש, כדי שדיווח רטרואקטיבי לא ייעשה בטעות', () => {
    const html = render({ initialDraft: { amount: '', dayKey: '2026-08-17', note: '' } });
    expect(html).toContain(t('player.report.dateChosen', { date: '17.08.2026' }));
  });

  it('שדה ההערה נושא את ההנחיה המגבילה — מיתון דגל M1', () => {
    const html = render();
    expect(html).toContain(he.player.report.noteHint);
    expect(html.toLowerCase()).toContain(`maxlength="${NOTE_MAX_LENGTH}"`);
  });

  it('מצב עריכה מציג כותרת וכפתור אחרים', () => {
    const html = render({ mode: 'edit', initialDraft: { amount: '40', dayKey: '2026-08-18', note: '' } });
    expect(html).toContain(t('player.report.editTitle', { exercise: EXERCISE }));
    expect(html).toContain(he.player.report.submitEdit);
    expect(html).toContain('value="40"');
  });

  it('שגיאה מהשרת מוצגת בתוך החלון', () => {
    const html = render({ error: he.player.report.errors.saveFailed });
    expect(html).toContain(he.player.report.errors.saveFailed);
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט בחלון מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      EXERCISE,
      t('player.report.title', { exercise: EXERCISE }),
      t('player.report.targetLine', { target: 500, unit: he.units.count }),
      t('player.report.amount', { unit: he.units.count }),
      t('player.report.dateHint', { days: MAX_BACKDATE_DAYS }),
      t('player.report.dateChosen', { date: '20.08.2026' }),
      ...[1, 2, 3, 4, 5, 6, 7].map((count) => t('player.report.daysAgo', { count })),
    ]);

    expect(unknownHebrewText(render(), known)).toEqual([]);
  });
});
