/**
 * CoachTrack — המטריצה של המאמן: מי עשה מה השבוע (PRD §7.3א).
 *
 * פונקציות טהורות בלבד. אין כאן Firestore, אין `Date.now()` ואין JSX — בדיוק
 * כמו `lib/entries.ts`, וזו הסיבה שאפשר לבדוק מטריצה של 15 שחקנים בלי דפדפן.
 *
 * ## חמישה דברים שקל לטעות בהם, וכך הם נסגרים כאן
 *
 * 1. **הספים לצביעה לא נכתבים כאן.** `pctTone` ב-`lib/calculations.ts` הוא
 *    המקור היחיד (אדום < 50, כתום 50–79, ירוק ≥ 80), ומיפוי דרגה→צבע יושב
 *    בקומפוננטה. שכפול של המספרים 50 ו-80 לכאן היה יוצר מקום שני שמחליט,
 *    ובדיוק שם הצבע והאחוז מתחילים לא להתאים.
 *
 * 2. **חסימת 100% היא בממוצעים בלבד** (מלכודת 3 ב-TASKS.md). התא הבודד מציג
 *    את האחוז המלא — 300% בזריקות נראה 300%. מה שנחסם: הסיכום לשחקן
 *    (`overall`), הסיכום לתרגיל (`avgPct`) והממוצע הקבוצתי. גם השורה של
 *    התרגיל היא ממוצע: שחקן אחד ב-400% לא אמור לכסות על ארבעה ב-0%.
 *
 * 3. **דיווח שנמחק-רכות אינו נספר.** הסינון נעשה כאן בכניסה
 *    (`visibleEntries`) ולא רק ב-`sumEntries`, אחרת `entryCount` היה סופר
 *    מסמכים מחוקים ושחקן היה נחשב "דיווח השבוע" בזכות דיווח שנמחק.
 *
 * 4. **היעדים מגיעים מ-`itemsSnapshot` של המחזור, לא מ-`plan.items`**
 *    (מלכודת 2). המטריצה מקבלת `items` מוכן ואינה יודעת מהי תוכנית — מי
 *    שיזין לה את התוכנית הפעילה ישכתב את השבוע שכבר רץ.
 *
 * 5. **תרגיל בלי דיווחים הוא 0 ולא "אין נתון".** אחרת שחקן שדיווח על תרגיל
 *    אחד מתוך חמישה היה מקבל 100% והמאמן היה מחפש אותו לשווא.
 */

import { capPct, groupEntriesByExercise, pctForExercise, sumEntries } from './calculations';
import { visibleEntries } from './entries';
import type { EntryDoc, PlanCycleDoc, PlanItem, Unit, UserDoc } from '../types/types';

/* ------------------------------------------------------------------ */
/* מבנה המטריצה                                                        */
/* ------------------------------------------------------------------ */

/** שחקן כפי שהמטריצה צריכה אותו. `UserDoc` מקיים אותו, וכך גם ערך בדיקה. */
export interface MatrixPlayer {
  uid: string;
  displayName: string;
}

/** תא אחד: שחקן × תרגיל. */
export interface MatrixCell {
  exerciseId: string;
  /** סכום הכמויות שנספרו (בלי מחוקים-רכות). */
  total: number;
  target: number;
  /** **לא חסום ב-100** — זה מה שמוצג בתא (מלכודת 3). */
  pct: number;
  entryCount: number;
}

/** שורה: שחקן אחד על פני כל התרגילים. */
export interface MatrixRow {
  playerUid: string;
  displayName: string;
  /** באותו סדר בדיוק כמו `columns` — התצוגה נשענת על ההתאמה הזו. */
  cells: MatrixCell[];
  /** ממוצע כללי, כל תרגיל חסום ב-100 קודם. זו עמודת הסיכום לשחקן. */
  overall: number;
  /** כמה דיווחים נספרו לשחקן השבוע, כולל תרגילים שאינם בתוכנית. */
  entryCount: number;
  /** האם דיווח בכלל השבוע. `overall === 0` הוא שאלה אחרת — ראה `TeamKpi`. */
  reported: boolean;
}

/** עמודה: תרגיל אחד על פני כל השחקנים — זו שורת הסיכום לתרגיל. */
export interface MatrixColumn {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  target: number;
  /** סכום הכמויות של כל השחקנים. עובדה, לא ממוצע — ולכן לא נחסם. */
  total: number;
  /** ממוצע האחוזים החסומים על פני השחקנים. */
  avgPct: number;
}

/** שלושת המספרים שבראש הדשבורד (PRD §7.3א). */
export interface TeamKpi {
  /** כמה שחקנים נכללים במדידה. */
  playerCount: number;
  /** כמה מהם דיווחו לפחות פעם אחת השבוע. */
  reportedCount: number;
  /**
   * כמה מהם על 0% בתוכנית.
   *
   * ⚠️ זה **לא** בהכרח `playerCount - reportedCount`: שחקן שדיווח רק על תרגיל
   * שאינו בתוכנית השבוע נספר כמי שדיווח, והאחוז שלו בכל זאת 0.
   */
  zeroCount: number;
  /** ממוצע ה-`overall` של השחקנים. 0 כשאין שחקנים. */
  averagePct: number;
}

export interface TeamMatrix {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  kpi: TeamKpi;
}

/**
 * בונה את המטריצה של שבוע אחד.
 *
 * `weekEntries` הם הדיווחים של **הקבוצה** באותו שבוע (מסוננים לפי `entry.date`,
 * לא לפי `cycleId` — ראה `lib/entries.ts` §3). דיווחים מחוקים-רכות מותר
 * להעביר; הם מסוננים כאן.
 *
 * `items` הוא `cycle.itemsSnapshot`. רשימה ריקה מייצרת מטריצה בלי עמודות —
 * המסך מציג במקומה "אין תוכנית לשבוע הזה" ולא טבלה של אפסים.
 */
export function buildTeamMatrix(
  players: readonly MatrixPlayer[],
  items: readonly PlanItem[] | null | undefined,
  weekEntries: readonly EntryDoc[] | null | undefined,
): TeamMatrix {
  const planItems = items ?? [];
  const counted = visibleEntries(weekEntries ?? []);

  const byPlayer = new Map<string, EntryDoc[]>();
  for (const entry of counted) {
    const bucket = byPlayer.get(entry.playerUid);
    if (bucket) bucket.push(entry);
    else byPlayer.set(entry.playerUid, [entry]);
  }

  const rows: MatrixRow[] = players.map((player) => {
    const playerEntries = byPlayer.get(player.uid) ?? [];
    const grouped = groupEntriesByExercise(playerEntries);

    const cells = planItems.map((item) => {
      const exerciseEntries = grouped[item.exerciseId] ?? [];
      return {
        exerciseId: item.exerciseId,
        total: sumEntries(exerciseEntries),
        target: item.target,
        pct: pctForExercise(exerciseEntries, item.target),
        entryCount: exerciseEntries.length,
      };
    });

    const overall =
      cells.length === 0
        ? 0
        : cells.reduce((sum, cell) => sum + capPct(cell.pct), 0) / cells.length;

    return {
      playerUid: player.uid,
      displayName: player.displayName,
      cells,
      overall,
      entryCount: playerEntries.length,
      reported: playerEntries.length > 0,
    };
  });

  const columns: MatrixColumn[] = planItems.map((item, index) => {
    const cells = rows.map((row) => row.cells[index]);
    const avgPct =
      cells.length === 0 ? 0 : cells.reduce((sum, cell) => sum + capPct(cell.pct), 0) / cells.length;

    return {
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      unit: item.unit,
      target: item.target,
      total: cells.reduce((sum, cell) => sum + cell.total, 0),
      avgPct,
    };
  });

  return {
    columns,
    rows,
    kpi: {
      playerCount: rows.length,
      reportedCount: rows.filter((row) => row.reported).length,
      zeroCount: rows.filter((row) => row.overall === 0).length,
      averagePct:
        rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.overall, 0) / rows.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* מיון                                                                */
/* ------------------------------------------------------------------ */

/**
 * לפי איזו עמודה ממיינים.
 *
 * טיפוס מובחן ולא מחרוזת חופשית: `exerciseId` הוא מזהה מסמך, ותרגיל שיקרא
 * במקרה `overall` היה הופך למיון לפי עמודת הסיכום. באיחוד הזה זה לא אפשרי.
 */
export type MatrixSortKey =
  | { kind: 'name' }
  | { kind: 'overall' }
  | { kind: 'exercise'; exerciseId: string };

export type SortDirection = 'asc' | 'desc';

export interface MatrixSort {
  key: MatrixSortKey;
  direction: SortDirection;
}

/**
 * המיון ההתחלתי: **הנמוך ביותר למעלה**.
 *
 * לא סדר אלפביתי. הדשבורד קיים כדי לענות על "את מי צריך לדחוף", וזו אותה
 * החלטה שכבר נלקחה ב-`exerciseTrends` (`lib/entries.ts`) — מה שדורש תשומת לב
 * מופיע ראשון. מיון לפי שם נמצא במרחק לחיצה אחת על כותרת העמודה.
 */
export const DEFAULT_MATRIX_SORT: MatrixSort = { key: { kind: 'overall' }, direction: 'asc' };

function sameKey(a: MatrixSortKey, b: MatrixSortKey): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'exercise' && b.kind === 'exercise') return a.exerciseId === b.exerciseId;
  return true;
}

/**
 * לחיצה על כותרת עמודה.
 *
 * אותה עמודה — הופכת כיוון. עמודה חדשה — מתחילה תמיד בכיוון עולה: שם מ-א׳,
 * ואחוז מהנמוך. מאמן שלחץ על עמודת תרגיל רוצה לראות מי לא עשה אותו, לא מי
 * כבר סיים.
 */
export function toggleSort(current: MatrixSort, key: MatrixSortKey): MatrixSort {
  if (sameKey(current.key, key)) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

/** האם המיון הנוכחי הוא לפי המפתח הזה — לחיווי על כותרת העמודה. */
export function isSortedBy(sort: MatrixSort, key: MatrixSortKey): boolean {
  return sameKey(sort.key, key);
}

/** האחוז שלפיו ממיינים שורה. עמודת תרגיל שאינה קיימת → 0, ולא קריסה. */
function sortValue(row: MatrixRow, key: MatrixSortKey): number {
  if (key.kind === 'overall') return row.overall;
  if (key.kind === 'exercise') {
    const cell = row.cells.find((item) => item.exerciseId === key.exerciseId);
    return cell ? cell.pct : 0;
  }
  return 0;
}

/**
 * מיון השורות. **מחזיר עותק** — מיון במקום היה משנה prop.
 *
 * שובר-שוויון קבוע: שם בעברית עם `localeCompare('he')`. בלעדיו, קבוצה שבה
 * חצי מהשחקנים על 0% הייתה מקבלת סדר שרירותי שמשתנה בכל רינדור.
 */
export function sortMatrixRows(rows: readonly MatrixRow[], sort: MatrixSort): MatrixRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sort.key.kind === 'name') {
      return sign * a.displayName.localeCompare(b.displayName, 'he');
    }

    const difference = sortValue(a, sort.key) - sortValue(b, sort.key);
    if (difference !== 0) return sign * difference;
    return a.displayName.localeCompare(b.displayName, 'he');
  });
}

/* ------------------------------------------------------------------ */
/* כרטיס שחקן                                                          */
/* ------------------------------------------------------------------ */

/**
 * רק שחקנים פעילים, ממוינים לפי שם — אלה שנכנסים למדידה.
 *
 * שחקן מושבת (`active: false`) לא מופיע במטריצה בכוונה: הוא לא אמור לדווח,
 * והשארתו הייתה מורידה את הממוצע הקבוצתי בלי שאף אחד עשה משהו רע. ההיסטוריה
 * שלו נשמרת (כלל 5) והכרטיס שלו נגיש דרך מסך הקבוצה.
 */
export function matrixPlayers(players: readonly UserDoc[]): MatrixPlayer[] {
  return players
    .filter((player) => player.active)
    .map((player) => ({ uid: player.uid, displayName: player.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
}

/**
 * הדיווחים של שחקן אחד מתוך דיווחי הקבוצה.
 *
 * המאמן טוען שאילתה אחת לכל הקבוצה (`where('teamId','==',teamId)`) והחיתוך
 * לשחקן נעשה כאן — שאילתה שנייה עם `playerUid` הייתה דורשת אינדקס מורכב.
 * מחוקים-רכות **נשארים**: יומן הדיווחים של המאמן מציג אותם מסומנים, וזה
 * ההבדל בין "לא דיווח" לבין "דיווח ונמחק".
 *
 * התוצאה ממוינת מהחדש לישן לפי **תאריך הביצוע**, כמו `entriesForWeek` — כדי
 * שאף מסך לא יצטרך לזכור למיין בעצמו. שובר-שוויון לפי מזהה, כדי ששני דיווחים
 * מאותו יום לא יתחלפו בסדר בין רינדורים.
 */
export function entriesForPlayer(entries: readonly EntryDoc[], playerUid: string): EntryDoc[] {
  return entries
    .filter((entry) => entry.playerUid === playerUid)
    .sort((a, b) => {
      const at = a.date ? a.date.toMillis() : 0;
      const bt = b.date ? b.date.toMillis() : 0;
      if (at !== bt) return bt - at;
      return a.id.localeCompare(b.id);
    });
}

/**
 * כל פריטי התוכנית שהופיעו אי פעם במחזורים — לפתרון שם ויחידה ביומן.
 *
 * דיווח מלפני חודשיים על תרגיל שהוסר מהתוכנית מאז חייב עדיין להציג את שמו.
 * הפריט מהמחזור **החדש ביותר** מנצח (המחזורים ממוינים מהחדש לישן לפני
 * הקיבוץ), כי שם התרגיל העדכני הוא זה שהמאמן מזהה.
 */
export function historicalPlanItems(cycles: readonly PlanCycleDoc[]): PlanItem[] {
  const ordered = [...cycles].sort((a, b) => {
    const at = a.weekStart ? a.weekStart.toMillis() : 0;
    const bt = b.weekStart ? b.weekStart.toMillis() : 0;
    return bt - at;
  });

  const byExercise = new Map<string, PlanItem>();
  for (const cycle of ordered) {
    for (const item of cycle.itemsSnapshot ?? []) {
      if (!byExercise.has(item.exerciseId)) byExercise.set(item.exerciseId, item);
    }
  }
  return [...byExercise.values()];
}
