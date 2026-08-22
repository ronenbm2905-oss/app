/**
 * טסטים ל-lib/report.ts — הדוח השבועי והודעת הוואטסאפ.
 *
 * ## למה דווקא כאן נדרשים טסטים ולא בעין
 *
 * הודעת הוואטסאפ היא הפלט היחיד במערכת ש**אף אחד לא רואה מול הנתונים**: היא
 * נוצרת, מועתקת ללוח, ונקראת בקבוצה אחרת לגמרי. אם שחקן ב-100% ייפול בטעות
 * ל"צריך דחיפה", או אם ממוצע ישתנה בין המסך להודעה — זה יתגלה רק כשהורה
 * ישאל למה. לכן כל סף, כל קיבוץ וכל מקרה קצה נבדק כאן.
 *
 * מקרי הקצה שנבדקים במפורש: אפס שחקנים, כולם ב-0%, כולם ב-100%, ושבוע קודם
 * שלא קיים.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  MAX_REPORT_WEEKS,
  buildPlayerWhatsAppText,
  buildTeamWhatsAppText,
  buildWeeklyReport,
  formatTargetPhrase,
  groupPlayers,
  playerDetail,
  rangeForKind,
  weekKeysInRange,
  type ReportRange,
} from './report';
import { PCT_TONE_HIGH } from './calculations';
import { entryDateForDay } from './entries';
import { formatIsraeliDayRange, getWeekKey, israeliWallTime } from './dates';
import type { MatrixPlayer } from './dashboard';
import type { EntryDoc, PlanCycleDoc, PlanItem } from '../types/types';

/* ------------------------------------------------------------------ */
/* נתוני בדיקה                                                         */
/* ------------------------------------------------------------------ */

/** חמישי 20.8.2026. שבוע: ראשון 16.8 עד שבת 22.8. */
const NOW = new Date('2026-08-20T09:00:00Z');
const WEEK = getWeekKey(NOW); // '2026-08-16'
const PREV_WEEK = '2026-08-09';

const TEAM_ID = 'team_yeladim_a';
const ORG_ID = 'org_kiryat_ono';

const SHOOTING: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 500,
  notes: '',
};

const STANCE: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'החזקת עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

function cycle(weekKey: string, items: PlanItem[]): PlanCycleDoc {
  return {
    id: `${TEAM_ID}_${weekKey}`,
    planId: 'plan_1',
    teamId: TEAM_ID,
    orgId: ORG_ID,
    weekStart: Timestamp.fromDate(israeliWallTime(weekKey, '00:00:00.000')),
    weekEnd: Timestamp.fromDate(israeliWallTime(weekKey, '23:59:59.999')),
    itemsSnapshot: items,
    createdAt: Timestamp.fromDate(NOW),
  };
}

let seq = 0;

function entry(playerUid: string, dayKey: string, amount: number, item = SHOOTING): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid,
    teamId: TEAM_ID,
    orgId: ORG_ID,
    cycleId: `${TEAM_ID}_${getWeekKey(israeliWallTime(dayKey, '12:00:00.000'))}`,
    exerciseId: item.exerciseId,
    amount,
    successAmount: null,
    date: entryDateForDay(dayKey),
    note: '',
    createdAt: Timestamp.fromDate(NOW),
    createdBy: playerUid,
    deleted: false,
  };
}

const DANIEL: MatrixPlayer = { uid: 'uid_daniel', displayName: 'דניאל כ' };
const YONATAN: MatrixPlayer = { uid: 'uid_yonatan', displayName: 'יונתן ל' };
const OMER: MatrixPlayer = { uid: 'uid_omer', displayName: 'עומר ב' };

const CURRENT_RANGE: ReportRange = { kind: 'current', from: WEEK, to: '2026-08-22' };

/* ------------------------------------------------------------------ */
/* טווחים                                                              */
/* ------------------------------------------------------------------ */

describe('טווח הדוח', () => {
  it('"השבוע הנוכחי" הוא ראשון עד שבת של השבוע שבו נמצאים', () => {
    expect(rangeForKind('current', NOW)).toEqual({
      kind: 'current',
      from: '2026-08-16',
      to: '2026-08-22',
    });
  });

  it('"השבוע הקודם" הוא שבעה ימים אחורה, ולא "מינוס 7 ימים מהיום"', () => {
    // ההבדל מהותי: חמישי מינוס 7 היה נותן חמישי-עד-חמישי, טווח שחוצה שני שבועות.
    expect(rangeForKind('previous', NOW)).toEqual({
      kind: 'previous',
      from: '2026-08-09',
      to: '2026-08-15',
    });
  });

  it('טווח של יום אחד נצמד לשבוע השלם שמכיל אותו', () => {
    // היעדים שבועיים — אין דבר כזה "יעד ליום רביעי".
    expect(weekKeysInRange({ kind: 'custom', from: '2026-08-19', to: '2026-08-19' })).toEqual([
      WEEK,
    ]);
  });

  it('טווח על פני שלושה שבועות מחזיר שלושה מפתחות, מהישן לחדש', () => {
    expect(weekKeysInRange({ kind: 'custom', from: '2026-08-05', to: '2026-08-20' })).toEqual([
      '2026-08-02',
      '2026-08-09',
      '2026-08-16',
    ]);
  });

  it('תאריכים הפוכים מתוקנים ולא מפילים', () => {
    expect(weekKeysInRange({ kind: 'custom', from: '2026-08-20', to: '2026-08-05' })).toEqual([
      '2026-08-02',
      '2026-08-09',
      '2026-08-16',
    ]);
  });

  it('טווח אבסורדי נחסם בתקרה ולא מייצר לולאה של אלפי שבועות', () => {
    const keys = weekKeysInRange({ kind: 'custom', from: '1990-01-01', to: '2026-08-20' });
    expect(keys).toHaveLength(MAX_REPORT_WEEKS);
  });
});

/* ------------------------------------------------------------------ */
/* בניית הדוח                                                          */
/* ------------------------------------------------------------------ */

describe('בניית הדוח', () => {
  it('שבוע יחיד: האחוזים זהים לאלה שהדשבורד מציג', () => {
    const report = buildWeeklyReport({
      players: [DANIEL, YONATAN, OMER],
      cycles: [cycle(WEEK, [SHOOTING])],
      entries: [
        entry(DANIEL.uid, '2026-08-18', 500),
        entry(YONATAN.uid, '2026-08-18', 460),
        entry(OMER.uid, '2026-08-18', 225),
      ],
      range: CURRENT_RANGE,
    });

    expect(report.plannedWeekCount).toBe(1);
    expect(report.players.map((player) => [player.displayName, Math.round(player.pct)])).toEqual([
      ['דניאל כ', 100],
      ['יונתן ל', 92],
      ['עומר ב', 45],
    ]);
    expect(Math.round(report.averagePct)).toBe(79);
    expect(report.reportedCount).toBe(3);
    expect(report.zeroCount).toBe(0);
  });

  it('דיווח מחוק-רכות לא נספר', () => {
    const deleted = { ...entry(DANIEL.uid, '2026-08-18', 500), deleted: true };
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(WEEK, [SHOOTING])],
      entries: [deleted],
      range: CURRENT_RANGE,
    });

    expect(report.players[0].pct).toBe(0);
    expect(report.reportedCount).toBe(0);
  });

  it('דיווח בשבוע אחר לא זולג לדוח', () => {
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(WEEK, [SHOOTING])],
      entries: [entry(DANIEL.uid, '2026-08-15', 500)], // שבת של השבוע הקודם
      range: CURRENT_RANGE,
    });

    expect(report.players[0].pct).toBe(0);
  });

  it('שבוע בלי מחזור אינו 0% — הוא פשוט לא נכנס לממוצע', () => {
    // דניאל עשה 100% בשבוע עם תוכנית; בשבוע שלפניו לא הייתה תוכנית בכלל.
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(WEEK, [SHOOTING])],
      entries: [entry(DANIEL.uid, '2026-08-18', 500)],
      range: { kind: 'custom', from: PREV_WEEK, to: '2026-08-22' },
    });

    expect(report.weeks).toHaveLength(2);
    expect(report.weeks.map((week) => week.hasPlan)).toEqual([false, true]);
    expect(report.plannedWeekCount).toBe(1);
    expect(report.players[0].weeksCounted).toBe(1);
    // 100 ולא 50: הממוצע הוא על שבוע אחד, לא על שניים.
    expect(report.players[0].pct).toBe(100);
  });

  it('טווח רב-שבועי: היעדים מסתכמים והממוצע הוא ממוצע השבועות', () => {
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(PREV_WEEK, [SHOOTING]), cycle(WEEK, [SHOOTING])],
      entries: [
        entry(DANIEL.uid, '2026-08-11', 250), // 50%
        entry(DANIEL.uid, '2026-08-18', 500), // 100%
      ],
      range: { kind: 'custom', from: PREV_WEEK, to: '2026-08-22' },
    });

    expect(report.exercises[0].target).toBe(1000);
    expect(report.exercises[0].total).toBe(750);
    expect(report.players[0].pct).toBe(75);
  });

  it('חסימת 100% נשמרת בממוצע אבל לא בפירוט האישי', () => {
    // 1500 מתוך 500 בזריקות, 0 בעמידת הגנה — הממוצע הוא 50, לא 150.
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(WEEK, [SHOOTING, STANCE])],
      entries: [entry(DANIEL.uid, '2026-08-18', 1500)],
      range: CURRENT_RANGE,
    });

    expect(report.players[0].pct).toBe(50);

    const detail = playerDetail(report, DANIEL.uid);
    expect(detail?.items.map((item) => Math.round(item.pct))).toEqual([300, 0]);
  });

  it('שחקן שאינו בקבוצה מחזיר null בפירוט', () => {
    const report = buildWeeklyReport({
      players: [DANIEL],
      cycles: [cycle(WEEK, [SHOOTING])],
      entries: [],
      range: CURRENT_RANGE,
    });

    expect(playerDetail(report, 'uid_לא_קיים')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* קיבוץ                                                               */
/* ------------------------------------------------------------------ */

describe('קיבוץ לשלוש הקבוצות', () => {
  const row = (displayName: string, pct: number, weeksCounted = 1) => ({
    uid: displayName,
    displayName,
    pct,
    weeksCounted,
    reportedWeeks: 1,
  });

  it('הסף בין "מעל 80%" ל"צריך דחיפה" זהה לסף הצבע בטבלה', () => {
    const groups = groupPlayers([row('גבול', PCT_TONE_HIGH), row('מתחת', PCT_TONE_HIGH - 0.1)]);

    expect(groups.strong.map((player) => player.displayName)).toEqual(['גבול']);
    expect(groups.push.map((player) => player.displayName)).toEqual(['מתחת']);
  });

  it('99.6% הוא "השלימו 100%" — מה שמוצג הוא מה שמקבץ', () => {
    // האחוז מעוגל לתצוגה; שחקן שמוצג כ-100% ומופיע ב"מעל 80%" נראה כמו באג.
    expect(groupPlayers([row('כמעט', 99.6)]).done).toHaveLength(1);
    expect(groupPlayers([row('כמעט', 99.4)]).strong).toHaveLength(1);
  });

  it('שחקן בלי שבוע נמדד אינו נחשב 0% ואינו מופיע באף קבוצה', () => {
    const groups = groupPlayers([row('חדש', 0, 0)]);
    expect(groups.done).toHaveLength(0);
    expect(groups.strong).toHaveLength(0);
    expect(groups.push).toHaveLength(0);
  });

  it('בתוך קבוצה — מהגבוה לנמוך, כמו בדוגמה ב-PRD', () => {
    const groups = groupPlayers([row('נמוך', 85), row('גבוה', 92)]);
    expect(groups.strong.map((player) => player.displayName)).toEqual(['גבוה', 'נמוך']);
  });
});

/* ------------------------------------------------------------------ */
/* טווח התאריכים בכותרת                                                */
/* ------------------------------------------------------------------ */

describe('טווח התאריכים בכותרת', () => {
  it('אותו חודש → 16–22.8, כמו הפורמט ב-PRD', () => {
    const from = israeliWallTime('2026-08-16', '00:00:00.000');
    const to = israeliWallTime('2026-08-22', '23:59:59.999');
    expect(formatIsraeliDayRange(from, to)).toBe('16–22.8');
  });

  it('חודשים שונים → 30.8–5.9', () => {
    const from = israeliWallTime('2026-08-30', '00:00:00.000');
    const to = israeliWallTime('2026-09-05', '23:59:59.999');
    expect(formatIsraeliDayRange(from, to)).toBe('30.8–5.9');
  });

  it('שנים שונות → כולל שנה', () => {
    const from = israeliWallTime('2026-12-27', '00:00:00.000');
    const to = israeliWallTime('2027-01-02', '23:59:59.999');
    expect(formatIsraeliDayRange(from, to)).toBe('27.12.26–2.1.27');
  });

  it('סוף השבוע נשאר שבת גם כשהטסט רץ ב-UTC', () => {
    // vitest.config.mts מקבע TZ=UTC. שבת 23:59 בישראל היא שבת 20:59 ב-UTC,
    // אבל חישוב בשעון המכשיר על מכשיר מערבה מכאן היה מדפיס 21 במקום 22.
    const bounds = israeliWallTime('2026-08-22', '23:59:59.999');
    expect(formatIsraeliDayRange(israeliWallTime(WEEK, '00:00:00.000'), bounds)).toBe('16–22.8');
  });
});

/* ------------------------------------------------------------------ */
/* ניסוח היעד                                                          */
/* ------------------------------------------------------------------ */

describe('ניסוח היעד בשורת התוכנית', () => {
  it('count ו-sessions: המספר צמוד לשם, בדיוק כמו בדוגמאות ב-PRD', () => {
    expect(formatTargetPhrase(500, 'count', 'זריקות')).toBe('500 זריקות');
    expect(formatTargetPhrase(3, 'sessions', 'אימוני כוח')).toBe('3 אימוני כוח');
  });

  it('minutes ו-distance_km: היחידה נכנסת, אחרת המספר חסר משמעות', () => {
    expect(formatTargetPhrase(15, 'minutes', 'החזקת עמידת הגנה')).toBe(
      '15 דקות החזקת עמידת הגנה',
    );
    expect(formatTargetPhrase(5, 'distance_km', 'ריצה')).toBe('5 ק״מ ריצה');
  });
});

/* ------------------------------------------------------------------ */
/* הודעת הוואטסאפ הקבוצתית                                             */
/* ------------------------------------------------------------------ */

function teamReport(entries: EntryDoc[], players = [DANIEL, YONATAN, OMER]) {
  return buildWeeklyReport({
    players,
    cycles: [cycle(WEEK, [SHOOTING])],
    entries,
    range: CURRENT_RANGE,
  });
}

describe('הודעת הוואטסאפ הקבוצתית', () => {
  it('המבנה המלא לפי PRD §7.3ה', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([
        entry(DANIEL.uid, '2026-08-18', 500),
        entry(YONATAN.uid, '2026-08-18', 460),
        entry(OMER.uid, '2026-08-18', 225),
      ]),
      teamName: 'ילדים א׳',
      previousPct: 71,
    });

    expect(text).toBe(
      [
        '🏀 סיכום שבועי — ילדים א׳ | 16–22.8',
        '',
        '🎯 התוכנית: 500 זריקות טכניקה מקרוב',
        '',
        '✅ השלימו 100%:',
        'דניאל כ',
        '',
        '💪 מעל 80%:',
        'יונתן ל 92%',
        '',
        '⚡ צריך דחיפה:',
        'עומר ב 45%',
        '',
        '📊 ממוצע קבוצתי: 79% (שבוע שעבר: 71%)',
      ].join('\n'),
    );
  });

  it('קבוצה ריקה לא מדפיסה כותרת ריקה ולא רווח כפול', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([entry(DANIEL.uid, '2026-08-18', 500)], [DANIEL]),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text).toContain('✅ השלימו 100%:');
    expect(text).not.toContain('💪');
    expect(text).not.toContain('⚡');
    expect(text).not.toMatch(/\n\n\n/);
  });

  it('מקרה קצה: אפס שחקנים בקבוצה — בלי ממוצע שקרי', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([], []),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text).toContain('אין עדיין שחקנים פעילים בקבוצה.');
    expect(text).not.toContain('ממוצע קבוצתי');
    expect(text).not.toContain('0%');
  });

  it('מקרה קצה: כולם ב-0% — קבוצה אחת בלבד, וממוצע 0%', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([]),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text).not.toContain('✅');
    expect(text).not.toContain('💪');
    expect(text).toContain('⚡ צריך דחיפה:');
    expect(text).toContain('דניאל כ 0% • יונתן ל 0% • עומר ב 0%');
    expect(text).toContain('📊 ממוצע קבוצתי: 0%');
  });

  it('מקרה קצה: כולם ב-100% — רשימת שמות בלי אחוזים', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([
        entry(DANIEL.uid, '2026-08-18', 500),
        entry(YONATAN.uid, '2026-08-18', 700),
        entry(OMER.uid, '2026-08-18', 500),
      ]),
      teamName: 'ילדים א׳',
      previousPct: 71,
    });

    expect(text).toContain('✅ השלימו 100%:\nדניאל כ, יונתן ל, עומר ב');
    expect(text).not.toContain('💪');
    expect(text).not.toContain('⚡');
    // 700 מתוך 500 הוא 140%, אבל הממוצע חסום — 100 ולא 113.
    expect(text).toContain('📊 ממוצע קבוצתי: 100%');
  });

  it('מקרה קצה: אין שבוע קודם — הסוגריים נשמטות ולא מודפס 0%', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([entry(DANIEL.uid, '2026-08-18', 250)]),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text).toContain('📊 ממוצע קבוצתי: 17%');
    expect(text).not.toContain('שבוע שעבר');
  });

  it('שבוע קודם של 0% כן מודפס — היעדר נתון אינו אפס', () => {
    const text = buildTeamWhatsAppText({
      report: teamReport([]),
      teamName: 'ילדים א׳',
      previousPct: 0,
    });

    expect(text).toContain('(שבוע שעבר: 0%)');
  });

  it('מקרה קצה: אין תוכנית בטווח — בלי קבוצות ובלי ממוצע', () => {
    const text = buildTeamWhatsAppText({
      report: buildWeeklyReport({
        players: [DANIEL],
        cycles: [],
        entries: [],
        range: CURRENT_RANGE,
      }),
      teamName: 'ילדים א׳',
      previousPct: 71,
    });

    expect(text).toContain('לא הייתה תוכנית פעילה בטווח הזה.');
    expect(text).not.toContain('ממוצע קבוצתי');
    expect(text).not.toContain('🎯');
  });

  it('טווח רב-שבועי מקבל כותרת אחרת — "סיכום שבועי" על חודש הוא שקר', () => {
    const text = buildTeamWhatsAppText({
      report: buildWeeklyReport({
        players: [DANIEL],
        cycles: [cycle(PREV_WEEK, [SHOOTING]), cycle(WEEK, [SHOOTING])],
        entries: [],
        range: { kind: 'custom', from: PREV_WEEK, to: '2026-08-22' },
      }),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text.startsWith('🏀 סיכום 2 שבועות — ילדים א׳ | 9–22.8')).toBe(true);
  });

  it('שני תרגילים מופיעים בשורת התוכנית מופרדים בפסיק', () => {
    const text = buildTeamWhatsAppText({
      report: buildWeeklyReport({
        players: [DANIEL],
        cycles: [cycle(WEEK, [SHOOTING, STANCE])],
        entries: [],
        range: CURRENT_RANGE,
      }),
      teamName: 'ילדים א׳',
      previousPct: null,
    });

    expect(text).toContain('🎯 התוכנית: 500 זריקות טכניקה מקרוב, 15 דקות החזקת עמידת הגנה');
  });

  it('אין רווח כפול בשום מצב', () => {
    for (const entries of [[], [entry(DANIEL.uid, '2026-08-18', 500)]]) {
      const text = buildTeamWhatsAppText({
        report: teamReport(entries),
        teamName: 'ילדים א׳',
        previousPct: null,
      });
      expect(text).not.toMatch(/\n\n\n/);
      expect(text.trim()).toBe(text);
    }
  });
});

/* ------------------------------------------------------------------ */
/* הסיכום האישי                                                        */
/* ------------------------------------------------------------------ */

describe('הסיכום האישי לשחקן בודד', () => {
  const report = buildWeeklyReport({
    players: [DANIEL, YONATAN],
    cycles: [cycle(WEEK, [SHOOTING, STANCE])],
    entries: [
      entry(DANIEL.uid, '2026-08-18', 380),
      entry(DANIEL.uid, '2026-08-19', 11, STANCE),
      entry(YONATAN.uid, '2026-08-18', 500),
    ],
    range: CURRENT_RANGE,
  });

  it('כולל שם, קבוצה, טווח, אחוז כללי ופירוט מול היעדים', () => {
    const detail = playerDetail(report, DANIEL.uid);
    expect(detail).not.toBeNull();

    const text = buildPlayerWhatsAppText({
      detail: detail!,
      teamName: 'ילדים א׳',
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
    });

    expect(text).toBe(
      [
        '🏀 סיכום שבועי — דניאל כ | ילדים א׳ | 16–22.8',
        '',
        '🎯 השלמה כללית: 75%',
        '',
        '• זריקות טכניקה מקרוב: 380 מתוך 500 (76%)',
        '• החזקת עמידת הגנה: 11 מתוך 15 דקות (73%)',
      ].join('\n'),
    );
  });

  it('אינו מדליף שום נתון של שחקן אחר', () => {
    // ⚠️ ההודעה הזו נשלחת להורה. שם של ילד אחר בתוכה הוא אירוע פרטיות.
    const text = buildPlayerWhatsAppText({
      detail: playerDetail(report, DANIEL.uid)!,
      teamName: 'ילדים א׳',
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
    });

    expect(text).not.toContain(YONATAN.displayName);
    // גם לא ממוצע קבוצתי — ראה ההסבר ב-buildPlayerWhatsAppText.
    expect(text).not.toContain('ממוצע קבוצתי');
  });

  it('שחקן בשבוע בלי תוכנית מקבל הסבר, לא 0%', () => {
    const empty = buildWeeklyReport({
      players: [DANIEL],
      cycles: [],
      entries: [],
      range: CURRENT_RANGE,
    });

    const text = buildPlayerWhatsAppText({
      detail: playerDetail(empty, DANIEL.uid)!,
      teamName: 'ילדים א׳',
      weekStart: empty.weekStart,
      weekEnd: empty.weekEnd,
    });

    expect(text).toContain('לא הייתה תוכנית פעילה בטווח הזה.');
    expect(text).not.toContain('0%');
  });

  it('שחקן שלא דיווח כלל מקבל אפסים אמיתיים, לא שורות ריקות', () => {
    const text = buildPlayerWhatsAppText({
      detail: playerDetail(report, YONATAN.uid)!,
      teamName: 'ילדים א׳',
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
    });

    expect(text).toContain('• החזקת עמידת הגנה: 0 מתוך 15 דקות (0%)');
  });
});
