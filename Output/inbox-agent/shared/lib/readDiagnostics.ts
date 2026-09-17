// ============================================================================
// readDiagnostics.ts — ★★ מונים, לא תוכן. המדידה שמחליפה את הניחוש.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה נולד
// ---------------------------------------------------------------------------
// 60 מתוך 60 ההזמנות האמיתיות של המשתמשת נחסמו. שלוש פעמים ברצף ניסינו
// להסיק מהמבנה של ההודעה **מה** נשבר, ושלוש פעמים זה היה מוטעה — כי אין
// בריפו אף גוף הודעה אמיתי. רק הכותרת. כלומר כל היפותזה על המבנה היא
// ספקולציה, וספקולציה שנכתבת כקוד היא תיקון שנראה כמו תיקון.
//
// הדרך היחידה לצאת מזה בלי להעתיק תוכן של לקוחה לשום מקום היא **למדוד**:
// כמה בתים היו, כמה מהם חתומים, איזה חלק נבחר, האם הוא נסגר, ואילו
// **תוויות** נמצאו. מכאן והלאה השאלה "איפה זה נשבר" נענית ממספר ולא מסברה.
//
// ---------------------------------------------------------------------------
// ⛔ הגבול — והוא לא המלצה
// ---------------------------------------------------------------------------
// כל שדה כאן הוא **מספר, בוליאני, או מחרוזת מתוך רשימה סגורה שכתובה בקוד**.
// שמות התוויות (`שם לקוח`, `עיר`) הם קבועים מ-`ORDER_LABELS` — הם לא מגיעים
// מההודעה, הם מושווים מולה. מה שכתוב **אחרי** התווית בהודעה — שם, טלפון,
// כתובת מגורים — לא נכנס לכאן, לא כדוגמה ולא כקטע.
//
// זה נאכף במבחן (`tests/readDiagnostics.test.tsx`) ולא בהערה: המבחן בונה
// הודעה עם ערכים ייחודיים, מריץ את כל הצינור, ומוודא שאף אחד מהם אינו מופיע
// ב-JSON של התוצאה. שדה טקסט חופשי שמישהו יוסיף כאן מחר — יפיל אותו.
//
// והסיבה שזה קריטי דווקא כאן: המונים האלה נכתבים ל-`syncRuns` ב-Firestore
// ומוצגים במסך. `check-order-logging.mjs` שומרת על Cloud Logging; היא לא
// יודעת דבר על אוסף שאנחנו כותבים אליו בעצמנו. השמירה הזאת היא של המבחן.
//
// ---------------------------------------------------------------------------
// ★ למה טווחים (min/max) ולא ממוצע
// ---------------------------------------------------------------------------
// ממוצע של 60 הודעות מחביא בדיוק את מה שמחפשים: הודעה אחת חריגה נעלמת בו.
// טווח עונה על שתי שאלות בבת אחת — "מה הערך" ו"האם כולן אותו דבר": כש-
// `min === max` ידוע שכל 60 ההודעות זהות במדד הזה, וזו אינפורמציה בפני
// עצמה.
// ============================================================================

import type { BodyMeasure } from './orderSource';
import type { OrderStructureMeasure } from './orderParse';

/**
 * ★ טווח של מדד אחד. `null` כשלא נמדדה אף הודעה.
 *
 * `min === max` פירושו שכל ההודעות שנמדדו זהות במדד הזה.
 */
export interface MeasureRange {
  min: number | null;
  max: number | null;
}

/**
 * ★★ פילוח הקנוניזציה. **מונים ולא מחרוזות** — כותרת החתימה נכתבת על ידי
 * מי ששלח, ומונה מרשימה סגורה אינו יכול לשאת טקסט שלו.
 */
export interface CanonCounts {
  simple: number;
  relaxed: number;
  other: number;
}

/**
 * ★★ פילוח צורת התאים של טבלת המוצרים. מונים, ורשימה סגורה מהקוד.
 *
 * זה המדד שהיה חסר: עד היום `table=0` אמר "לא נמצאה טבלה" ולא אמר **למה**.
 * `stacked=60` פירושו שהצורה האמיתית היא תא-בשורה, ו-`none=60` פירושו
 * שגם היא אינה מתאימה — ואז יודעים מיד שההנחה הבאה צריכה להיבדק, במקום
 * לנחש עוד סיבוב.
 */
export interface CellModeCounts {
  inline: number;
  stacked: number;
  none: number;
}

/**
 * ★★ תווית שחסרה, ו**בכמה הודעות** היא חסרה.
 *
 * ---------------------------------------------------------------------------
 * למה המונה, ולא רק השם
 * ---------------------------------------------------------------------------
 * `labelsMissing` היא רשימת חיתוך: תווית נכנסת אליה אם חסרה **בלפחות אחת**
 * מההודעות. כלומר "`מיקוד` חסר" יכול להיות גם "אף הודעה לא מכילה אותו,
 * המבנה השתנה" וגם "לקוחה אחת מתוך 60 לא מילאה מיקוד" — שני דברים שאין
 * ביניהם שום קשר, ושהמדידה עד היום לא ידעה להבדיל ביניהם.
 *
 * המונה הזה מכריע בלי לנחש: `count === messages` → מבנה. `count === 1` →
 * שדה ריק בהודעה אחת, וזו גם הסיבה ש`מיקוד` **אינו** ב-`REQUIRED_LABELS`.
 *
 * ⛔ `label` הוא מחרוזת קבועה מ-`ORDER_LABELS`, ולעולם לא מה שכתוב אחריה.
 */
export interface LabelMissCount {
  label: string;
  count: number;
}

/** פילוח החלקים שנבחרו. ארבעה מונים, לא רשימה. */
export interface PartSelectionCounts {
  text: number;
  html: number;
  unknown: number;
  none: number;
}

export interface ReadDiagnostics {
  /** כמה הודעות נמדדו — כלומר עברו את בדיקת השולח והגיעו לקריאה. */
  messages: number;

  /** אורך הגוף הגולמי, בבתים, לפני חיתוך. */
  bodyBytesRaw: MeasureRange;
  /**
   * ★★ אורך הגוף ה**מקונן** — זה שעליו `l=` נמדד.
   *
   * ההפרש `bodyBytesRaw - canonBodyBytes` הוא מה שהקנוניזציה מורידה, והוא
   * היה בדיוק גודל הטעות בחיתוך הישן: חתכנו את הגולמי במספר שנספר על
   * המקונן.
   */
  canonBodyBytes: MeasureRange;
  /** ★★ ה-`l=` שנקרא מהחתימה. הטווח כולל רק הודעות שבהן היה תג. */
  signedLimit: MeasureRange;
  /** כמה הודעות **לא** היה בהן `l=` כלל — כלומר כל הגוף חתום. */
  signedLimitAbsent: number;
  /** כמה בתים נחתכו בפועל. */
  bytesDropped: MeasureRange;
  /**
   * ★★ `c=` — הקנוניזציה שעליה `l=` נספר.
   *
   * זה המדד שמכריע אם החיתוך שלנו נופל במקום הנכון: `relaxed > 0` פירושו
   * ש-`l=` נמדד על גוף מכווץ, ושחיתוך הגוף הגולמי באותו מספר בתים חותך
   * **מוקדם מדי** — כלומר באמצע הזמנה תקינה, בלי שאיש נגע בהודעה.
   */
  bodyCanon: CanonCounts;

  /** מאיזה חלק MIME נקרא, לפי מונה. */
  partsSelected: PartSelectionCounts;
  /** ★★ בכמה הודעות החלק שנבחר **לא** נסגר בגבול תקין. */
  partsIncomplete: number;
  /** אורך החלק שנבחר, בבתים, אחרי החיתוך. */
  partBytes: MeasureRange;

  /** כמה הודעות הגיעו עד שלב המבנה ונמדדו. */
  structuresMeasured: number;
  /**
   * ★★ תוויות שנמצאו **בכל** ההודעות שנמדדו.
   *
   * חיתוך ולא איחוד, וזו הכרעה: איחוד היה אומר "נמצאה ב-1 מתוך 60" ונקרא
   * כמו "נמצאה". שתי הרשימות כאן **זרות זו לזו ומכסות יחד את כל התוויות**,
   * ולכן אפשר לקרוא אותן בלי להסביר.
   */
  labelsFound: string[];
  /** תוויות שחסרו ב**לפחות אחת** מההודעות שנמדדו. */
  labelsMissing: string[];
  /** בכמה מההודעות שנמדדו נמצאה טבלת מוצרים. */
  productTableFound: number;
  /** ★ כמה שורות מוצר זוהו, כטווח על פני ההודעות שנמדדו. */
  productRows: MeasureRange;
  /** ★★ באיזו צורה נקראה הטבלה. */
  productCellMode: CellModeCounts;
  /** ★★ בכמה הודעות הייתה שורה באזור הטבלה שלא נקראה כרשומה שלמה. */
  rowsUnreadable: number;
  /**
   * ★★ לכל תווית חסרה — בכמה הודעות היא חסרה. ממוין מהגבוה לנמוך.
   * ראה `LabelMissCount`: זה מה שמבדיל "המבנה השתנה" מ"שדה ריק אצל לקוחה".
   */
  labelsMissingCounts: LabelMissCount[];
}

export const EMPTY_READ_DIAGNOSTICS: ReadDiagnostics = {
  messages: 0,
  bodyBytesRaw: { min: null, max: null },
  canonBodyBytes: { min: null, max: null },
  signedLimit: { min: null, max: null },
  signedLimitAbsent: 0,
  bytesDropped: { min: null, max: null },
  bodyCanon: { simple: 0, relaxed: 0, other: 0 },
  partsSelected: { text: 0, html: 0, unknown: 0, none: 0 },
  partsIncomplete: 0,
  partBytes: { min: null, max: null },
  structuresMeasured: 0,
  labelsFound: [],
  labelsMissing: [],
  productTableFound: 0,
  productRows: { min: null, max: null },
  productCellMode: { inline: 0, stacked: 0, none: 0 },
  rowsUnreadable: 0,
  labelsMissingCounts: [],
};

/**
 * ★★ מסמך שנכתב לפני שהמדידה הזאת נוספה → סיכום שלם.
 *
 * הריצה האחרונה נשמרת ב-Firestore, ומסך שקורא אותה מקבל **את מה שנכתב אז**
 * ולא את הטיפוס של היום. בלי ההשלמה הזאת, כל שדה חדש כאן היה מפיל את המסך
 * של מי שכבר סינכרן — שגיאה שנראית כמו "הכלי נשבר" ואין לה שום קשר לנתונים.
 *
 * ★ ההשלמה עמוקה בכוונה: `{...EMPTY, ...raw}` לבדו היה משאיר אובייקט מקונן
 * חסר (`productCellMode` בלי `stacked`), כלומר בדיוק אותה נפילה, רק שורה
 * אחת אחר כך.
 */
export function hydrateDiagnostics(raw: unknown): ReadDiagnostics {
  const d = (raw ?? {}) as Partial<ReadDiagnostics>;
  const range = (r: MeasureRange | undefined): MeasureRange => ({
    min: typeof r?.min === 'number' ? r.min : null,
    max: typeof r?.max === 'number' ? r.max : null,
  });
  const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  const names = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  return {
    messages: count(d.messages),
    bodyBytesRaw: range(d.bodyBytesRaw),
    canonBodyBytes: range(d.canonBodyBytes),
    signedLimit: range(d.signedLimit),
    signedLimitAbsent: count(d.signedLimitAbsent),
    bytesDropped: range(d.bytesDropped),
    bodyCanon: { ...EMPTY_READ_DIAGNOSTICS.bodyCanon, ...(d.bodyCanon ?? {}) },
    partsSelected: { ...EMPTY_READ_DIAGNOSTICS.partsSelected, ...(d.partsSelected ?? {}) },
    partsIncomplete: count(d.partsIncomplete),
    partBytes: range(d.partBytes),
    structuresMeasured: count(d.structuresMeasured),
    labelsFound: names(d.labelsFound),
    labelsMissing: names(d.labelsMissing),
    productTableFound: count(d.productTableFound),
    productRows: range(d.productRows),
    productCellMode: { ...EMPTY_READ_DIAGNOSTICS.productCellMode, ...(d.productCellMode ?? {}) },
    rowsUnreadable: count(d.rowsUnreadable),
    labelsMissingCounts: Array.isArray(d.labelsMissingCounts)
      ? d.labelsMissingCounts
          .filter(
            (x): x is LabelMissCount =>
              Boolean(x) && typeof x.label === 'string' && typeof x.count === 'number',
          )
          .map((x) => ({ label: x.label, count: x.count }))
      : [],
  };
}

function rangeOf(values: readonly number[]): MeasureRange {
  if (values.length === 0) return { min: null, max: null };
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * ★★ מדידות של ריצה אחת → סיכום אחד.
 *
 * הפונקציה טהורה ומקבלת את שתי הרשימות בנפרד, כי הן נאספות בשני שלבים
 * שונים: `readOrderBodies` מודדת את הקריאה, `parseOrderMessage` את המבנה.
 * הודעה שנעצרה בחתימה תופיע ברשימה הראשונה ולא בשנייה — וזה בדיוק ההבדל
 * ש-`structuresMeasured` מדווח.
 */
export function summarizeReads(
  measures: readonly BodyMeasure[],
  structures: readonly OrderStructureMeasure[],
): ReadDiagnostics {
  const partsSelected: PartSelectionCounts = { text: 0, html: 0, unknown: 0, none: 0 };
  const bodyCanon: CanonCounts = { simple: 0, relaxed: 0, other: 0 };
  const productCellMode: CellModeCounts = { inline: 0, stacked: 0, none: 0 };
  for (const s of structures) productCellMode[s.productCellMode]++;
  for (const m of measures) {
    partsSelected[m.partSelected]++;
    bodyCanon[m.bodyCanon]++;
  }

  const limits = measures
    .map((m) => m.signedLimit)
    .filter((l): l is number => typeof l === 'number');

  // ★ חיתוך התוויות: תווית נחשבת "נמצאה" רק אם היא נמצאה בכל ההודעות.
  // כל תווית שמוכרת לנו — מכל מדידה — נכנסת לאחת משתי הרשימות.
  const allLabels: string[] = [];
  for (const s of structures) {
    for (const label of [...s.labelsFound, ...s.labelsMissing]) {
      if (!allLabels.includes(label)) allLabels.push(label);
    }
  }
  const labelsFound = allLabels.filter((label) =>
    structures.every((s) => s.labelsFound.includes(label)),
  );
  const labelsMissing = allLabels.filter((label) => !labelsFound.includes(label));
  // ★★ ולכל תווית חסרה — בכמה הודעות. ראה `LabelMissCount`.
  const labelsMissingCounts = labelsMissing
    .map((label) => ({
      label,
      count: structures.filter((s) => !s.labelsFound.includes(label)).length,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    messages: measures.length,
    bodyBytesRaw: rangeOf(measures.map((m) => m.bodyBytesRaw)),
    canonBodyBytes: rangeOf(measures.map((m) => m.canonBodyBytes)),
    signedLimit: rangeOf(limits),
    signedLimitAbsent: measures.length - limits.length,
    bytesDropped: rangeOf(measures.map((m) => m.bytesDropped)),
    bodyCanon,
    partsSelected,
    partsIncomplete: measures.filter((m) => !m.partComplete).length,
    partBytes: rangeOf(measures.map((m) => m.partBytes)),
    structuresMeasured: structures.length,
    labelsFound,
    labelsMissing,
    productTableFound: structures.filter((s) => s.productTableFound).length,
    productRows: rangeOf(structures.map((s) => s.productRows)),
    productCellMode,
    rowsUnreadable: structures.filter((s) => s.productRowsUnreadable > 0).length,
    labelsMissingCounts,
  };
}

/**
 * ★ טווח → מחרוזת קצרה להצגה. `null` → `'—'`, טווח אחיד → מספר יחיד.
 *
 * זה כאן ולא במסך כי זו לוגיקה ולא עיצוב: ההחלטה ש"1200" ו"1200–1200" הם
 * אותו דבר, ושצריך להציג את הראשון, היא חלק ממה שהמדידה אומרת.
 */
export function formatRange(range: MeasureRange): string {
  if (range.min === null || range.max === null) return '—';
  if (range.min === range.max) return String(range.min);
  // ★ מקף ASCII ולא מקף עברי: השורה הקומפקטית נועדה להצטלם ולהיכתב מחדש
  // בטלפון, וסימן שאי אפשר להקליד בקלות הופך אותה למשהו שמשכתבים לא נכון.
  return `${range.min}-${range.max}`;
}
