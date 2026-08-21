/**
 * מטריצת שחקנים × תרגילים (PRD §7.3א) — התצוגה בלבד.
 *
 * ## איך עמודת השם נשארת במקום, ולמה זה הפרט הקריטי כאן
 *
 * 13–18 שחקנים × 5 תרגילים לא נכנסים לרוחב של 375px, וטבלה שגוללים בה הצידה
 * בלי עוגן היא טבלה שאי אפשר לקרוא: אחרי שתי עמודות כבר לא ידוע על מי מסתכלים.
 *
 * המימוש:
 * • המכל הוא `overflow-x-auto` — הוא, ולא הדף, מה שגולל הצידה.
 * • תא השם בכל שורה הוא `sticky start-0`. **`start` ולא `right`** — זו תכונה
 *   לוגית (`inset-inline-start`), ולכן היא נצמדת לימין ב-RTL ותמשיך לעבוד אם
 *   האפליקציה תתורגם (כלל 1 ב-CLAUDE.md אוסר `left`/`right` קשיחים).
 * • לטבלה יש `border-separate border-spacing-0`. עם `border-collapse: collapse`
 *   הדפדפן מצייר את הגבולות ברמת הטבלה, והם **נגללים מתחת** לתא הנעוץ ומשאירים
 *   קווים שבורים. עם `separate` כל תא מצייר את הגבול של עצמו.
 * • לתא הנעוץ יש רקע אטום (`bg-white` / `bg-slate-50` בשורת הסיכום). בלעדיו
 *   העמודות שנגללות מתחתיו נראות דרכו. זה הבאג הקלאסי של עמודה נעוצה.
 *
 * ⚠️ אין לי דפדפן, ולכן מה שנבדק בטסט הוא ש**המחלקות האלה נמצאות על התאים
 * הנכונים** — לא שהן עובדות. את הגלילה עצמה חייבים לראות בעין בטלפון.
 *
 * ## שתי החלטות תצוגה
 *
 * 1. **עמודת הסיכום ("כללי") באה מיד אחרי השם**, לפני התרגילים. במסך של טלפון
 *    זה המספר היחיד שנראה בלי לגלול, והוא גם המספר שהמאמן מחפש קודם.
 * 2. **התא מציג את האחוז המלא** — 300% נראה 300% (מלכודת 3). מה שנחסם ב-100
 *    הוא עמודת הסיכום ושורת הסיכום, ושתיהן ממוצעים.
 *
 * הצבע מגיע מ-`pctTone` ב-`lib/calculations.ts` — הספים לא משוכפלים לכאן.
 */

import { pctTone, roundPct, type PctTone } from '../../lib/calculations';
import {
  isSortedBy,
  type MatrixColumn,
  type MatrixRow,
  type MatrixSort,
  type MatrixSortKey,
} from '../../lib/dashboard';
import { t } from '../../i18n/he';

/** מיפוי דרגה→צבע. זה החלק היחיד כאן שהוא עיצוב, ולכן זה החלק היחיד שיושב כאן. */
const CELL_TONES: Record<PctTone, string> = {
  low: 'bg-red-100 text-red-900',
  mid: 'bg-amber-100 text-amber-900',
  high: 'bg-emerald-100 text-emerald-900',
};

/** תא נעוץ: אותן מחלקות בכל שלוש השורות (כותרת, גוף, סיכום). */
const STICKY_CELL = 'sticky start-0 z-10 border-e border-slate-200';

const HEAD_CELL = 'border-b border-slate-200 p-0 text-xs font-semibold text-slate-600';
const BODY_CELL = 'border-b border-slate-100 px-2 py-2 text-center';

export interface TeamMatrixProps {
  columns: MatrixColumn[];
  /** שורות **כבר ממוינות** — המיון הוא לוגיקה ויושב ב-`lib/dashboard.ts`. */
  rows: MatrixRow[];
  /** הממוצע הקבוצתי, לפינה של שורת הסיכום. */
  teamAverage: number;
  sort: MatrixSort;
  onSort: (key: MatrixSortKey) => void;
  onOpenPlayer: (playerUid: string) => void;
}

interface SortHeaderProps {
  label: string;
  /** שורה שנייה קטנה — היעד של התרגיל. */
  sublabel?: string;
  sortKey: MatrixSortKey;
  sort: MatrixSort;
  onSort: (key: MatrixSortKey) => void;
  className?: string;
  sticky?: boolean;
}

function SortHeader({ label, sublabel, sortKey, sort, onSort, className = '', sticky }: SortHeaderProps) {
  const active = isSortedBy(sort, sortKey);
  const ascending = sort.direction === 'asc';

  return (
    <th
      scope="col"
      // aria-sort הוא מה שמקריא לקורא מסך "ממוין לפי העמודה הזו".
      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
      className={[HEAD_CELL, sticky ? `${STICKY_CELL} z-20 bg-white` : 'bg-white', className]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={t('coach.dashboard.matrix.sortAction', { column: label })}
        className="flex min-h-[44px] w-full flex-col justify-center px-2 py-1 text-center hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
      >
        <span className="flex items-center justify-center gap-1">
          <span className="truncate">{label}</span>
          {active ? (
            <span aria-hidden="true" className="text-slate-400">
              {ascending ? '▲' : '▼'}
            </span>
          ) : null}
        </span>
        {sublabel ? (
          <span className="truncate text-[10px] font-normal text-slate-400">{sublabel}</span>
        ) : null}
        {active ? (
          <span className="sr-only">
            {ascending ? t('coach.dashboard.matrix.sortAsc') : t('coach.dashboard.matrix.sortDesc')}
          </span>
        ) : null}
      </button>
    </th>
  );
}

/** תא אחוז צבוע. `label` הוא מה שקורא מסך שומע — התא עצמו הוא מספר בלי הקשר. */
function PctCell({ pct, label, totals }: { pct: number; label: string; totals?: string }) {
  return (
    <div
      className={`rounded-lg px-1.5 py-1 ${CELL_TONES[pctTone(pct)]}`}
      role="img"
      aria-label={label}
    >
      <span aria-hidden="true" className="block text-sm font-bold leading-tight">
        {roundPct(pct)}%
      </span>
      {totals ? (
        <span aria-hidden="true" className="block text-[10px] leading-tight opacity-75">
          {totals}
        </span>
      ) : null}
    </div>
  );
}

export function TeamMatrix({
  columns,
  rows,
  teamAverage,
  sort,
  onSort,
  onOpenPlayer,
}: TeamMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t('coach.dashboard.matrix.title')}</caption>

        <thead>
          <tr>
            <SortHeader
              label={t('coach.dashboard.matrix.playerColumn')}
              sortKey={{ kind: 'name' }}
              sort={sort}
              onSort={onSort}
              className="min-w-[7.5rem] text-start"
              sticky
            />
            <SortHeader
              label={t('coach.dashboard.matrix.overallColumn')}
              sortKey={{ kind: 'overall' }}
              sort={sort}
              onSort={onSort}
              className="min-w-[4.5rem]"
            />
            {columns.map((column) => (
              <SortHeader
                key={column.exerciseId}
                label={column.exerciseName}
                sublabel={t('coach.dashboard.matrix.columnTarget', {
                  target: column.target,
                  unit: t(`units.${column.unit}`),
                })}
                sortKey={{ kind: 'exercise', exerciseId: column.exerciseId }}
                sort={sort}
                onSort={onSort}
                className="min-w-[6.5rem]"
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.playerUid}>
              <th
                scope="row"
                className={`${STICKY_CELL} ${BODY_CELL} bg-white p-0 text-start font-normal`}
              >
                <button
                  type="button"
                  onClick={() => onOpenPlayer(row.playerUid)}
                  aria-label={t('coach.dashboard.matrix.openPlayer', { name: row.displayName })}
                  className="flex min-h-[44px] w-full items-center px-2 py-2 text-start text-sm font-semibold text-slate-900 underline-offset-2 hover:bg-slate-50 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
                >
                  <span className="truncate">{row.displayName}</span>
                </button>
              </th>

              <td className={BODY_CELL}>
                <PctCell
                  pct={row.overall}
                  label={t('coach.dashboard.matrix.overallLabel', {
                    player: row.displayName,
                    pct: roundPct(row.overall),
                  })}
                />
              </td>

              {row.cells.map((cell) => {
                const column = columns.find((item) => item.exerciseId === cell.exerciseId);
                return (
                  <td key={cell.exerciseId} className={BODY_CELL}>
                    <PctCell
                      pct={cell.pct}
                      totals={t('coach.dashboard.matrix.cellTotals', {
                        total: cell.total,
                        target: cell.target,
                      })}
                      label={t('coach.dashboard.matrix.cellLabel', {
                        player: row.displayName,
                        exercise: column ? column.exerciseName : cell.exerciseId,
                        pct: roundPct(cell.pct),
                      })}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {/* שורת הסיכום לתרגיל — ממוצע על פני השחקנים, וכל תרגיל חסום ב-100. */}
        <tfoot>
          <tr>
            <th
              scope="row"
              className={`${STICKY_CELL} bg-slate-50 px-2 py-2 text-start text-xs font-semibold text-slate-600`}
            >
              {t('coach.dashboard.matrix.teamRow')}
            </th>
            <td className="bg-slate-50 px-2 py-2 text-center text-sm font-bold text-slate-900">
              {roundPct(teamAverage)}%
            </td>
            {columns.map((column) => (
              <td
                key={column.exerciseId}
                className="bg-slate-50 px-2 py-2 text-center text-sm font-bold text-slate-900"
              >
                {roundPct(column.avgPct)}%
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
