/**
 * טסטי רינדור למסך התוכנית.
 *
 * מה שנבדק כאן הוא **מה המסך מציע למאמן בכל מצב**, כי זו החלטה שקל להפוך
 * בטעות ואי אפשר לתקן אחרי לחיצה:
 *
 * - אין תוכנית פעילה → כפתור *פרסום* אחד. אין "מהשבוע הנוכחי", כי אין שבוע
 *   נוכחי לעדכן, ואין "הפסקת התוכנית", כי אין מה להפסיק.
 * - יש תוכנית פעילה → **שתי** האפשרויות של PRD §7.4, כל אחת עם ההסבר שלה,
 *   ובראש המסך "תוכנית פעילה מאז [תאריך]".
 *
 * מה שלא נבדק כאן ודורש עין אנושית: הקלדה בשדות, פתיחת בורר התרגילים
 * ודיאלוגי האישור (`window.confirm`) — כולם תלויי אינטראקציה. הלוגיקה עצמה
 * נבדקת ב-`lib/plans.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Timestamp } from 'firebase/firestore';
import { PlanView } from './PlanView';
import type { PlanViewProps } from './PlanView';
import { PlanPreview } from './PlanPreview';
import { PlanExercisePicker } from './PlanExercisePicker';
import { getWeekBounds, formatIsraeliDate, getNextWeekBounds } from '../../lib/dates';
import { draftFromItems } from '../../lib/plans';
import { he, t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type {
  ExerciseDoc,
  PlanCycleDoc,
  PlanDoc,
  PlanItem,
  PlanTemplateDoc,
  TeamDoc,
} from '../../types/types';

const ORG = 'org_kiryat_ono';
const TEAM = 'team_yeladim_a';
const COACH = 'uid_coach';

/** רביעי 19.8.2026 — אמצע שבוע, כדי ששני צידי הגבול יהיו רחוקים. */
const NOW = new Date('2026-08-19T09:00:00Z');
const STAMP = Timestamp.fromMillis(1_700_000_000_000);

const ITEM: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 300,
  notes: 'מהצד הימני של הסל',
};

const team: TeamDoc = {
  id: TEAM,
  orgId: ORG,
  coachUid: COACH,
  name: 'ילדים א',
  season: '2026',
  active: true,
  settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
};

const exercise: ExerciseDoc = {
  id: 'shoot_form',
  scope: 'global',
  orgId: null,
  name: 'זריקות טכניקה מקרוב',
  category: 'זריקה',
  unit: 'count',
  description: 'מהצד הימני של הסל',
  videoUrl: null,
  tracksSuccess: false,
  successCapable: true,
  defaultTargets: { cadets_13_15: 300 },
  active: true,
};

const plan: PlanDoc = {
  id: 'plan_1',
  teamId: TEAM,
  orgId: ORG,
  status: 'active',
  effectiveFrom: Timestamp.fromDate(getWeekBounds(NOW).weekStart),
  effectiveTo: null,
  createdBy: COACH,
  createdAt: STAMP,
  items: [ITEM],
};

const cycle: PlanCycleDoc = {
  id: 'team_yeladim_a_2026-08-16',
  planId: 'plan_1',
  teamId: TEAM,
  orgId: ORG,
  weekStart: Timestamp.fromDate(getWeekBounds(NOW).weekStart),
  weekEnd: Timestamp.fromDate(getWeekBounds(NOW).weekEnd),
  itemsSnapshot: [ITEM],
  createdAt: STAMP,
};

const template: PlanTemplateDoc = {
  id: 'tpl_1',
  orgId: ORG,
  coachUid: COACH,
  name: 'שבוע לפני משחק',
  items: [ITEM],
};

function render(overrides: Partial<PlanViewProps> = {}): string {
  const props: PlanViewProps = {
    status: 'ready',
    teams: [team],
    selectedTeamId: TEAM,
    onSelectTeam: () => {},
    exercises: [exercise],
    activePlan: null,
    currentCycle: null,
    cycleError: false,
    now: NOW,
    templatesStatus: 'ready',
    templates: [],
    coachUid: COACH,
    busy: null,
    feedback: null,
    onPublish: async () => true,
    onUpdateCurrentWeek: async () => true,
    onUpdateNextWeek: async () => true,
    onStop: async () => true,
    onSaveTemplate: async () => true,
    onLoadTemplate: () => {},
    onDeleteTemplate: async () => true,
    ...overrides,
  };

  return renderToStaticMarkup(<PlanView {...props} />);
}

describe('מצבי המסך', () => {
  it('טעינה', () => {
    expect(render({ status: 'loading' })).toContain(he.coach.plan.loading);
  });

  it('שגיאה — ולא מסך ריק', () => {
    const html = render({ status: 'error' });
    expect(html).toContain(he.coach.plan.loadError);
    expect(html).not.toContain(he.coach.plan.editor.empty);
  });

  it('מאמן בלי קבוצה מקבל הסבר ולא טופס', () => {
    const html = render({ teams: [], selectedTeamId: null });
    expect(html).toContain(he.coach.plan.noTeam);
    expect(html).not.toContain(he.coach.plan.publish.button);
  });
});

describe('אין תוכנית פעילה', () => {
  const html = render();

  it('מצב התוכנית אומר במפורש שאין תוכנית', () => {
    expect(html).toContain(he.coach.plan.status.none);
  });

  it('מוצע פרסום — ולא אחת משתי אפשרויות העדכון', () => {
    expect(html).toContain(he.coach.plan.publish.button);
    expect(html).not.toContain(he.coach.plan.update.currentWeek);
    expect(html).not.toContain(he.coach.plan.update.nextWeek);
  });

  it('אין "הפסקת התוכנית" כשאין מה להפסיק', () => {
    expect(html).not.toContain(he.coach.plan.stop.button);
  });

  it('הטופס ריק ומזמין להוסיף תרגיל מהספרייה', () => {
    expect(html).toContain(he.coach.plan.editor.empty);
    expect(html).toContain(he.coach.plan.editor.addToggle);
  });
});

describe('יש תוכנית פעילה', () => {
  const html = render({ activePlan: plan, currentCycle: cycle });

  it('מוצג "תוכנית פעילה מאז" עם תאריך תחילת השבוע', () => {
    expect(html).toContain(
      t('coach.plan.status.activeSince', {
        date: formatIsraeliDate(getWeekBounds(NOW).weekStart),
      }),
    );
  });

  it('מוצג טווח השבוע הנוכחי', () => {
    expect(html).toContain(
      t('coach.plan.status.week', {
        start: formatIsraeliDate(getWeekBounds(NOW).weekStart),
        end: formatIsraeliDate(getWeekBounds(NOW).weekEnd),
      }),
    );
  });

  it('שתי אפשרויות העדכון מוצגות, כל אחת עם ההסבר שלה', () => {
    expect(html).toContain(he.coach.plan.update.currentWeek);
    expect(html).toContain(he.coach.plan.update.currentWeekHint);
    expect(html).toContain(he.coach.plan.update.nextWeek);
    expect(html).toContain(
      t('coach.plan.update.nextWeekHint', {
        date: formatIsraeliDate(getNextWeekBounds(NOW).weekStart),
      }),
    );
  });

  it('אין כפתור פרסום כשכבר יש תוכנית', () => {
    expect(html).not.toContain(he.coach.plan.publish.button);
  });

  it('הפריטים של התוכנית טעונים בטופס עם היעד שלהם', () => {
    expect(html).toContain(ITEM.exerciseName);
    expect(html).toContain('value="300"');
  });

  it('מוסבר שהצילום השבועי הוא שמגן על ההיסטוריה', () => {
    expect(html).toContain(he.coach.plan.status.snapshotNote);
  });

  it('מחזור פתוח מול מחזור שטרם נפתח — שתי הודעות שונות', () => {
    expect(html).toContain(he.coach.plan.status.cycleOpen);
    expect(render({ activePlan: plan, currentCycle: null })).toContain(
      he.coach.plan.status.cyclePending,
    );
  });

  it('כשלון בפתיחת המחזור מוצג כשגיאה ולא כשקט', () => {
    expect(render({ activePlan: plan, cycleError: true })).toContain(
      he.coach.plan.status.cycleFailed,
    );
  });

  it('בלי שינויים אין מה לשמור, וזה נאמר', () => {
    expect(html).toContain(he.coach.plan.update.noChanges);
  });
});

describe('תצוגה מקדימה ותבניות', () => {
  it('התצוגה המקדימה מציגה 0 מתוך היעד — כך נראה תחילת שבוע', () => {
    const previewHtml = renderToStaticMarkup(<PlanPreview items={draftFromItems([ITEM])} />);

    expect(previewHtml).toContain(
      t('coach.plan.preview.progress', {
        target: '300',
        unit: t(`units.${ITEM.unit}` as TranslationKey),
      }),
    );
    expect(previewHtml).toContain(he.coach.plan.preview.overall);
    expect(previewHtml).toContain(ITEM.notes);
  });

  it('תבנית של המאמן ניתנת למחיקה; של מאמן אחר — לטעינה בלבד', () => {
    const mine = render({ templates: [template] });
    expect(mine).toContain(he.coach.plan.templates.load);
    expect(mine).toContain(he.coach.plan.templates.delete);

    const others = render({ templates: [{ ...template, coachUid: 'uid_other' }] });
    expect(others).toContain(he.coach.plan.templates.ownerOnly);
    expect(others).not.toContain(he.coach.plan.templates.delete);
  });
});

describe('בורר התרגילים', () => {
  const inactive: ExerciseDoc = { ...exercise, id: 'ex_off', name: 'תרגיל מושבת', active: false };

  const pickerHtml = renderToStaticMarkup(
    <PlanExercisePicker
      exercises={[exercise, inactive]}
      chosenIds={[]}
      onAdd={() => {}}
      onClose={() => {}}
    />,
  );

  it('תרגיל מושבת לא מוצע לתוכנית', () => {
    expect(pickerHtml).toContain(exercise.name);
    expect(pickerHtml).not.toContain(inactive.name);
  });

  it('תרגיל שכבר בתוכנית מסומן ואי אפשר להוסיף אותו שוב', () => {
    const chosenHtml = renderToStaticMarkup(
      <PlanExercisePicker
        exercises={[exercise]}
        chosenIds={[exercise.id]}
        onAdd={() => {}}
        onClose={() => {}}
      />,
    );

    expect(chosenHtml).toContain(he.coach.plan.editor.alreadyAdded);
    expect(chosenHtml).not.toContain(he.coach.plan.editor.add);
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט עברי במסך מגיע מ-i18n/he.ts או מהמסד', () => {
    const html = render({ activePlan: plan, currentCycle: cycle, templates: [template] });

    const fromDatabase = [
      team.name,
      template.name,
      exercise.name,
      exercise.category,
      exercise.description,
      ITEM.exerciseName,
      ITEM.notes,
    ];

    const withParams = [
      t('coach.plan.status.week', {
        start: formatIsraeliDate(getWeekBounds(NOW).weekStart),
        end: formatIsraeliDate(getWeekBounds(NOW).weekEnd),
      }),
      t('coach.plan.status.activeSince', {
        date: formatIsraeliDate(getWeekBounds(NOW).weekStart),
      }),
      t('coach.plan.status.itemsCount', { count: 1 }),
      t('coach.plan.update.nextWeekHint', {
        date: formatIsraeliDate(getNextWeekBounds(NOW).weekStart),
      }),
      t('coach.plan.editor.position', { index: 1, total: 1 }),
      t('coach.plan.editor.target', { unit: t('units.count') }),
      t('coach.plan.editor.targetSuggestion', { target: 300 }),
      t('coach.plan.preview.progress', { target: '300', unit: t('units.count') }),
      t('coach.plan.templates.itemsCount', { count: 1 }),
      t('coach.exercises.count', { shown: 1, total: 1 }),
    ];

    expect(unknownHebrewText(html, dictionaryStrings([...fromDatabase, ...withParams]))).toEqual(
      [],
    );
  });
});
