// ============================================================================
// ReconcileView.tsx — ★ "השוואה בין שני דוחות גבייה". המסך.
//
// ---------------------------------------------------------------------------
// ★★ הבאנר שלמעלה הוא הבטחה, ויש לה שער
// ---------------------------------------------------------------------------
// "הקבצים נשארים במחשב שלך. שום דבר מהם לא נשלח לשום מקום ולא נשמר בכלי — כשסוגרים את החלון, זה נעלם." — זו אמירה על
// עובדה, ולא ניסוח מרגיע. מה שמחזיק אותה הוא `scripts/check-no-upload.mjs`:
// שער CI שעובר על **גרף הייבוא של המסך הזה** ומפיל את הבנייה אם מופיע בו
// משהו שיכול לשלוח או לשמור — ענן, רשת, או אחסון בדפדפן.
//
// ★ וזה גם למה קריאת ה-xlsx נכתבה כאן ולא נלקחה מספרייה: `sheetjs` הוא מאות
// קילובייטים שנכנסים לאותו גרף בדיוק. `shared/lib/xlsx.ts` פורס את ה-ZIP
// עם `DecompressionStream` של הדפדפן — פעולה על בייטים, בלי רשת ובלי דיסק.
//
// ---------------------------------------------------------------------------
// ★ סדר הקבוצות הוא ההחלטה המרכזית במסך
// ---------------------------------------------------------------------------
//   1. **עסקאות שלא עברו** — הדבר שאסור שתקרא לא נכון (ראו למטה).
//   2. **מה שלא הצליח להתאים** — מה שדורש ממנה החלטה.
//   3. **התאמות עם פער חריג**.
//   4. **מה שהתאים** — מקופל.
//
// היא לא פותחת את המסך הזה כדי לראות ש-200 עסקאות תקינות; היא פותחת אותו
// כדי למצוא את השלוש שלא.
//
// ---------------------------------------------------------------------------
// ★★ ומה שהמסך עושה היום — שני הקבצים נמדדו, והאדפטרים קיימים
// ---------------------------------------------------------------------------
// טרנזילה נותנת שורה לעסקה; גמא נותנת שורה ל(שידור × מותג), מצטברת. לכן
// **שני הצדדים מקובצים לפי מספר שידור** לפני ההשוואה (`settlementGroup.ts`),
// והמנוע ממשיך להתאים לפי אסמכתא בדיוק כמו שהיה.
//
// ואפשר להעלות אותם **בכל סדר**: הזיהוי הוא לפי צירוף הכותרות בקובץ, ואם הם
// הפוכים — הכלי מסדר לבד ואומר את זה בשקט.
// ============================================================================

import { useCallback, useId, useMemo, useState } from 'react';
import {
  filterByPeriod,
  formatAgorot,
  formatDateHe,
  monthKeyOf,
  monthLabelHe,
  monthPeriod,
  previousMonthKey,
  SOURCE_HE,
  type Period,
  type SettlementReport,
  type SettlementRow,
  type SettlementSource,
} from '../../shared/lib/settlement';
import { groupBySettlement, membersOf } from '../../shared/lib/settlementGroup';
import {
  reconcile,
  type AmbiguousMatch,
  type DeclinedEntry,
  type MatchedPair,
  type ReconcileFinding,
  type ReconcileResult,
} from '../../shared/lib/reconcile';
import { buildReconcileCsv, reconcileFileName } from '../../shared/lib/reconcileCsv';
import { detectAdapter, type ReportAdapter } from '../../shared/lib/reportAdapters';
import { readSheetGrid, XlsxError, type InflateRaw } from '../../shared/lib/xlsx';
import { t } from '../i18n';
import { Badge, Banner } from './ui/Badge';

// ---------------------------------------------------------------------------
// מצב של צד אחד
// ---------------------------------------------------------------------------

type SideStatus = 'empty' | 'reading' | 'ready' | 'unknownFormat' | 'emptyFile' | 'readFailed';

/**
 * קריאת הקובץ לבייטים.
 *
 * ★ `FileReader` ולא `file.arrayBuffer()`: שתיהן קוראות בדיוק אותו דבר — את
 * מה שכבר יושב בזיכרון הדפדפן, בלי שרת ובלי רשת — אבל רק הראשונה קיימת גם
 * בסביבת המבחן. כך `tests/reconcileUpload.test.tsx` מפעיל את **המסלול
 * עצמו**, ולא polyfill שמחליף אותו. מבחן שרץ על תחליף אינו מבחן על הקוד.
 *
 * ★ ובייטים ולא טקסט: הקבצים הם `.xlsx`, כלומר ZIP. "לקרוא כטקסט" היה
 * מייצר ג׳יבריש ואז מכריח אותנו לזהות לפי שם קובץ. אגב זה גם מה שמסלק את
 * שאלת הקידוד: הטקסט בתוך xlsx הוא UTF-8 לפי התקן, תמיד.
 */
function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read'));
    reader.onload = () => {
      const result = reader.result;
      resolve(result instanceof ArrayBuffer ? new Uint8Array(result) : new Uint8Array(0));
    };
    reader.readAsArrayBuffer(file);
  });
}

interface SideState {
  readonly status: SideStatus;
  readonly fileName: string | null;
  readonly report: SettlementReport | null;
  /** מה זוהה, לתצוגה שקטה מתחת לשם הקובץ. */
  readonly detectedHe: string | null;
  /** הסבר נוסף כשהקריאה לא הצליחה — בעברית, מהקורא עצמו. */
  readonly noteHe: string | null;
}

const EMPTY_SIDE: SideState = {
  status: 'empty',
  fileName: null,
  report: null,
  detectedHe: null,
  noteHe: null,
};

/** תאריך היום לפי השעון של המשתמשת, כ-ISO. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type PeriodChoice = 'prevMonth' | 'thisMonth' | 'custom';

// ---------------------------------------------------------------------------
// אזור העלאה
// ---------------------------------------------------------------------------

/**
 * ★ גרירה **וגם** כפתור, ולא אחד מהם. גרירה היא המהירה, אבל היא גם הפעולה
 * שנכשלת בשקט כשהיד רועדת או כשהקובץ יושב בחלון אחר — וכפתור בחירה הוא
 * המסלול שתמיד עובד, וגם המסלול היחיד שעובד ממקלדת.
 */
function UploadZone({
  source,
  state,
  onFile,
}: {
  source: SettlementSource;
  state: SideState;
  onFile: (file: File) => void;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
        dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'
      }`}
    >
      <h3 className="text-sm font-bold text-slate-900">{SOURCE_HE[source]}</h3>
      <p className="mt-1 text-sm text-slate-600">{t('reconcileUploadHint')}</p>

      {state.fileName ? (
        <p className="mt-2 text-sm text-slate-800">
          <Badge tone="quiet">{state.fileName}</Badge>
        </p>
      ) : null}

      {/* ★ מה זוהה בפועל. שקט, ומתחת לשם הקובץ — כדי שתדע שהכלי הבין, וכדי
          שאם הוא הבין לא נכון היא תראה את זה מיד ולא דרך תוצאה מוזרה. */}
      {state.detectedHe ? (
        <p className="mt-1 text-sm text-slate-600">
          {t('reconcileDetectedPrefix')}
          {state.detectedHe}
        </p>
      ) : null}

      <div className="mt-3">
        <input
          id={inputId}
          type="file"
          accept=".xlsx"
          className="peer sr-only"
          onChange={(e) => take(e.target.files)}
        />
        <label
          htmlFor={inputId}
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-slate-400 bg-slate-50 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-600 peer-focus-visible:ring-offset-2"
        >
          {state.fileName ? t('reconcileReplaceFile') : t('reconcileChooseFile')}
        </label>
      </div>

      {state.status === 'reading' ? (
        <p className="mt-3 text-sm text-slate-600">{t('reconcileReading')}</p>
      ) : null}

      {/* ★ לא שגיאה — מצב מוצר. בלי שם קובץ באנגלית טכנית ובלי פירוט מערכת. */}
      {state.status === 'unknownFormat' ? (
        <div className="mt-3">
          <Banner tone="info" title={t('reconcileUnknownTitle')}>
            {t('reconcileUnknownBody')}
            {state.noteHe ? <span className="mt-1 block">{state.noteHe}</span> : null}
          </Banner>
        </div>
      ) : null}

      {state.status === 'emptyFile' ? (
        <div className="mt-3">
          <Banner tone="warn" title={t('reconcileEmptyFileTitle')}>
            {t('reconcileEmptyFileBody')}
          </Banner>
        </div>
      ) : null}

      {state.status === 'readFailed' ? (
        <div className="mt-3">
          <Banner tone="warn" title={t('reconcileReadFailedTitle')}>
            {t('reconcileReadFailedBody')}
          </Banner>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// בחירת התקופה
// ---------------------------------------------------------------------------

function PeriodPicker({
  choice,
  custom,
  today,
  onChoice,
  onCustom,
}: {
  choice: PeriodChoice;
  custom: Period;
  today: string;
  onChoice: (next: PeriodChoice) => void;
  onCustom: (next: Period) => void;
}) {
  const fromId = useId();
  const toId = useId();

  const button = (value: PeriodChoice, label: string) => (
    <button
      type="button"
      onClick={() => onChoice(value)}
      aria-pressed={choice === value}
      className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
        choice === value
          ? 'border-sky-700 bg-sky-700 text-white'
          : 'border-slate-400 bg-white text-slate-900 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">{t('reconcilePeriodTitle')}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {/* ★ החודש שעבר ראשון וגם ברירת המחדל: זה החודש שסגור, וזה החודש
            שעליו שני הדוחות כבר הגיעו. "החודש הזה" הוא כמעט תמיד חלקי. */}
        {button('prevMonth', `${t('reconcilePeriodPrevMonth')} · ${monthLabelHe(previousMonthKey(today))}`)}
        {button('thisMonth', `${t('reconcilePeriodThisMonth')} · ${monthLabelHe(monthKeyOf(today))}`)}
        {button('custom', t('reconcilePeriodCustom'))}
      </div>

      {choice === 'custom' ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={fromId} className="block text-sm text-slate-700">
              {t('reconcilePeriodFrom')}
            </label>
            <input
              id={fromId}
              type="date"
              value={custom.from}
              onChange={(e) => onCustom({ from: e.target.value, to: custom.to })}
              className="mt-1 min-h-[44px] rounded-lg border border-slate-400 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor={toId} className="block text-sm text-slate-700">
              {t('reconcilePeriodTo')}
            </label>
            <input
              id={toId}
              type="date"
              value={custom.to}
              onChange={(e) => onCustom({ from: custom.from, to: e.target.value })}
              className="mt-1 min-h-[44px] rounded-lg border border-slate-400 px-3 text-sm"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// חלקי התוצאה
// ---------------------------------------------------------------------------

function dayDeltaHe(dayDelta: number): string {
  if (dayDelta === 0) return t('reconcileDayDeltaSame');
  const abs = Math.abs(dayDelta);
  const amount = abs === 1 ? t('reconcileDayDeltaOneDay') : `${abs} ${t('reconcileDayDeltaDays')}`;
  const prefix =
    dayDelta > 0 ? t('reconcileDayDeltaLaterPrefix') : t('reconcileDayDeltaEarlierPrefix');
  return `${prefix}${amount}`;
}

function RowLine({ row }: { row: SettlementRow }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-sm text-slate-600">{formatDateHe(row.date)}</span>
      <span className="text-base font-semibold text-slate-900">{formatAgorot(row.amount)}</span>
      {row.reference ? <span className="text-sm text-slate-600">{row.reference}</span> : null}
      {row.label ? <span className="text-sm text-slate-500">{row.label}</span> : null}
    </span>
  );
}

/**
 * ★★ פירוט הקבוצה.
 *
 * שידור אחד יכול להיות שתי עסקאות בטרנזילה מול שורה אחת בגמא. כשקבוצה לא
 * התאימה, הסכום המצטבר לבדו הוא מספר שאי אפשר לבדוק — היא צריכה לראות משתי
 * אילו עסקאות הוא מורכב, ואז לפתוח את הקובץ ולמצוא אותן.
 */
function GroupMembers({ row }: { row: SettlementRow }) {
  const members = membersOf(row);
  if (members.length < 2) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-medium text-slate-700">{t('reconcileGroupMembers')}</p>
      <ul className="mt-1 space-y-1">
        {members.map((member) => (
          <li key={member.rowIndex} className="rounded border border-slate-200 bg-white p-2">
            <RowLine row={member} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PairLine({ pair }: { pair: MatchedPair }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <RowLine row={pair.a} />
      <div className="mt-1 border-t border-slate-100 pt-1">
        <RowLine row={pair.b} />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Badge tone="quiet">
          {pair.matchedBy === 'reference'
            ? t('reconcileMatchedByReference')
            : t('reconcileMatchedByDateAmount')}
        </Badge>
        <span>
          {t('reconcileAmountDelta')}: {formatAgorot(pair.amountDelta)}
        </span>
        <span>{dayDeltaHe(pair.dayDelta)}</span>
      </p>
    </li>
  );
}

function AmbiguousLine({ item }: { item: AmbiguousMatch }) {
  return (
    <li className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <RowLine row={item.row} />
      <p className="mt-1 text-sm text-amber-900">{item.reasonHe}</p>
      <p className="mt-2 text-sm font-medium text-slate-700">{t('reconcileAmbiguousCandidates')}</p>
      <ul className="mt-1 space-y-1">
        {item.candidates.map((candidate) => (
          <li key={`${candidate.row.rowIndex}`} className="rounded border border-amber-200 bg-white p-2">
            <RowLine row={candidate.row} />
            <span className="mt-1 block text-sm text-slate-600">
              {t('reconcileAmountDelta')}: {formatAgorot(candidate.amountDelta)} ·{' '}
              {dayDeltaHe(candidate.dayDelta)}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * ★★ עסקה שלא עברה.
 *
 * אפור-כחול ולא אדום: אין כאן תקלה בהשוואה, ואין כסף שאבד. הצבע האדום היה
 * אומר לה בדיוק את ההפך ממה שכתוב בטקסט.
 */
function DeclinedLine({ entry }: { entry: DeclinedEntry }) {
  return (
    <li className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm text-slate-600">{formatDateHe(entry.row.date)}</span>
        <span className="text-base font-semibold text-slate-900">
          {formatAgorot(entry.row.amount)}
        </span>
        {entry.row.reference ? (
          <span className="text-sm text-slate-600">{entry.row.reference}</span>
        ) : null}
      </span>
      <p className="mt-1 text-sm text-slate-800">
        {t('reconcileDeclinedPrefix')}
        {entry.row.reasonHe}
      </p>
    </li>
  );
}

function FindingBanner({ finding }: { finding: ReconcileFinding }) {
  const tone = finding.severity === 'block' ? 'danger' : finding.severity === 'warn' ? 'warn' : 'info';
  return <Banner tone={tone}>{finding.messageHe}</Banner>;
}

function countHe(count: number): string {
  return count === 1
    ? t('reconcileSummaryOneTransaction')
    : `${count} ${t('reconcileSummaryTransactions')}`;
}

/** ההורדה בפועל. מופרדת מהבנייה — הבנייה טהורה, זו נוגעת ב-DOM. */
function downloadCsv(result: ReconcileResult, periodLabelHe: string): void {
  const blob = new Blob([buildReconcileCsv(result)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = reconcileFileName(periodLabelHe);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// התוצאה — מיוצא בנפרד כדי שאפשר יהיה לבדוק אותו בלי קבצים
// ---------------------------------------------------------------------------

export function ReconcileResultView({
  result,
  periodLabelHe,
}: {
  result: ReconcileResult;
  periodLabelHe: string;
}) {
  const unusual = result.matched.filter((m) => m.deltaIsUnusual);
  const ordinary = result.matched.filter((m) => !m.deltaIsUnusual);
  const { totals } = result;

  return (
    <div className="space-y-5">
      {/* ★ שורת הסיכום: שני מספרים וההפרש, בעברית פשוטה. זה מה שהיא באה
          לראות, והיא צריכה לראות אותו בלי לגלול ובלי לפרש. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {/* ★ הצורה הנטולה אחרי התחילית: "בדוח טרנזילה", לא "בהדוח
            מטרנזילה". ראו `SOURCE_HE_BARE`. */}
        <p className="text-sm text-slate-800">
          {t('reconcileSummaryIn')}
          {result.sourceBareA} — {countHe(totals.countA)}, {t('reconcileSummaryTotal')}{' '}
          {formatAgorot(totals.sumA)}.
        </p>
        <p className="mt-1 text-sm text-slate-800">
          {t('reconcileSummaryIn')}
          {result.sourceBareB} — {countHe(totals.countB)}, {t('reconcileSummaryTotal')}{' '}
          {formatAgorot(totals.sumB)}.
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">
          {totals.sumDelta === 0
            ? t('reconcileSummaryNoDiff')
            : `${t('reconcileSummaryDiff')}: ${formatAgorot(totals.sumDelta)}`}
        </p>
      </section>

      {result.findings.length > 0 ? (
        <div className="space-y-2">
          {result.findings.map((finding) => (
            <FindingBanner key={`${finding.code}-${finding.messageHe}`} finding={finding} />
          ))}
        </div>
      ) : null}

      {/* --- ★★ 1. עסקאות שלא עברו ---------------------------------------- */}
      {result.declined.length > 0 ? (
        <section>
          <h3 className="text-base font-bold text-slate-900">{t('reconcileGroupDeclined')}</h3>
          <p className="mt-1 text-sm text-slate-600">{t('reconcileGroupDeclinedHint')}</p>
          <ul className="mt-2 space-y-2">
            {result.declined.map((entry) => (
              <DeclinedLine key={`${entry.source}-${entry.row.rowIndex}`} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- 2. מה שלא הצליח להתאים -------------------------------------- */}
      <section>
        <h3 className="text-base font-bold text-slate-900">{t('reconcileGroupUnmatched')}</h3>
        {result.onlyInA.length === 0 &&
        result.onlyInB.length === 0 &&
        result.ambiguous.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t('reconcileGroupUnmatchedEmpty')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {result.onlyInA.map((row) => (
              <li key={`a-${row.rowIndex}`} className="rounded-lg border border-red-300 bg-red-50 p-3">
                <RowLine row={row} />
                <span className="mt-1 block text-sm text-red-900">
                  {t('reconcileOnlyInPrefix')}
                  {result.sourceBareA}
                </span>
                <GroupMembers row={row} />
              </li>
            ))}
            {result.onlyInB.map((row) => (
              <li key={`b-${row.rowIndex}`} className="rounded-lg border border-red-300 bg-red-50 p-3">
                <RowLine row={row} />
                <span className="mt-1 block text-sm text-red-900">
                  {t('reconcileOnlyInPrefix')}
                  {result.sourceBareB}
                </span>
                <GroupMembers row={row} />
              </li>
            ))}
            {result.ambiguous.map((item) => (
              <AmbiguousLine key={`${item.side}-${item.row.rowIndex}`} item={item} />
            ))}
          </ul>
        )}
      </section>

      {/* --- 3. התאמות עם פער חריג --------------------------------------- */}
      <section>
        <h3 className="text-base font-bold text-slate-900">{t('reconcileGroupUnusual')}</h3>
        {unusual.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t('reconcileGroupUnusualEmpty')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {unusual.map((pair) => (
              <PairLine key={`u-${pair.a.rowIndex}-${pair.b.rowIndex}`} pair={pair} />
            ))}
          </ul>
        )}
      </section>

      {/* --- 4. מה שהתאים — מקופל כברירת מחדל ---------------------------- */}
      {/* `<details>` ולא כפתור עם state: הקיפול עובד גם ממקלדת, גם בהדפסה,
          וגם כשקורא מסך מדלג — בלי שורת קוד אחת. */}
      <section>
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-base font-bold text-slate-900">
            {t('reconcileGroupMatched')} ({ordinary.length})
          </summary>
          <div className="px-4 pb-4">
            <p className="text-sm text-slate-600">{t('reconcileGroupMatchedHint')}</p>
            <ul className="mt-2 space-y-2">
              {ordinary.map((pair) => (
                <PairLine key={`m-${pair.a.rowIndex}-${pair.b.rowIndex}`} pair={pair} />
              ))}
            </ul>
          </div>
        </details>
      </section>

      {/* ★★ ההערה **ליד הכפתור**, ולא בבאנר.
          הבאנר אומר שכלום לא נשלח וכלום לא נשמר בכלי — וזה נכון. הכפתור
          הזה כותב קובץ לדיסק שלה, וזה נכון גם הוא. שני משפטים שאינם יכולים
          להיות נכונים יחד באוזניה אם הם יושבים באותו מקום — ולכן כל אחד
          יושב במקום שבו הוא רלוונטי: ההבטחה למעלה, והעובדה על הקובץ היוצא
          כאן, ברגע שבו היא מחליטה להוציא אותו. */}
      <div>
        <button
          type="button"
          onClick={() => downloadCsv(result, periodLabelHe)}
          className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-50 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100"
        >
          {t('reconcileExport')}
        </button>
        <p className="mt-2 text-sm text-slate-600">{t('reconcileExportNote')}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// המסך
// ---------------------------------------------------------------------------

export interface ReconcileViewProps {
  /**
   * ★ היום, כ-ISO. מוזרק כדי שהמסך יהיה ניתן לבדיקה — לא כדי להיות "גמיש".
   * מסך שקורא את השעון בתוך הרינדור הוא מסך שהמבחן שלו נשבר בראשון בחודש.
   */
  today?: string;
  /** האדפטרים. ברירת המחדל היא הרשימה האמיתית. */
  adapters?: readonly ReportAdapter[];
  /**
   * ★★ פריסת ה-deflate. **נקודת הממשק היחידה שמתחלפת במבחן.**
   *
   * בדפדפן זה `DecompressionStream`, שאינו קיים ב-jsdom; במבחן מוזרק
   * `zlib.inflateRawSync` של Node. כל השאר — פרסור ה-ZIP, ה-XML, בניית
   * הטבלה, הזיהוי והפרסור — הוא **אותו קוד בדיוק**. כך המסלול שנבדק הוא
   * המסלול שרץ אצלה, ולא תחליף שדומה לו.
   */
  inflateRaw?: InflateRaw;
}

/**
 * ★★ מי מהשניים הוא טרנזילה ומי גמא — לפי מה **שזוהה בקובץ**, ולא לפי
 * אזור הגרירה. היא לא צריכה לזכור איזה ריבוע שייך למי.
 */
function arrange(
  first: SettlementReport | null,
  second: SettlementReport | null,
): { a: SettlementReport; b: SettlementReport; swapped: boolean } | 'sameSource' | null {
  if (!first || !second) return null;
  if (first.source === second.source) return 'sameSource';
  return first.source === 'tranzila'
    ? { a: first, b: second, swapped: false }
    : { a: second, b: first, swapped: true };
}

export function ReconcileView({ today = todayIso(), adapters, inflateRaw }: ReconcileViewProps) {
  const [sideA, setSideA] = useState<SideState>(EMPTY_SIDE);
  const [sideB, setSideB] = useState<SideState>(EMPTY_SIDE);
  const [choice, setChoice] = useState<PeriodChoice>('prevMonth');
  const [custom, setCustom] = useState<Period>(() => monthPeriod(previousMonthKey(today)));

  const period = useMemo<Period>(() => {
    if (choice === 'prevMonth') return monthPeriod(previousMonthKey(today));
    if (choice === 'thisMonth') return monthPeriod(monthKeyOf(today));
    return custom;
  }, [choice, custom, today]);

  const periodLabelHe = useMemo(() => {
    if (choice === 'prevMonth') return monthLabelHe(previousMonthKey(today));
    if (choice === 'thisMonth') return monthLabelHe(monthKeyOf(today));
    return `${formatDateHe(period.from)} עד ${formatDateHe(period.to)}`;
  }, [choice, period.from, period.to, today]);

  /**
   * ★ הקריאה עצמה. הכול קורה על בייטים שכבר יושבים בזיכרון הדפדפן — אין
   * כאן העלאה, אין שרת, ואין לאן. ראו את הבאנר ואת השער שמאחוריו.
   */
  const read = useCallback(
    async (file: File, set: (next: SideState) => void) => {
      set({ ...EMPTY_SIDE, status: 'reading', fileName: file.name });

      let bytes: Uint8Array;
      try {
        bytes = await readFileBytes(file);
      } catch {
        // ★ בלי קוד שגיאה ובלי שם של חריגה. היא לא יכולה לעשות עם זה כלום,
        // ומה שהיא כן יכולה לעשות — לנסות שוב — כתוב במפורש.
        set({ ...EMPTY_SIDE, status: 'readFailed', fileName: file.name });
        return;
      }

      if (bytes.length === 0) {
        set({ ...EMPTY_SIDE, status: 'emptyFile', fileName: file.name });
        return;
      }

      let grid;
      try {
        grid = await readSheetGrid(bytes, inflateRaw);
      } catch (error) {
        // הקורא מדבר עברית. השגיאה שלו נאמרת כמו שהיא, מתחת למצב
        // "עוד לא מכירים את הפורמט" — היא מסבירה **מה** לא הסתדר.
        set({
          ...EMPTY_SIDE,
          status: 'unknownFormat',
          fileName: file.name,
          noteHe: error instanceof XlsxError ? error.reasonHe : null,
        });
        return;
      }

      if (grid.rows.length === 0) {
        set({ ...EMPTY_SIDE, status: 'emptyFile', fileName: file.name });
        return;
      }

      const adapter = adapters ? detectAdapter(grid, adapters) : detectAdapter(grid);
      if (adapter === null) {
        set({ ...EMPTY_SIDE, status: 'unknownFormat', fileName: file.name });
        return;
      }

      set({
        status: 'ready',
        fileName: file.name,
        report: adapter.parse(grid),
        detectedHe: adapter.sourceHe,
        noteHe: null,
      });
    },
    [adapters, inflateRaw],
  );

  const arranged = useMemo(
    () => arrange(sideA.report, sideB.report),
    [sideA.report, sideB.report],
  );

  const result = useMemo<ReconcileResult | null>(() => {
    if (arranged === null || arranged === 'sameSource') return null;
    // ★★ הקיבוץ קודם להשוואה, ולא בתוכה: טרנזילה היא שורה לעסקה וגמא היא
    //    שורה ל(שידור × מותג). ההתאמה היא **שידור לשידור**, והמנוע ממשיך
    //    לרוץ בדיוק כמו שהוא — רק על קלט אחר.
    return reconcile(
      groupBySettlement(filterByPeriod(arranged.a, period)),
      groupBySettlement(filterByPeriod(arranged.b, period)),
    );
  }, [arranged, period]);

  return (
    <div dir="rtl" lang="he" className="space-y-5">
      <header>
        <h2 className="text-base font-bold text-slate-900">{t('reconcileTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('reconcileSubtitle')}</p>
      </header>

      {/* ★★ הבאנר. קבוע, למעלה, ולא נסגר — ראו ההערה בראש הקובץ. */}
      <div className="sticky top-0 z-10">
        <Banner tone="info">{t('reconcilePrivacyBanner')}</Banner>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <UploadZone source="tranzila" state={sideA} onFile={(file) => void read(file, setSideA)} />
        <UploadZone source="gamma" state={sideB} onFile={(file) => void read(file, setSideB)} />
      </div>

      {/* ★ סודר לבד, ונאמר בשקט. לא מודאל, לא בקשה להעלות שוב. */}
      {arranged !== null && arranged !== 'sameSource' && arranged.swapped ? (
        <Banner tone="info" title={t('reconcileSwappedTitle')}>
          {t('reconcileSwappedBody')}
        </Banner>
      ) : null}

      {arranged === 'sameSource' ? (
        <Banner tone="warn" title={t('reconcileSameSourceTitle')}>
          {t('reconcileSameSourceBody')}
        </Banner>
      ) : null}

      <PeriodPicker
        choice={choice}
        custom={custom}
        today={today}
        onChoice={setChoice}
        onCustom={setCustom}
      />

      {result === null ? (
        arranged === 'sameSource' ? null : (
          <p className="text-sm text-slate-600">{t('reconcileWaitingBoth')}</p>
        )
      ) : (
        <ReconcileResultView result={result} periodLabelHe={periodLabelHe} />
      )}
    </div>
  );
}
