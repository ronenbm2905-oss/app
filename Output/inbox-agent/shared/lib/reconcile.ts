// ============================================================================
// reconcile.ts — ★★ המנוע. פונקציה טהורה אחת, וכל ההחלטות הקשות בתוכה.
//
// ---------------------------------------------------------------------------
// מה השאלה שהכלי הזה עונה עליה
// ---------------------------------------------------------------------------
// בעלת העסק מקבלת שני דוחות על אותה תקופה ורוצה לדעת **מה לא מסתדר**. לא
// "כמה אחוז התאמה" ולא ציון — רשימה קצרה של מה שדורש את תשומת ליבה, ושקט
// על כל השאר.
//
// ---------------------------------------------------------------------------
// ★★ חוק הברזל: הכלי מסרב לנחש
// ---------------------------------------------------------------------------
// כשיותר מעסקה אחת יכולה להתאים — **לא בוחרים**. הזוג נרשם כ"לא ברור" עם כל
// המועמדות, והיא מכריעה. הסיבה אינה זהירות מופשטת: התאמה שגויה היא גרועה
// מאי-התאמה, כי אי-התאמה היא שורה שהיא בודקת, ואילו התאמה שגויה היא שורה
// שהיא **לא** בודקת — ואז ההפרש שהיא מחפשת נעלם בתוך "הכול תקין".
//
// ---------------------------------------------------------------------------
// ★★ ההבדל שאני מצפה שיהיה הרוב, ואסור שייראה כשגיאה
// ---------------------------------------------------------------------------
// סביר מאוד ששני הדוחות לא מדווחים את אותו סכום לאותה עסקה — אחד ברוטו
// והשני נטו אחרי עמלת סליקה. כלי שמסמן את זה כ"לא תואם" מייצר 200 שגיאות
// מדומות ומאבד את האמון בשורה הראשונה.
//
// לכן: פער סכום **אינו** אי-התאמה. הוא נמדד, מדווח על כל התאמה, ומעליו רצה
// סטטיסטיקה — חציון ההפרשים, ובדיקה אם ההפרש עקבי כאחוז. פער עקבי הוא
// **עמלה**, ומוצג ככזה בממצא אחד. פער חריג בשורה בודדת הוא מה שהיא צריכה
// לראות, והוא זה שמסומן.
//
// ---------------------------------------------------------------------------
// ★ דטרמיניזם — לא "בערך אותו פלט"
// ---------------------------------------------------------------------------
// אותו קלט → אותו פלט **כולל הסדר**. שלושה דברים מבטיחים את זה: חשבון
// תאריכים ב-UTC על מחרוזות, סכומים כמספרים שלמים, והתאמה שאינה תלויה בסדר
// המעבר (ראו "ייחודיות הדדית" למטה). אין כאן שעון, אין אקראיות, ואין מודל.
// ============================================================================

import {
  daysBetween,
  declinedOf,
  deductionsOf,
  formatAgorot,
  sumAgorot,
  SOURCE_HE,
  SOURCE_HE_BARE,
  type DeclinedRow,
  type DeductionSummary,
  type SettlementReport,
  type SettlementRow,
  type SettlementSource,
} from './settlement';

// ---------------------------------------------------------------------------
// טיפוסים
// ---------------------------------------------------------------------------

export type MatchedBy = 'reference' | 'dateAmount';

export interface MatchedPair {
  readonly a: SettlementRow;
  readonly b: SettlementRow;
  readonly matchedBy: MatchedBy;
  /** `a.amount - b.amount`, באגורות. חיובי = בדוח הראשון הסכום גדול יותר. */
  readonly amountDelta: number;
  /** מספר הימים שהצד השני דיווח מאוחר יותר. שלילי = מוקדם יותר. */
  readonly dayDelta: number;
  /**
   * ★ האם הפער חורג מהדפוס. כשזוהתה עמלה עקבית — החריגה נמדדת **מול
   * העמלה**, לא מול אפס. זה כל ההבדל בין רשימה שאפשר לעבור עליה לבין
   * רשימה של 200 שורות תקינות.
   */
  readonly deltaIsUnusual: boolean;
}

export interface AmbiguousCandidate {
  readonly row: SettlementRow;
  readonly amountDelta: number;
  readonly dayDelta: number;
}

export interface AmbiguousMatch {
  readonly row: SettlementRow;
  /** מאיזה דוח השורה שלא הוכרעה. */
  readonly side: 'a' | 'b';
  readonly candidates: readonly AmbiguousCandidate[];
  /** למה לא הכרענו, בעברית. מוצג כמו שהוא. */
  readonly reasonHe: string;
}

/**
 * ★★ עסקה שנדחתה, עם הצד שדיווח עליה.
 *
 * היא אינה `onlyInA` ואינה `ambiguous` — היא קטגוריה שלישית, והיא לא
 * עוברת בכלל דרך מנוע ההתאמה: אין למה להתאים אותה. הכסף הזה מעולם לא נגבה.
 */
export interface DeclinedEntry {
  readonly source: SettlementSource;
  readonly sourceHe: string;
  readonly row: DeclinedRow;
}

export interface ReconcileTotals {
  readonly countA: number;
  readonly countB: number;
  readonly sumA: number;
  readonly sumB: number;
  /** `sumA - sumB`, באגורות. */
  readonly sumDelta: number;
}

export type FindingSeverity = 'info' | 'warn' | 'block';

export type ReconcileFindingCode =
  | 'bothEmpty'
  | 'emptyReport'
  | 'allUnreadable'
  | 'unreadableRows'
  | 'declined'
  | 'duplicateReference'
  | 'ambiguous'
  | 'onlyInA'
  | 'onlyInB'
  | 'unusualDelta'
  | 'consistentFeePattern'
  | 'deductions'
  | 'allMatched';

export interface ReconcileFinding {
  readonly code: ReconcileFindingCode;
  readonly severity: FindingSeverity;
  readonly messageHe: string;
  /** כמה שורות מאחורי הממצא, כשזה רלוונטי. */
  readonly count?: number;
}

export interface FeePattern {
  /** החציון, כשבר של הסכום. 0.015 = אחוז וחצי. */
  readonly ratio: number;
  /** אותו דבר באחוזים, מעוגל לשתי ספרות — לתצוגה. */
  readonly percent: number;
  /** כמה התאמות תומכות בדפוס. */
  readonly matchCount: number;
  /** מתוך כמה התאמות בסך הכול. */
  readonly ofTotal: number;
}

export interface ReconcileOptions {
  /**
   * ★ חלון התאריכים. חברת האשראי מזכה בתאריך אחר מיום העסקה — בלי סבילות
   * כל השורות ייראו כחוסר התאמה, וזה היה הופך את הכלי לחסר ערך ביום הראשון.
   */
  readonly dateToleranceDays?: number;
  /** פער סכום מותר לצורך **מועמדות** (שלב ב׳2), כשבר מהסכום. */
  readonly amountToleranceRatio?: number;
  /** ורצפה מוחלטת באגורות, לעסקאות קטנות שבהן אחוז אינו כלום. */
  readonly amountToleranceAgorot?: number;
  /** מתחת לכמה התאמות לא מכריזים על דפוס עמלה. מדגם קטן אינו דפוס. */
  readonly feePatternMinMatches?: number;
  /** כמה רחוק מהחציון עוד נחשב "אותו דפוס". */
  readonly feePatternTolerance?: number;
  /** איזה חלק מההתאמות חייב להיות בתוך הסבילות כדי שזה ייקרא דפוס. */
  readonly feePatternAgreement?: number;
  /** עמלה קטנה מזה אינה עמלה אלא רעש עיגול. */
  readonly feePatternMinRatio?: number;
  /** פער שמעליו ההתאמה מסומנת כחריגה — רצפה מוחלטת, באגורות. */
  readonly unusualDeltaAgorot?: number;
  /** ואותו דבר כשבר מהסכום, לעסקאות גדולות. */
  readonly unusualDeltaRatio?: number;
}

type ResolvedOptions = Required<ReconcileOptions>;

export const DEFAULT_RECONCILE_OPTIONS: ResolvedOptions = {
  dateToleranceDays: 3,
  amountToleranceRatio: 0.05,
  amountToleranceAgorot: 200,
  feePatternMinMatches: 5,
  feePatternTolerance: 0.005,
  feePatternAgreement: 0.8,
  feePatternMinRatio: 0.0005,
  unusualDeltaAgorot: 200,
  unusualDeltaRatio: 0.01,
};

export interface ReconcileResult {
  readonly matched: readonly MatchedPair[];
  readonly onlyInA: readonly SettlementRow[];
  readonly onlyInB: readonly SettlementRow[];
  readonly ambiguous: readonly AmbiguousMatch[];
  /**
   * ★★ העסקאות שלא עברו, משני הדוחות. **לא** חלק מ-`onlyInA`, ולא נספרות
   * כחסרות — ראו `DeclinedEntry`.
   */
  readonly declined: readonly DeclinedEntry[];
  /** הסכום שלא נגבה, באגורות. */
  readonly declinedTotal: number;
  /** "נגבו X, נוכו Y, נכנסו Z" — או `null` כששום דוח לא מדווח ניכויים. */
  readonly deductions: DeductionSummary | null;
  readonly totals: ReconcileTotals;
  readonly findings: readonly ReconcileFinding[];
  /** הדפוס שזוהה, או `null` כשאין. */
  readonly feePattern: FeePattern | null;
  /** חציון הפערים באגורות, או `null` כשאין התאמות. */
  readonly medianDeltaAgorot: number | null;
  /** מה בדיוק רץ. נשמר בפלט כדי ששורת הסיכום תוכל לומר "עד 3 ימים הפרש". */
  readonly options: ResolvedOptions;
  /** שמות הדוחות בעברית **כשהם עומדים לבדם**, לשימוש המסך והייצוא. */
  readonly sourceHeA: string;
  readonly sourceHeB: string;
  /**
   * ★ ואותם שמות **לשימוש אחרי תחילית** — "מופיע רק ב…", "ב… אין אף עסקה".
   * ראו `SOURCE_HE_BARE`: שתי צורות במקור, ולא תיקון של המחרוזת בדרך.
   */
  readonly sourceBareA: string;
  readonly sourceBareB: string;
}

// ---------------------------------------------------------------------------
// עזרים טהורים
// ---------------------------------------------------------------------------

/**
 * ★ סדר קנוני לשורות. כל רשימה בפלט ממוינת כך, וזה מה שהופך "אותו פלט"
 * לטענה שאפשר לבדוק עם השוואת מחרוזות.
 */
function compareRows(x: SettlementRow, y: SettlementRow): number {
  if (x.date !== y.date) return x.date < y.date ? -1 : 1;
  if (x.amount !== y.amount) return x.amount - y.amount;
  return x.rowIndex - y.rowIndex;
}

/**
 * נירמול אסמכתא להשוואה: רווחים מיותרים ואותיות גדולות/קטנות.
 *
 * ★ ובמכוון **לא** יותר מזה. הסרת אפסים מובילים או מקפים היא ניחוש על
 * הפורמט — בדיוק מה שאסור לנו בסבב הזה. מחרוזת ריקה נחשבת כאין אסמכתא.
 */
function normalizeReference(reference: string | null): string | null {
  if (reference === null) return null;
  const normalized = reference.trim().replace(/\s+/g, ' ').toUpperCase();
  return normalized === '' ? null : normalized;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// המנוע
// ---------------------------------------------------------------------------

export function reconcile(
  a: SettlementReport,
  b: SettlementReport,
  opts: ReconcileOptions = {},
): ReconcileResult {
  const options: ResolvedOptions = { ...DEFAULT_RECONCILE_OPTIONS, ...opts };

  const aRows = [...a.rows].sort(compareRows);
  const bRows = [...b.rows].sort(compareRows);

  const availA = new Set<number>(aRows.map((_, i) => i));
  const availB = new Set<number>(bRows.map((_, i) => i));

  const matched: MatchedPair[] = [];
  const ambiguous: AmbiguousMatch[] = [];

  // -------------------------------------------------------------------------
  // שלב א׳ — לפי אסמכתא. התאמה ודאית, וקודמת לכול.
  // -------------------------------------------------------------------------
  // ★ ודאית **רק כשהיא חד-חד-ערכית.** אסמכתא שמופיעה פעמיים באחד הצדדים
  // אינה מזהה עסקה אלא קבוצה, וצירוף לפי סדר הופעה הוא בדיוק הניחוש שהכלי
  // הזה מסרב לעשות. במקרה כזה כל השורות המעורבות יוצאות ל"לא ברור" —
  // וחשוב: הן **לא** ממשיכות לשלב ב׳, כי האסמכתא כבר אמרה שיש כאן בלבול.
  const byRefA = indexByReference(aRows);
  const byRefB = indexByReference(bRows);
  const duplicateRefs: string[] = [];

  for (const key of [...byRefA.keys()].sort()) {
    const ai = byRefA.get(key) ?? [];
    const bi = byRefB.get(key);
    if (!bi || bi.length === 0) continue;

    if (ai.length === 1 && bi.length === 1) {
      matched.push(makePair(aRows[ai[0]], bRows[bi[0]], 'reference'));
      availA.delete(ai[0]);
      availB.delete(bi[0]);
      continue;
    }

    duplicateRefs.push(key);
    for (const i of ai) {
      if (!availA.has(i)) continue;
      ambiguous.push({
        row: aRows[i],
        side: 'a',
        candidates: bi.map((j) => makeCandidate(aRows[i], bRows[j])),
        reasonHe: `האסמכתא ${key} מופיעה יותר מפעם אחת, ולא ידעתי לאיזו עסקה לצרף אותה.`,
      });
      availA.delete(i);
    }
    for (const j of bi) availB.delete(j);
  }

  // -------------------------------------------------------------------------
  // שלב ב׳ — תאריך + סכום, לשורות שנשארו.
  // -------------------------------------------------------------------------
  // ★★ ייחודיות **הדדית**, ולא "הראשון שמתאים"
  // -------------------------------------------------------------------------
  // צימוד חמדני תלוי בסדר המעבר: אותן שורות בסדר אחר היו מתחברות אחרת. כאן
  // זוג נוצר רק כששתי השורות הן המועמדת היחידה זו של זו — תנאי שאינו תלוי
  // בסדר כלל. אחר כך מריצים עוד סבב, כי הסרת זוג יכולה להפוך זוג אחר
  // לחד-משמעי. זה מה שנותן את הדטרמיניזם, והוא גם מה שמונע "בחירה".
  //
  // ★ שני סבבים ולא אחד: קודם **סכום זהה בדיוק**, ורק מה שנשאר עובר לסבילות
  // הרחבה. הוודאי קודם לסביר — אחרת פער עמלה היה יכול לגנוב שורה מהתאמה
  // מדויקת שקיימת.
  //
  // ⚠️ ומה ששלב ב׳ **מתעלם** ממנו במפורש: האסמכתאות. סביר ששתי החברות
  // משתמשות בשיטות מספור שונות לגמרי, ואם היינו פוסלים זוג בגלל אסמכתאות
  // שאינן זהות — לא הייתה מתקבלת אף התאמה.
  pairByUniqueness(aRows, bRows, availA, availB, options, true, matched);
  pairByUniqueness(aRows, bRows, availA, availB, options, false, matched);

  // -------------------------------------------------------------------------
  // מה שנשאר: לא ברור, או קיים רק בצד אחד
  // -------------------------------------------------------------------------
  // שורה שנשארה **עם** מועמדות היא "לא ברור" (יותר מאחת התאימה, ולא הכרענו);
  // שורה שנשארה **בלי** מועמדות באמת קיימת רק בדוח אחד.
  const explainedB = new Set<number>();
  const bByDate = bucketByDate(bRows, availB);

  for (const i of [...availA].sort((x, y) => x - y)) {
    const candidates = candidateIndexes(aRows[i], bRows, bByDate, availB, options, false);
    if (candidates.length === 0) continue;
    ambiguous.push({
      row: aRows[i],
      side: 'a',
      candidates: candidates.map((j) => makeCandidate(aRows[i], bRows[j])),
      reasonHe: 'יותר מעסקה אחת יכולה להתאים כאן. לא בחרתי במקומך.',
    });
    for (const j of candidates) explainedB.add(j);
  }

  const ambiguousA = new Set(ambiguous.filter((x) => x.side === 'a').map((x) => x.row.rowIndex));
  const onlyInA = [...availA]
    .map((i) => aRows[i])
    .filter((row) => !ambiguousA.has(row.rowIndex))
    .sort(compareRows);
  const onlyInB = [...availB]
    .filter((j) => !explainedB.has(j))
    .map((j) => bRows[j])
    .sort(compareRows);

  ambiguous.sort((x, y) =>
    x.side === y.side ? x.row.rowIndex - y.row.rowIndex : x.side < y.side ? -1 : 1,
  );

  // -------------------------------------------------------------------------
  // הפערים: חציון, דפוס עמלה, ומי חורג ממנו
  // -------------------------------------------------------------------------
  const medianDeltaAgorot = median(matched.map((m) => m.amountDelta));
  const feePattern = detectFeePattern(matched, options);

  const withFlags: MatchedPair[] = matched
    .map((m) => ({ ...m, deltaIsUnusual: isUnusual(m, feePattern, options) }))
    .sort((x, y) => compareRows(x.a, y.a));

  const totals: ReconcileTotals = {
    countA: a.rows.length,
    countB: b.rows.length,
    sumA: sumAgorot(a.rows),
    sumB: sumAgorot(b.rows),
    sumDelta: sumAgorot(a.rows) - sumAgorot(b.rows),
  };

  // ★ הנדחות נאספות משני הצדדים ולא רק מטרנזילה: הקטגוריה היא תכונה של
  //   הדוח, ולא של השם שלו. דוח שאין בו מושג כזה פשוט תורם רשימה ריקה.
  const declined: DeclinedEntry[] = [a, b].flatMap((report) =>
    declinedOf(report).map((row) => ({
      source: report.source,
      sourceHe: SOURCE_HE[report.source],
      row,
    })),
  );
  declined.sort((x, y) =>
    x.row.date !== y.row.date
      ? x.row.date < y.row.date
        ? -1
        : 1
      : x.row.rowIndex - y.row.rowIndex,
  );
  const declinedTotal = sumAgorot(declined.map((entry) => entry.row));

  // ★ הצד שמדווח ניכויים הוא זה שמנכה. אם שניהם מדווחים — b קודם, כי הוא
  //   הדוח שמגיע מחברת האשראי, ומה שכתוב בו הוא מה שייכנס לחשבון.
  const deductions = deductionsOf(b) ?? deductionsOf(a);

  const findings = buildFindings({
    a,
    b,
    matched: withFlags,
    onlyInA,
    onlyInB,
    ambiguous,
    duplicateRefs,
    feePattern,
    declined,
    declinedTotal,
    deductions,
  });

  return {
    matched: withFlags,
    onlyInA,
    onlyInB,
    ambiguous,
    declined,
    declinedTotal,
    deductions,
    totals,
    findings,
    feePattern,
    medianDeltaAgorot: medianDeltaAgorot === null ? null : Math.round(medianDeltaAgorot),
    options,
    sourceHeA: SOURCE_HE[a.source],
    sourceHeB: SOURCE_HE[b.source],
    sourceBareA: SOURCE_HE_BARE[a.source],
    sourceBareB: SOURCE_HE_BARE[b.source],
  };
}

// ---------------------------------------------------------------------------

function makePair(a: SettlementRow, b: SettlementRow, matchedBy: MatchedBy): MatchedPair {
  return {
    a,
    b,
    matchedBy,
    amountDelta: a.amount - b.amount,
    dayDelta: daysBetween(a.date, b.date),
    // מסומן מחדש בסוף, אחרי שיודעים אם יש דפוס עמלה.
    deltaIsUnusual: false,
  };
}

function makeCandidate(a: SettlementRow, b: SettlementRow): AmbiguousCandidate {
  return { row: b, amountDelta: a.amount - b.amount, dayDelta: daysBetween(a.date, b.date) };
}

function indexByReference(rows: readonly SettlementRow[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = normalizeReference(row.reference);
    if (key === null) return;
    const list = map.get(key);
    if (list) list.push(i);
    else map.set(key, [i]);
  });
  return map;
}

/**
 * דלי לפי תאריך. קיים כדי שההתאמה לא תהיה מכפלה של שני הדוחות: בקובץ של
 * אלפי שורות סריקה מלאה בכל סבב הופכת מסך שנטען לרגע למסך שנתקע.
 */
function bucketByDate(
  rows: readonly SettlementRow[],
  avail: ReadonlySet<number>,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const j of avail) {
    const list = map.get(rows[j].date);
    if (list) list.push(j);
    else map.set(rows[j].date, [j]);
  }
  for (const list of map.values()) list.sort((x, y) => x - y);
  return map;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

function isCandidate(
  a: SettlementRow,
  b: SettlementRow,
  options: ResolvedOptions,
  exactAmount: boolean,
): boolean {
  // ★ זיכוי לא מתאים לחיוב, לעולם. סכום שלילי מול חיובי באותו גודל הוא
  // בדיוק המקרה שבו "קרוב מספיק" היה מייצר התאמה הפוכה לגמרי במשמעותה.
  if (Math.sign(a.amount) !== Math.sign(b.amount)) return false;
  if (Math.abs(daysBetween(a.date, b.date)) > options.dateToleranceDays) return false;

  const delta = a.amount - b.amount;
  if (exactAmount) return delta === 0;

  const allowed = Math.max(
    options.amountToleranceAgorot,
    Math.round(Math.abs(a.amount) * options.amountToleranceRatio),
  );
  return Math.abs(delta) <= allowed;
}

function candidateIndexes(
  row: SettlementRow,
  bRows: readonly SettlementRow[],
  bByDate: ReadonlyMap<string, number[]>,
  availB: ReadonlySet<number>,
  options: ResolvedOptions,
  exactAmount: boolean,
): number[] {
  const out: number[] = [];
  for (let d = -options.dateToleranceDays; d <= options.dateToleranceDays; d += 1) {
    const bucket = bByDate.get(shiftDate(row.date, d));
    if (!bucket) continue;
    for (const j of bucket) {
      if (!availB.has(j)) continue;
      if (isCandidate(row, bRows[j], options, exactAmount)) out.push(j);
    }
  }
  return out.sort((x, y) => x - y);
}

/**
 * ★★ הצימוד עצמו: רק זוגות שהם המועמד היחיד זה של זה, בסבבים עד שאין שינוי.
 *
 * מה שהפונקציה הזאת **לא** עושה, וזו כל הנקודה: היא לא פותרת מצב שבו שתי
 * שורות זהות בתאריך ובסכום עומדות מול שתי שורות זהות. שם באמת אין תשובה
 * נכונה, והן יוצאות ל"לא ברור".
 */
function pairByUniqueness(
  aRows: readonly SettlementRow[],
  bRows: readonly SettlementRow[],
  availA: Set<number>,
  availB: Set<number>,
  options: ResolvedOptions,
  exactAmount: boolean,
  out: MatchedPair[],
): void {
  let changed = true;
  while (changed) {
    changed = false;
    const bByDate = bucketByDate(bRows, availB);

    const candsA = new Map<number, number[]>();
    const reverse = new Map<number, number[]>();
    for (const i of [...availA].sort((x, y) => x - y)) {
      const cands = candidateIndexes(aRows[i], bRows, bByDate, availB, options, exactAmount);
      candsA.set(i, cands);
      for (const j of cands) {
        const list = reverse.get(j);
        if (list) list.push(i);
        else reverse.set(j, [i]);
      }
    }

    for (const i of [...candsA.keys()].sort((x, y) => x - y)) {
      if (!availA.has(i)) continue;
      const cands = candsA.get(i) ?? [];
      if (cands.length !== 1) continue;
      const j = cands[0];
      if (!availB.has(j)) continue;
      if ((reverse.get(j) ?? []).length !== 1) continue;

      out.push(makePair(aRows[i], bRows[j], 'dateAmount'));
      availA.delete(i);
      availB.delete(j);
      changed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// דפוס העמלה
// ---------------------------------------------------------------------------

/**
 * ★★ הפער כשבר **מחולק בסכום עם הסימן** ולא בערך המוחלט.
 *
 * זיכוי הוא סכום שלילי, והעמלה עליו נגרעת באותו כיוון יחסי. חלוקה בערך
 * מוחלט הייתה נותנת לזיכויים יחס הפוך מזה של החיובים, ואז כל זיכוי היה
 * נראה כחריגה מהדפוס — כלומר בדיוק הרעש שהכלי נועד למנוע.
 */
function deltaRatio(pair: MatchedPair): number | null {
  if (pair.a.amount === 0) return null;
  return pair.amountDelta / pair.a.amount;
}

function detectFeePattern(
  matched: readonly MatchedPair[],
  options: ResolvedOptions,
): FeePattern | null {
  const ratios = matched
    .map(deltaRatio)
    .filter((value): value is number => value !== null);

  if (ratios.length < options.feePatternMinMatches) return null;

  const mid = median(ratios);
  if (mid === null) return null;
  if (Math.abs(mid) < options.feePatternMinRatio) return null;

  const inside = ratios.filter((r) => Math.abs(r - mid) <= options.feePatternTolerance).length;
  if (inside / ratios.length < options.feePatternAgreement) return null;

  return {
    ratio: mid,
    percent: Math.round(mid * 100 * 100) / 100,
    matchCount: inside,
    ofTotal: ratios.length,
  };
}

function isUnusual(
  pair: MatchedPair,
  feePattern: FeePattern | null,
  options: ResolvedOptions,
): boolean {
  const floor = options.unusualDeltaAgorot;
  const relative = Math.round(Math.abs(pair.a.amount) * options.unusualDeltaRatio);
  const allowed = Math.max(floor, relative);

  if (feePattern === null) return Math.abs(pair.amountDelta) > allowed;

  const expected = Math.round(feePattern.ratio * pair.a.amount);
  return Math.abs(pair.amountDelta - expected) > allowed;
}

// ---------------------------------------------------------------------------
// הממצאים
// ---------------------------------------------------------------------------

/** סדר קבוע. הממצא החמור והפעיל ביותר קודם, וה"הכול תקין" אחרון. */
const FINDING_ORDER: readonly ReconcileFindingCode[] = [
  'allUnreadable',
  'bothEmpty',
  'emptyReport',
  'unreadableRows',
  // ★★ מיד אחרי כשלי הקריאה, ולפני כל השאר: זה הממצא שמסביר את הפער, והוא
  //    זה שמונע ממנה לחפש כסף שמעולם לא נגבה.
  'declined',
  'duplicateReference',
  'ambiguous',
  'onlyInA',
  'onlyInB',
  'unusualDelta',
  'consistentFeePattern',
  'deductions',
  'allMatched',
];

function buildFindings(input: {
  a: SettlementReport;
  b: SettlementReport;
  matched: readonly MatchedPair[];
  onlyInA: readonly SettlementRow[];
  onlyInB: readonly SettlementRow[];
  ambiguous: readonly AmbiguousMatch[];
  duplicateRefs: readonly string[];
  feePattern: FeePattern | null;
  declined: readonly DeclinedEntry[];
  declinedTotal: number;
  deductions: DeductionSummary | null;
}): ReconcileFinding[] {
  const {
    a,
    b,
    matched,
    onlyInA,
    onlyInB,
    ambiguous,
    duplicateRefs,
    feePattern,
    declined,
    declinedTotal,
    deductions,
  } = input;
  const findings: ReconcileFinding[] = [];

  for (const report of [a, b]) {
    // ★ הצורה הנטולה, כי כל שלוש ההודעות למטה משרשרות אליה תחילית.
    const nameHe = SOURCE_HE_BARE[report.source];

    // ★ דוח שכולו לא נקרא הוא **חוסם**: כל מה שיוצג מעליו ייראה כמו השוואה,
    // ויהיה למעשה רשימה של צד אחד. עדיף לומר את זה מפורשות.
    if (report.rows.length === 0 && report.unreadableRows.length > 0) {
      findings.push({
        code: 'allUnreadable',
        severity: 'block',
        messageHe: `לא הצלחתי לקרוא אף שורה ב${nameHe}. אי אפשר להשוות ככה — כדאי לשלוח לרונן דוגמה של הקובץ.`,
        count: report.unreadableRows.length,
      });
      continue;
    }

    if (report.rows.length === 0) {
      findings.push({
        code: 'emptyReport',
        severity: 'warn',
        messageHe: `ב${nameHe} אין אף עסקה בתקופה שבחרת.`,
      });
      continue;
    }

    if (report.unreadableRows.length > 0) {
      findings.push({
        code: 'unreadableRows',
        severity: 'warn',
        messageHe: `ב${nameHe} יש ${report.unreadableRows.length} שורות שלא הצלחתי לקרוא. הן לא נכנסו להשוואה, והסכומים למטה לא כוללים אותן.`,
        count: report.unreadableRows.length,
      });
    }
  }

  if (a.rows.length === 0 && b.rows.length === 0) {
    findings.push({
      code: 'bothEmpty',
      severity: 'warn',
      messageHe: 'בשני הדוחות אין אף עסקה בתקופה שבחרת. אולי כדאי לבחור חודש אחר.',
    });
  }

  // ---------------------------------------------------------------------------
  // ★★ הניסוח שהוא כל ההבדל
  // ---------------------------------------------------------------------------
  // "העסקה לא עברה" ולא "הכסף לא הגיע". השני שולח אותה לחפש אצל חברת
  // האשראי כסף שמעולם לא נגבה; הראשון שולח אותה ללקוחה. בקובץ שנמדד זה היה
  // כל ההפרש בין שני הדוחות — 203 ₪ שנדחו, ושלושה ימי חיפוש שנחסכו.
  if (declined.length > 0) {
    findings.push({
      code: 'declined',
      severity: 'info',
      messageHe:
        declined.length === 1
          ? `עסקה אחת לא עברה, על ${formatAgorot(declinedTotal)}. היא לא מופיעה בדוח השני כי היא מעולם לא נגבתה — זה לא כסף שאבד בדרך.`
          : `${declined.length} עסקאות לא עברו, על ${formatAgorot(declinedTotal)} יחד. הן לא מופיעות בדוח השני כי הן מעולם לא נגבו — זה לא כסף שאבד בדרך.`,
      count: declined.length,
    });
  }

  if (duplicateRefs.length > 0) {
    findings.push({
      code: 'duplicateReference',
      severity: 'warn',
      messageHe: `${duplicateRefs.length} אסמכתאות מופיעות יותר מפעם אחת. לא צירפתי אותן — הן מופיעות ברשימה שדורשת את ההחלטה שלך.`,
      count: duplicateRefs.length,
    });
  }

  if (ambiguous.length > 0) {
    findings.push({
      code: 'ambiguous',
      severity: 'warn',
      messageHe: `${ambiguous.length} עסקאות יכולות להתאים ליותר מאחת. לא בחרתי במקומך — הן מחכות להחלטה שלך.`,
      count: ambiguous.length,
    });
  }

  if (onlyInA.length > 0) {
    findings.push({
      code: 'onlyInA',
      severity: 'warn',
      messageHe: `${onlyInA.length} עסקאות מופיעות ב${SOURCE_HE_BARE[a.source]} ולא מצאתי להן מקבילה ב${SOURCE_HE_BARE[b.source]}.`,
      count: onlyInA.length,
    });
  }

  if (onlyInB.length > 0) {
    findings.push({
      code: 'onlyInB',
      severity: 'warn',
      messageHe: `${onlyInB.length} עסקאות מופיעות ב${SOURCE_HE_BARE[b.source]} ולא מצאתי להן מקבילה ב${SOURCE_HE_BARE[a.source]}.`,
      count: onlyInB.length,
    });
  }

  // ★ הממצא שמונע 200 שגיאות מדומות. הוא `info` ולא `warn` בכוונה: זה לא
  // משהו שצריך לתקן, זה ההסבר למה המספרים לא זהים.
  if (feePattern !== null) {
    findings.push({
      code: 'consistentFeePattern',
      severity: 'info',
      messageHe: `ההפרש בין שני הדוחות עקבי — בערך ${Math.abs(feePattern.percent)}% מכל עסקה (${feePattern.matchCount} מתוך ${feePattern.ofTotal}). זה נראה כמו עמלת סליקה, לא כמו טעות.`,
      count: feePattern.matchCount,
    });
  }

  // ★ שלושת המספרים שהיא מחפשת, בשורה אחת. `info` כי אין כאן מה לתקן —
  //   זה פשוט מה שקרה לכסף בדרך.
  if (deductions !== null) {
    findings.push({
      code: 'deductions',
      severity: 'info',
      messageHe: `נגבו ${formatAgorot(deductions.grossAgorot)}, נוכו ${formatAgorot(
        deductions.feeAgorot + deductions.vatAgorot,
      )} עמלות (כולל מע"מ), ונכנסו ${formatAgorot(deductions.netAgorot)}.`,
      count: deductions.rowCount,
    });
  }

  const unusual = matched.filter((m) => m.deltaIsUnusual).length;
  if (unusual > 0) {
    findings.push({
      code: 'unusualDelta',
      severity: 'warn',
      messageHe: `ב-${unusual} עסקאות הפער בסכום חורג ממה שרואים בשאר. אלה השורות שכדאי להסתכל עליהן.`,
      count: unusual,
    });
  }

  if (
    matched.length > 0 &&
    onlyInA.length === 0 &&
    onlyInB.length === 0 &&
    ambiguous.length === 0 &&
    unusual === 0
  ) {
    findings.push({
      code: 'allMatched',
      severity: 'info',
      messageHe: 'כל העסקאות בשני הדוחות מצאו זו את זו. אין מה לבדוק.',
    });
  }

  return findings.sort((x, y) => {
    const order = FINDING_ORDER.indexOf(x.code) - FINDING_ORDER.indexOf(y.code);
    if (order !== 0) return order;
    // השוואת מחרוזות פשוטה ולא localeCompare: סדר לפי לוקאל תלוי ב-ICU של
    // הסביבה, וזה בדיוק סוג התלות ששוברת את ההבטחה "אותו קלט, אותו פלט".
    return x.messageHe < y.messageHe ? -1 : x.messageHe > y.messageHe ? 1 : 0;
  });
}
