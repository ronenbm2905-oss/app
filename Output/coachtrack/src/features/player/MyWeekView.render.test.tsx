/**
 * טסטי רינדור למסך "השבוע שלי".
 *
 * מה שנבדק כאן הוא **מה השחקן רואה בכל מצב**, כי זה מה שקובע אם הוא ידווח:
 *
 * - אין מחזור → "אין תוכנית לשבוע זה", בלי טבעת ובלי כרטיסים. **לא 0%.**
 * - יש מחזור → הטבעת הכללית חסומה ב-100 בעוד כרטיס התרגיל מציג 300%
 *   (מלכודת 3) — שני מספרים שונים על אותו מסך, וזו בדיוק הכוונה.
 * - דיווח ישן → כפתורי העריכה נעלמים ובמקומם הסבר, כמראה של חלון 7 הימים
 *   ב-`firestore.rules`.
 *
 * מה שלא נבדק כאן ודורש עין אנושית: פתיחת חלון הדיווח, הקלדה, ולחיצה על
 * כפתורי הקיצור — כולם תלויי אינטראקציה. הלוגיקה עצמה ב-`lib/entries.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { MyWeekView } from './MyWeekView';
import type { MyWeekViewProps } from './MyWeekView';
import { EDIT_WINDOW_DAYS, entryDateForDay, summarizeWeek } from '../../lib/entries';
import { formatIsraeliDate, getWeekKey } from '../../lib/dates';
import { he, t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { EntryDoc, PlanItem } from '../../types/types';

/** חמישי 20.8.2026 — נשארו שני ימים לסוף השבוע. */
const NOW = new Date('2026-08-20T09:00:00Z');
const WEEK = getWeekKey(NOW);
const TEAM_NAME = 'ילדים א';

const SHOOTING: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 500,
  notes: 'מהצד הימני של הסל',
};

const STANCE: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'החזקת עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

let seq = 0;

function entry(overrides: Partial<EntryDoc> = {}): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid: 'uid_player',
    teamId: 'team_yeladim_a',
    orgId: 'org_kiryat_ono',
    cycleId: `team_yeladim_a_${WEEK}`,
    exerciseId: SHOOTING.exerciseId,
    amount: 100,
    successAmount: null,
    date: entryDateForDay('2026-08-19'),
    note: '',
    createdAt: Timestamp.fromDate(NOW),
    createdBy: 'uid_player',
    deleted: false,
    ...overrides,
  };
}

function render(overrides: Partial<MyWeekViewProps> = {}): string {
  const weekEntries = overrides.weekEntries ?? [];

  const props: MyWeekViewProps = {
    status: 'ready',
    teamName: TEAM_NAME,
    hasTeam: true,
    now: NOW,
    summary: summarizeWeek(WEEK, [SHOOTING], weekEntries, 80, `team_yeladim_a_${WEEK}`),
    weekEntries,
    cycleError: false,
    reportBusy: false,
    reportError: null,
    busyEntryId: null,
    feedback: null,
    onCreate: async () => true,
    onUpdate: async () => true,
    onDelete: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(
    <MemoryRouter>
      <MyWeekView {...props} />
    </MemoryRouter>,
  );
}

describe('מצבים', () => {
  it('שחקן בלי קבוצה מקבל הסבר, לא מסך ריק', () => {
    const html = render({ hasTeam: false });
    expect(html).toContain(he.player.myWeek.noTeam);
    expect(html).not.toContain(he.player.myWeek.exercisesTitle);
  });

  it('טעינה ושגיאה הם שני מסכים שונים', () => {
    expect(render({ status: 'loading' })).toContain(he.player.myWeek.loading);
    expect(render({ status: 'error' })).toContain(he.player.myWeek.loadError);
  });

  it('כשל בפתיחת המחזור מוצג בנפרד מכשל בטעינה', () => {
    const html = render({ cycleError: true });
    expect(html).toContain(he.player.myWeek.cycleFailed);
  });
});

describe('אין תוכנית לשבוע', () => {
  const noPlan = summarizeWeek(WEEK, null, [], 80);

  it('מוצגת הודעה ולא אחוז 0', () => {
    const html = render({ summary: noPlan });
    expect(html).toContain(he.player.myWeek.noPlan);
    expect(html).not.toContain(he.player.myWeek.exercisesTitle);
    expect(html).not.toContain(he.player.myWeek.overallHint);
  });

  it('דיווחים שנרשמו בכל זאת לא נעלמים', () => {
    const stray = entry({ amount: 30 });
    const html = render({
      summary: summarizeWeek(WEEK, null, [stray], 80),
      weekEntries: [stray],
    });

    expect(html).toContain(he.player.myWeek.noPlanEntries);
    expect(html).toContain(he.player.log.title);
  });
});

describe('שבוע עם תוכנית', () => {
  it('הכותרת מציגה קבוצה, טווח שבוע וכמה ימים נשארו', () => {
    const html = render();
    expect(html).toContain(TEAM_NAME);
    expect(html).toContain(
      t('player.myWeek.weekRange', { start: '16.08.2026', end: '22.08.2026' }),
    );
    expect(html).toContain(t('player.myWeek.daysLeft', { count: 3 }));
  });

  it('כרטיס התרגיל מציג 300 מתוך 500, בר, ואחוז', () => {
    const html = render({ weekEntries: [entry({ amount: 300 })] });

    expect(html).toContain(SHOOTING.exerciseName);
    expect(html).toContain(
      t('player.myWeek.progress', { total: 300, target: 500, unit: he.units.count }),
    );
    expect(html).toContain(t('player.myWeek.remaining', { remaining: 200, unit: he.units.count }));
    expect(html).toContain('60%');
    expect(html).toContain('role="progressbar"');
  });

  it('שלושה דיווחים באותו תרגיל מצטברים לכרטיס אחד', () => {
    const entries = [entry({ amount: 100 }), entry({ amount: 150 }), entry({ amount: 50 })];
    const html = render({ weekEntries: entries });

    expect(html).toContain(
      t('player.myWeek.progress', { total: 300, target: 500, unit: he.units.count }),
    );
    expect(html).toContain(t('player.myWeek.entryCount', { count: 3 }));
  });

  it('דיווח אחד מנוסח ביחיד ולא כ"1 דיווחים"', () => {
    const html = render({ weekEntries: [entry({ amount: 100 })] });
    expect(html).toContain(he.player.myWeek.entryCountOne);
    expect(html).not.toContain(t('player.myWeek.entryCount', { count: 1 }));
  });

  it('הטבעת חסומה ב-100 והכרטיס לא — מלכודת 3 על מסך אחד', () => {
    const entries = [entry({ amount: 1500 })];
    const html = render({
      summary: summarizeWeek(WEEK, [SHOOTING, STANCE], entries, 80),
      weekEntries: entries,
    });

    expect(html).toContain('300%'); // הכרטיס
    expect(html).toContain('50%'); // הטבעת: (100 + 0) / 2
    expect(html).toContain(he.player.myWeek.done);
  });

  it('ההנחיות של המאמן מופיעות בכרטיס', () => {
    const html = render();
    expect(html).toContain(he.player.myWeek.showInstructions);
    expect(html).toContain(SHOOTING.notes);
  });

  it('תרגיל בלי הנחיות מקבל משפט במקום שדה ריק', () => {
    const html = render({ summary: summarizeWeek(WEEK, [STANCE], [], 80) });
    expect(html).toContain(he.player.myWeek.noInstructions);
  });
});

describe('יומן הדיווחים — עריכה ומחיקה', () => {
  it('שבוע ריק מסביר שאין עדיין דיווחים', () => {
    expect(render()).toContain(he.player.log.empty);
  });

  it('דיווח טרי מקבל כפתורי עריכה ומחיקה', () => {
    const html = render({ weekEntries: [entry({ note: 'התאמנתי בפארק' })] });

    expect(html).toContain(t('player.log.amount', { amount: 100, unit: he.units.count }));
    expect(html).toContain(formatIsraeliDate(entryDateForDay('2026-08-19')));
    expect(html).toContain('התאמנתי בפארק');
    expect(html).toContain(he.player.log.edit);
    expect(html).toContain(he.player.log.delete);
  });

  it('דיווח שנרשם לפני יותר מ-7 ימים — הכפתורים נעלמים ומופיע הסבר', () => {
    const day = 24 * 60 * 60 * 1000;
    const old = entry({ createdAt: Timestamp.fromMillis(NOW.getTime() - 9 * day) });
    const html = render({ weekEntries: [old] });

    expect(html).toContain(t('player.log.locked', { days: EDIT_WINDOW_DAYS }));
    expect(html).not.toContain(he.player.log.edit);
  });

  it('דיווח על תרגיל שהוסר מהתוכנית מסומן', () => {
    const html = render({ weekEntries: [entry({ exerciseId: 'gone' })] });
    expect(html).toContain(he.player.log.offPlan);
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט על המסך מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      TEAM_NAME,
      SHOOTING.exerciseName,
      SHOOTING.notes,
      'התאמנתי בפארק',
      t('player.myWeek.weekRange', { start: '16.08.2026', end: '22.08.2026' }),
      t('player.myWeek.daysLeft', { count: 3 }),
      t('player.myWeek.progress', { total: 300, target: 500, unit: he.units.count }),
      t('player.myWeek.remaining', { remaining: 200, unit: he.units.count }),
      t('player.myWeek.entryCount', { count: 1 }),
      t('player.log.amount', { amount: 100, unit: he.units.count }),
      t('player.log.amount', { amount: 300, unit: he.units.count }),
      t('player.log.locked', { days: EDIT_WINDOW_DAYS }),
    ]);

    const screens = [
      render({ weekEntries: [entry({ amount: 300, note: 'התאמנתי בפארק' })] }),
      render({ summary: summarizeWeek(WEEK, null, [], 80) }),
      render({ hasTeam: false }),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
