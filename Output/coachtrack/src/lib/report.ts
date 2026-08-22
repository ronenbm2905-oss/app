/**
 * CoachTrack — הדוח השבועי והטקסטים להעתקה (PRD §7.3ה).
 *
 * פונקציות טהורות בלבד: אין Firestore, אין `Date.now()`, אין JSX ואין
 * `navigator.clipboard`. זו הסיבה שאפשר לבדוק כאן קיבוץ, ספים ומקרי קצה
 * בלי דפדפן — וזה בדיוק סוג הלוגיקה שנשברת בשקט, כי אף אחד לא בודק הודעת
 * וואטסאפ מול טבלה.
 *
 * ## ארבע ההחלטות שמחזיקות את הקובץ
 *
 * 1. **המספרים לא מחושבים כאן מחדש.** כל שבוע עובר דרך `buildTeamMatrix`
 *    (`lib/dashboard.ts`) — אותה פונקציה בדיוק שמזינה את הדשבורד. אילו
 *    הדוח היה מחשב לבד, "ממוצע קבוצתי 73%" בוואטסאפ היה יכול לסתור 73%
 *    שעל המסך, ואף אחד לא היה יודע מי צודק.
 *
 * 2. **טווח נצמד לשבועות שלמים.** היעדים הם שבועיים (`itemsSnapshot` של
 *    המחזור), ולכן "מה-14 עד ה-16" הוא שאלה בלי תשובה: אין יעד לשלושה
 *    ימים. טווח חופשי נפרס לשבועות שהוא נוגע בהם, והמסך מציג את התאריכים
 *    **אחרי** ההצמדה כדי שלא תהיה הפתעה.
 *
 * 3. **שבוע בלי מחזור אינו 0%.** הוא לא נכנס לממוצע בכלל — אותה הבחנה
 *    שכבר נעשתה במסך השחקן ובדשבורד (PRD §8.4): 0% אומר שלא עשו, ואין
 *    תוכנית אומר שלא ביקשו.
 *
 * 4. **הספים לקיבוץ מגיעים מ-`pctTone`**, לא ממספרים שנכתבו כאן. "מעל
 *    80%" בהודעה ו"ירוק" בטבלה חייבים להיות אותו סף; שני מקומות שמחליטים
 *    זה המקום שבו שחקן צבוע ירוק אבל מופיע ב"צריך דחיפה".
 */

import { PCT_TONE_HIGH, capPct, pctTone, roundPct } from './calculations';
import { buildTeamMatrix, type MatrixPlayer, type TeamMatrix } from './dashboard';
import { entriesForWeek } from './entries';
import {
  addDaysToDayKey,
  formatIsraeliDayRange,
  getWeekBounds,
  getWeekKey,
  israeliWallTime,
  toIsraeliDayKey,
  type DateInput,
  type DayKey,
} from './dates';
import { t } from '../i18n/he';
import type { EntryDoc, PlanCycleDoc, Unit, WeekStartDay } from '../types/types';

/* ------------------------------------------------------------------ */
/* טווח הדוח                                                           */
/* ------------------------------------------------------------------ */

/** שלוש האפשרויות מ-PRD §7.3ה. */
export type ReportRangeKind = 'current' | 'previous' | 'custom';

/**
 * טווח לדוח, כמפתחות-יום.
 *
 * מפתח-יום ולא `Date` בכוונה: זה מה שמגיע מ-`<input type="date">`, זה מה
 * שאפשר להשוות כמחרוזת, וזה מה שמונע מהטווח להישען על שעון המכשיר.
 */
export interface ReportRange {
  kind: ReportRangeKind;
  from: DayKey;
  to: DayKey;
}

/**
 * תקרה למספר השבועות בטווח חופשי.
 *
 * לא אילוץ מוצר אלא בלם: `from` שהוקלד כ-1990 היה מייצר לולאה של אלפי
 * איטרציות ו-`buildTeamMatrix` לכל אחת מהן, בתוך `useMemo` שרץ ברינדור.
 * חצי שנה מכסה כל שימוש סביר בעונה אחת.
 */
export const MAX_REPORT_WEEKS = 26;

/** הטווח שמתאים לבחירה. `custom` מקבל את השבוע הנוכחי כנקודת פתיחה. */
export function rangeForKind(kind: ReportRangeKind, now: DateInput): ReportRange {
  const { weekStart, weekEnd } = getWeekBounds(now);

  if (kind === 'previous') {
    const previousStart = addDaysToDayKey(toIsraeliDayKey(weekStart), -7);
    return {
      kind,
      from: previousStart,
      to: addDaysToDayKey(previousStart, 6),
    };
  }

  return {
    kind,
    from: toIsraeliDayKey(weekStart),
    to: toIsraeliDayKey(weekEnd),
  };
}

/**
 * מפתחות השבועות שהטווח נוגע בהם, מהישן לחדש.
 *
 * הטווח **נצמד לשבועות שלמים** (החלטה 2 בראש הקובץ), ו-`from > to` מתוקן
 * בהחלפה במקום ליפול — משתמש שבחר תאריכים הפוכים התכוון לטווח שביניהם.
 */
export function weekKeysInRange(range: ReportRange, weekStartDay: WeekStartDay = 0): DayKey[] {
  const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];

  const firstWeek = getWeekKey(israeliWallTime(from, '12:00:00.000'), weekStartDay);
  const lastWeek = getWeekKey(israeliWallTime(to, '12:00:00.000'), weekStartDay);

  const keys: DayKey[] = [];
  let current = firstWeek;
  while (current <= lastWeek && keys.length < MAX_REPORT_WEEKS) {
    keys.push(current);
    current = addDaysToDayKey(current, 7);
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* מבנה הדוח                                                           */
/* ------------------------------------------------------------------ */

/** שבוע אחד בדוח, עם המטריצה המלאה שלו. */
export interface ReportWeek {
  weekKey: DayKey;
  weekStart: Date;
  weekEnd: Date;
  /** האם נפתח מחזור לשבוע הזה. שבוע בלי מחזור אינו נכנס לממוצעים. */
  hasPlan: boolean;
  matrix: TeamMatrix;
}

/** שורת שחקן בדוח: הממוצע שלו על פני השבועות שהיה בהם מה למדוד. */
export interface ReportPlayerRow {
  uid: string;
  displayName: string;
  /** ממוצע ה-`overall` (חסום ב-100 לכל תרגיל) על השבועות עם מחזור. */
  pct: number;
  /** כמה שבועות נכנסו לממוצע. 0 = אין מה להציג עליו. */
  weeksCounted: number;
  /** בכמה שבועות בטווח דיווח לפחות פעם אחת — כולל שבועות בלי מחזור. */
  reportedWeeks: number;
}

/** שורת תרגיל בדוח, מצטברת על פני השבועות. */
export interface ReportExerciseRow {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  /** סכום היעדים השבועיים — יעד 500 על פני שלושה שבועות הוא 1500. */
  target: number;
  /** סכום מה שכל השחקנים צברו. */
  total: number;
  /** ממוצע האחוזים השבועיים החסומים. */
  avgPct: number;
}

export interface WeeklyReport {
  range: ReportRange;
  /** מהישן לחדש. ריק רק אם הטווח ריק, וזה לא קורה — תמיד יש שבוע אחד. */
  weeks: ReportWeek[];
  weekStart: Date;
  weekEnd: Date;
  /** כמה מהשבועות בטווח היה בהם מחזור. 0 = אין על מה לדווח. */
  plannedWeekCount: number;
  /** ממוין מהגבוה לנמוך, שובר-שוויון לפי שם בעברית. */
  players: ReportPlayerRow[];
  exercises: ReportExerciseRow[];
  playerCount: number;
  /** כמה שחקנים דיווחו לפחות פעם אחת בטווח. */
  reportedCount: number;
  /** כמה שחקנים על 0% — מתוך אלה שהיה להם מה למדוד. */
  zeroCount: number;
  averagePct: number;
}

interface ReportInput {
  players: readonly MatrixPlayer[];
  cycles: readonly PlanCycleDoc[];
  entries: readonly EntryDoc[];
  range: ReportRange;
  weekStartDay?: WeekStartDay;
}

/**
 * בונה את הדוח לטווח.
 *
 * `entries` הם **כל** דיווחי הקבוצה (זה מה ש-`useTeamEntries` מחזיק), והחיתוך
 * לשבוע נעשה כאן לפי `entry.date` — לא לפי `cycleId`. דיווח רטרואקטיבי שנכתב
 * לפני שנפתח מחזור נושא `cycleId: null`, וסינון לפיו היה מעלים אותו מהדוח.
 */
export function buildWeeklyReport({
  players,
  cycles,
  entries,
  range,
  weekStartDay = 0,
}: ReportInput): WeeklyReport {
  const keys = weekKeysInRange(range, weekStartDay);

  const cycleByWeek = new Map<DayKey, PlanCycleDoc>();
  for (const cycle of cycles) {
    if (!cycle.weekStart) continue;
    cycleByWeek.set(getWeekKey(cycle.weekStart, weekStartDay), cycle);
  }

  const weeks: ReportWeek[] = keys.map((weekKey) => {
    const anchor = israeliWallTime(weekKey, '12:00:00.000');
    const bounds = getWeekBounds(anchor, weekStartDay);
    const cycle = cycleByWeek.get(weekKey) ?? null;

    return {
      weekKey,
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
      hasPlan: Boolean(cycle),
      matrix: buildTeamMatrix(
        players,
        cycle ? cycle.itemsSnapshot : null,
        entriesForWeek(entries, anchor, weekStartDay),
      ),
    };
  });

  const plannedWeeks = weeks.filter((week) => week.hasPlan);

  /* ---- שחקנים ---- */

  const playerRows: ReportPlayerRow[] = players.map((player) => {
    const planned = plannedWeeks
      .map((week) => week.matrix.rows.find((row) => row.playerUid === player.uid))
      .filter((row) => row !== undefined);

    const reportedWeeks = weeks.filter((week) =>
      week.matrix.rows.some((row) => row.playerUid === player.uid && row.reported),
    ).length;

    return {
      uid: player.uid,
      displayName: player.displayName,
      pct:
        planned.length === 0
          ? 0
          : planned.reduce((sum, row) => sum + row.overall, 0) / planned.length,
      weeksCounted: planned.length,
      reportedWeeks,
    };
  });

  playerRows.sort((a, b) => {
    if (a.pct !== b.pct) return b.pct - a.pct;
    return a.displayName.localeCompare(b.displayName, 'he');
  });

  /* ---- תרגילים ---- */

  const exerciseMap = new Map<string, ReportExerciseRow & { weekCount: number }>();
  for (const week of plannedWeeks) {
    for (const column of week.matrix.columns) {
      const existing = exerciseMap.get(column.exerciseId);
      if (existing) {
        existing.exerciseName = column.exerciseName;
        existing.unit = column.unit;
        existing.target += column.target;
        existing.total += column.total;
        existing.avgPct += column.avgPct;
        existing.weekCount += 1;
      } else {
        exerciseMap.set(column.exerciseId, {
          exerciseId: column.exerciseId,
          exerciseName: column.exerciseName,
          unit: column.unit,
          target: column.target,
          total: column.total,
          avgPct: column.avgPct,
          weekCount: 1,
        });
      }
    }
  }

  const exercises: ReportExerciseRow[] = [...exerciseMap.values()].map(
    ({ weekCount, ...row }) => ({ ...row, avgPct: weekCount === 0 ? 0 : row.avgPct / weekCount }),
  );

  /* ---- סיכום ---- */

  const measured = playerRows.filter((row) => row.weeksCounted > 0);

  return {
    range,
    weeks,
    weekStart: weeks[0]?.weekStart ?? getWeekBounds(israeliWallTime(range.from, '12:00:00.000')).weekStart,
    weekEnd:
      weeks[weeks.length - 1]?.weekEnd ??
      getWeekBounds(israeliWallTime(range.to, '12:00:00.000')).weekEnd,
    plannedWeekCount: plannedWeeks.length,
    players: playerRows,
    exercises,
    playerCount: playerRows.length,
    reportedCount: playerRows.filter((row) => row.reportedWeeks > 0).length,
    zeroCount: measured.filter((row) => row.pct === 0).length,
    averagePct:
      measured.length === 0 ? 0 : measured.reduce((sum, row) => sum + row.pct, 0) / measured.length,
  };
}

/* ------------------------------------------------------------------ */
/* פירוט שחקן בודד                                                     */
/* ------------------------------------------------------------------ */

/** שורת תרגיל בסיכום האישי. `pct` **אינו חסום** — כמו בכרטיס התרגיל של השחקן. */
export interface ReportPlayerExercise {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  target: number;
  total: number;
  pct: number;
}

export interface ReportPlayerDetail {
  uid: string;
  displayName: string;
  /** אותו מספר בדיוק כמו ב-`WeeklyReport.players` — לא חישוב שני. */
  pct: number;
  weeksCounted: number;
  items: ReportPlayerExercise[];
}

/** הפירוט של שחקן אחד מתוך דוח שכבר נבנה. `null` כשהוא לא בקבוצה. */
export function playerDetail(report: WeeklyReport, uid: string): ReportPlayerDetail | null {
  const row = report.players.find((player) => player.uid === uid);
  if (!row) return null;

  const items = new Map<string, ReportPlayerExercise>();

  for (const week of report.weeks) {
    if (!week.hasPlan) continue;

    const matrixRow = week.matrix.rows.find((entry) => entry.playerUid === uid);
    if (!matrixRow) continue;

    week.matrix.columns.forEach((column, index) => {
      const cell = matrixRow.cells[index];
      if (!cell) return;

      const existing = items.get(column.exerciseId);
      if (existing) {
        existing.exerciseName = column.exerciseName;
        existing.unit = column.unit;
        existing.target += cell.target;
        existing.total += cell.total;
      } else {
        items.set(column.exerciseId, {
          exerciseId: column.exerciseId,
          exerciseName: column.exerciseName,
          unit: column.unit,
          target: cell.target,
          total: cell.total,
          pct: 0,
        });
      }
    });
  }

  return {
    uid: row.uid,
    displayName: row.displayName,
    pct: row.pct,
    weeksCounted: row.weeksCounted,
    items: [...items.values()].map((item) => ({
      ...item,
      pct: item.target > 0 ? (item.total / item.target) * 100 : 0,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* קיבוץ לשלוש הקבוצות של ההודעה                                       */
/* ------------------------------------------------------------------ */

/**
 * שלוש הקבוצות מ-PRD §7.3ה.
 *
 * `done` הוא **100% ומעלה בלבד** — ולא "כמעט". `overall` חסום ב-100 מלכתחילה,
 * כך ש-100 כאן פירושו שכל תרגיל בתוכנית הושלם. `strong` ו-`push` נחתכים לפי
 * `pctTone`: `high` (≥80) עולה ל-`strong`, כל השאר יורד ל-`push`. אין כאן
 * מספר 80 כתוב — הוא יושב ב-`lib/calculations.ts`, מקום אחד לשני השימושים.
 */
export interface ReportGroups {
  done: ReportPlayerRow[];
  strong: ReportPlayerRow[];
  push: ReportPlayerRow[];
}

export function groupPlayers(players: readonly ReportPlayerRow[]): ReportGroups {
  const groups: ReportGroups = { done: [], strong: [], push: [] };

  for (const player of players) {
    // רק שחקנים שהיה להם מה למדוד. שחקן בלי שבוע-עם-תוכנית אינו "0%".
    if (player.weeksCounted === 0) continue;

    const rounded = roundPct(player.pct);
    if (rounded >= 100) groups.done.push(player);
    else if (pctTone(capPct(player.pct)) === 'high') groups.strong.push(player);
    else groups.push.push(player);
  }

  // בתוך הקבוצה: מהגבוה לנמוך, כמו בדוגמה ב-PRD (92% ואז 85%).
  const byPct = (a: ReportPlayerRow, b: ReportPlayerRow) =>
    b.pct - a.pct || a.displayName.localeCompare(b.displayName, 'he');

  groups.done.sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
  groups.strong.sort(byPct);
  groups.push.sort(byPct);

  return groups;
}

/* ------------------------------------------------------------------ */
/* הטקסטים להעתקה                                                      */
/* ------------------------------------------------------------------ */

/**
 * `500 זריקות טכניקה` / `15 דקות החזקת עמידת הגנה`.
 *
 * שם היחידה נכנס רק כשהוא מוסיף מידע. ב-`count` וב-`sessions` המספר כבר
 * צמוד לשם בעברית תקינה ("500 זריקות", "3 אימוני כוח" — שתי הדוגמאות מ-PRD),
 * ואילו "15 החזקת עמידת הגנה" בלי "דקות" הוא מספר בלי משמעות.
 */
export function formatTargetPhrase(target: number, unit: Unit, exerciseName: string): string {
  if (unit === 'count' || unit === 'sessions') return `${target} ${exerciseName}`;
  return `${target} ${t(`units.${unit}`)} ${exerciseName}`;
}

/** `380 מתוך 500` / `11 מתוך 15 דקות` — לשורת התרגיל בסיכום האישי. */
function formatProgressPhrase(total: number, target: number, unit: Unit): string {
  const core = t('coach.reports.text.of', { total: String(total), target: String(target) });
  return unit === 'count' ? core : `${core} ${t(`units.${unit}`)}`;
}

export interface TeamTextInput {
  report: WeeklyReport;
  teamName: string;
  /** ממוצע השבוע שלפני הטווח, או `null` כשאין נתון. */
  previousPct: number | null;
}

/**
 * הודעת הוואטסאפ הקבוצתית (PRD §7.3ה).
 *
 * ## חמישה כללים שמחזיקים את הטקסט קריא בטלפון
 *
 * 1. **קבוצה ריקה לא מודפסת בכלל** — לא כותרת ולא שורה ריקה. "✅ השלימו
 *    100%:" בלי אף שם נראה כמו באג, וזה בדיוק המצב בשבוע רגיל.
 * 2. **אין שחקנים / אין תוכנית → אין ממוצע.** "ממוצע קבוצתי: 0%" בקבוצה בלי
 *    שחקנים הוא מספר שקרי, ובשבוע בלי תוכנית הוא סותר את PRD §8.4.
 * 3. **"שבוע שעבר" מופיע רק כשיש נתון.** `(שבוע שעבר: 0%)` בשבוע הראשון של
 *    העונה נראה כמו נפילה, ולא כמו היעדר היסטוריה.
 * 4. **שורה ריקה בין מקטעים, אף פעם לא שתיים.** ההרכבה היא רשימת מקטעים
 *    שמחוברת ב-`\n\n`, ולא שרשור ידני של `\n` — כך אין רווח כפול כשמקטע
 *    נשמט.
 * 5. **בלי אחוזים לצד שם ב"השלימו 100%"** — כולם 100, וזו רק רעש.
 */
export function buildTeamWhatsAppText({
  report,
  teamName,
  previousPct,
}: TeamTextInput): string {
  const dateRange = formatIsraeliDayRange(report.weekStart, report.weekEnd);
  const sections: string[] = [];

  sections.push(
    report.weeks.length > 1
      ? t('coach.reports.text.headerRange', {
          weeks: report.weeks.length,
          team: teamName,
          dates: dateRange,
        })
      : t('coach.reports.text.header', { team: teamName, dates: dateRange }),
  );

  if (report.plannedWeekCount === 0) {
    sections.push(t('coach.reports.text.noPlan'));
    return sections.join('\n\n');
  }

  if (report.exercises.length > 0) {
    sections.push(
      t('coach.reports.text.plan', {
        items: report.exercises
          .map((item) => formatTargetPhrase(item.target, item.unit, item.exerciseName))
          .join(', '),
      }),
    );
  }

  if (report.playerCount === 0) {
    sections.push(t('coach.reports.text.noPlayers'));
    return sections.join('\n\n');
  }

  const groups = groupPlayers(report.players);
  const withPct = (player: ReportPlayerRow) =>
    `${player.displayName} ${roundPct(player.pct)}%`;

  if (groups.done.length > 0) {
    sections.push(
      `${t('coach.reports.text.done')}\n${groups.done.map((player) => player.displayName).join(', ')}`,
    );
  }
  if (groups.strong.length > 0) {
    sections.push(
      `${t('coach.reports.text.strong', { threshold: PCT_TONE_HIGH })}\n${groups.strong
        .map(withPct)
        .join(' • ')}`,
    );
  }
  if (groups.push.length > 0) {
    sections.push(`${t('coach.reports.text.push')}\n${groups.push.map(withPct).join(' • ')}`);
  }

  const average = t('coach.reports.text.average', { pct: roundPct(report.averagePct) });
  sections.push(
    previousPct === null
      ? average
      : `${average} ${t('coach.reports.text.previous', { pct: roundPct(previousPct) })}`,
  );

  return sections.join('\n\n');
}

export interface PlayerTextInput {
  detail: ReportPlayerDetail;
  teamName: string;
  weekStart: Date;
  weekEnd: Date;
}

/**
 * הסיכום האישי לשחקן בודד (PRD §7.3ה — "לשליחה להורה").
 *
 * ⚠️ **סקירת עדי נדרשת לפני שלב 7.** הטקסט הזה מוציא נתוני קטין מהמערכת אל
 * ערוץ חיצוני (וואטסאפ), ולכן הניסוח והשימוש בו הם החלטה משפטית ולא רק
 * מוצרית. הפיצ'ר בסקופ לפי ה-PRD ולכן הוא נבנה — הסימון כאן הוא כדי שהוא
 * לא ייצא לפיילוט בלי שהשער עבר.
 *
 * מה נכלל בפועל, לפי כלל 7 (אין נתונים אישיים מיותרים): שם התצוגה (שם פרטי
 * + אות), שם הקבוצה, טווח התאריכים, האחוז הכללי והפירוט מול היעדים.
 *
 * **מה לא נכלל בכוונה: הממוצע הקבוצתי.** הודעה להורה שמצמידה את הילד למספר
 * של שאר הקבוצה היא דירוג בדלת האחורית, וזה בדיוק מה שהכרעה 2 (19.8.2026)
 * דחתה כשהורידה את לוח המובילים.
 */
export function buildPlayerWhatsAppText({
  detail,
  teamName,
  weekStart,
  weekEnd,
}: PlayerTextInput): string {
  const sections: string[] = [
    t('coach.reports.text.playerHeader', {
      player: detail.displayName,
      team: teamName,
      dates: formatIsraeliDayRange(weekStart, weekEnd),
    }),
  ];

  if (detail.weeksCounted === 0 || detail.items.length === 0) {
    sections.push(t('coach.reports.text.noPlan'));
    return sections.join('\n\n');
  }

  sections.push(t('coach.reports.text.playerOverall', { pct: roundPct(detail.pct) }));

  sections.push(
    detail.items
      .map(
        (item) =>
          `• ${item.exerciseName}: ${formatProgressPhrase(item.total, item.target, item.unit)} (${roundPct(item.pct)}%)`,
      )
      .join('\n'),
  );

  return sections.join('\n\n');
}
