// ============================================================================
// settlement.ts — ★ הצורה המנורמלת של דוח גבייה. **בלי שום פרסר.**
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה נכתב לפני שראינו קובץ אחד
// ---------------------------------------------------------------------------
// בעלת העסק מקבלת שני דוחות על אותה תקופה — אחד מחברת הסליקה ואחד מחברת
// האשראי — ורוצה לדעת מה לא מסתדר ביניהם. ההשוואה עצמה אינה תלויה בשאלה
// איך כל דוח נראה: היא תלויה בתאריך, בסכום, ובאסמכתא. **זה** מה שיושב כאן.
//
// ⛔ ומה שלא יושב כאן, בכוונה מפורשת: **שמות עמודות, הנחה על CSV מול Excel,
// ניחוש קידוד.** לפני שבועיים נשרפו ארבעה סבבים על פרסר ההזמנות מהשורש הזה
// בדיוק — הפרסר אומת מול קלט שאנחנו כתבנו, ואז פגש קובץ אמיתי. פרסר נכתב
// אחרי שרואים קובץ, לא לפניו.
//
// ---------------------------------------------------------------------------
// ★★ סכומים באגורות, כמספר שלם. לא שקלים ב-float.
// ---------------------------------------------------------------------------
// אי-דיוק של float הוא לא טריוויה: בהשוואת כסף הוא הבאג שמופיע **רק על
// נתונים אמיתיים** — סכום של 300 שורות שיוצא באגורה אחת שונה, ואז שעה של
// חיפוש אחרי שורה שלא קיימת. מספר שלם של אגורות הופך חיבור והשוואה לפעולה
// מדויקת, ועולה שורת המרה אחת בקצה.
//
// המשמעות למי שיכתוב אדפטר בעתיד: **ההמרה לאגורות היא באחריות האדפטר**,
// והיא חייבת להיות עיגול מפורש דרך `toAgorot`.
// ============================================================================

/** מקור הדוח. שני שמות בלבד — כל שם נוסף הוא החלטה, לא פרט טכני. */
export type SettlementSource = 'tranzila' | 'gamma';

/**
 * השם שהמשתמשת רואה **כשהוא עומד לבדו**. היא לא מכירה מזהה באנגלית, היא
 * מכירה "הדוח מגמא".
 */
export const SOURCE_HE: Record<SettlementSource, string> = {
  tranzila: 'הדוח מטרנזילה',
  gamma: 'הדוח מגמא',
};

/**
 * ★★ אותו שם, **לשימוש אחרי תחילית**. שתי צורות, ולא אחת שמתוקנת בדרך.
 *
 * "ב" + "הדוח מטרנזילה" נותן **"בהדוח מטרנזילה"**, וזה אינו עברית: התחילית
 * והה"א הידיעה לא יכולות לשבת זו על זו. זה בדיוק סוג הטעות שמשתמשת מרגישה
 * מיד ולא יודעת לנסח — היא פשוט מפסיקה לסמוך על מה שכתוב.
 *
 * ⛔ והתיקון **אינו** `replace('בה','ב')` על המחרוזת המורכבת: זה תיקון על
 * הפלט במקום על הקלט, הוא ישבור כל מילה אחרת שמתחילה ב"בה", והוא יידרש שוב
 * בכל מקום חדש שמשרשר. מחזיקים שתי צורות במקור אחד, ובוחרים לפי ההקשר.
 *
 * "מופיע רק ב" + "דוח טרנזילה" → "מופיע רק בדוח טרנזילה". ✓
 */
export const SOURCE_HE_BARE: Record<SettlementSource, string> = {
  tranzila: 'דוח טרנזילה',
  gamma: 'דוח גמא',
};

/**
 * ★★ המזעור, **ברמת הטיפוס.**
 *
 * בקובץ של טרנזילה יש ת.ז, טוקן כרטיס, ארבע ספרות אחרונות, כתובת IP ומספר
 * חשבון בנק. שום דבר מזה אינו נחוץ להשוואה — וכל דבר מזה שייכנס למבנה
 * בזיכרון יופיע ביום שאחרי בייצוא, בהודעת שגיאה או בצילום מסך.
 *
 * "האדפטר לא קורא את העמודות האלה" היא טענה על מה שנעשה, ובפרויקט הזה כבר
 * למדנו שלוש פעמים כמה היא שווה. `?: never` הופך את זה מהחלטה לכלל שהקומפיילר
 * אוכף: מי שינסה לשאת את השדות האלה הלאה **לא יצליח לבנות**.
 *
 * ⚠️ ולדיוק, כי ההערה הקודמת כאן הגזימה: הקובץ **כן נקרא במלואו** — הוא ZIP,
 * ואין דרך לפרוס ממנו שבע עמודות בלבד. מה שצר הוא **ההחזקה**: ה-`SheetGrid`
 * מת עם הפונקציה, ומה ששורד הוא רק מה שהטיפוס הזה מרשה.
 *
 * ---------------------------------------------------------------------------
 * 🔴★★ וזו ההערה החשובה ביותר בקובץ הזה
 * ---------------------------------------------------------------------------
 * **מה שמחזיק את הפיצ׳ר הזה מחוץ לשער המשפטי הוא המזעור — ולא
 * `check-no-upload.mjs`.**
 *
 * קל להניח את ההפך, כי השער הוא מה שרואים: הוא רץ בכל build, הוא מדפיס ✓,
 * והוא מגן על משפט שכתוב על המסך. אבל הטענה שהוא מוכיח ("אין נתיב ששולח או
 * שומר") היא **לא** הטענה הנושאת. הטענה הנושאת היא שבפלט **אין אדם**: אין
 * שם, אין ת.ז, אין כרטיס, אין IP — ולכן אין נושא מידע, ולכן אין כאן אוסף
 * חדש של מידע אישי.
 *
 * הנגזרת המעשית, ובגללה ההערה כאן ולא בשער: **אם מישהו יוסיף עמודה שמינית
 * לפרסר, `check-no-upload.mjs` יישאר ירוק** — הוא לא יודע מה יש בשורה, רק
 * לאן היא הולכת. הקרקע המשפטית תיעלם, ואף בדיקה לא תיפול. השדות `?: never`
 * כאן, יחד עם מבחני הדליפה ב-`tests/settlementAdapters.test.ts`,
 * `tests/reconcileUpload.test.tsx` ו-`tests/reconcileCsv.test.ts`, הם השער
 * האמיתי. **אין להוריד אותם בדרגה, ואין להרחיב את הרשימה בלי סקירה.**
 */
export interface MinimizedFields {
  readonly idNumber?: never;
  readonly cardNumber?: never;
  readonly cardLast4?: never;
  readonly cardToken?: never;
  readonly ipAddress?: never;
  readonly bankAccount?: never;
  readonly holderName?: never;
  readonly terminalName?: never;
  readonly customerName?: never;
  readonly email?: never;
  readonly phone?: never;
}

/** השמות של שדות המזעור, לשימוש מבחן שמוכיח שהם באמת אינם בפלט. */
export const MINIMIZED_FIELD_NAMES = [
  'idNumber',
  'cardNumber',
  'cardLast4',
  'cardToken',
  'ipAddress',
  'bankAccount',
  'holderName',
  'terminalName',
  'customerName',
  'email',
  'phone',
] as const;

export interface SettlementRow extends MinimizedFields {
  /** מיקום בקובץ המקורי. קיים כדי שנוכל לומר לה "שורה 47" ולא "עסקה כלשהי". */
  readonly rowIndex: number;
  /** ISO yyyy-mm-dd. תאריך בלבד, בלי שעה ובלי אזור זמן. */
  readonly date: string;
  /** אגורות, מספר שלם. **שלילי = זיכוי/החזר.** */
  readonly amount: number;
  /** אסמכתא / מספר אישור, אם הדוח נותן כזה. */
  readonly reference: string | null;
  /** תיאור חופשי כפי שהופיע בדוח — **לתצוגה בלבד.** אף התאמה לא נשענת עליו. */
  readonly label: string | null;
  /**
   * ★ הניכויים, כשהדוח מדווח אותם. קיימים רק בצד שמנכה (גמא) — ולכן
   * אופציונליים ולא אפס: אפס הוא טענה ש**לא** נוכה כלום, וזה לא אותו דבר.
   *
   * ⚠️ ההשוואה בין הדוחות נעשית על `amount` (ברוטו) בלבד. הניכויים כאן הם
   * מה שהיא רוצה **לראות** — "נגבו X, נוכו Y, נכנסו Z" — ולא קלט להתאמה.
   */
  readonly feeAgorot?: number;
  readonly vatAgorot?: number;
  readonly netAgorot?: number;
}

/**
 * ★★ עסקה **שלא עברה**, ולכן לעולם לא תופיע בדוח של חברת האשראי.
 *
 * זו הקטגוריה השלישית, והיא הסיבה שהיא פותחת את המסך הזה. שורה כזאת אינה
 * "חסרה בדוח השני" — היא מעולם לא נסלקה. ההבדל אינו סמנטי: "הכסף לא הגיע"
 * שולח אותה לחפש כסף אצל חברת האשראי, ו"העסקה לא עברה" שולח אותה ללקוחה.
 */
export interface DeclinedRow extends MinimizedFields {
  readonly rowIndex: number;
  readonly date: string;
  /** הסכום שהיה אמור להיגבות, ולא נגבה. */
  readonly amount: number;
  readonly reference: string | null;
  /** הסיבה **כפי שהיא כתובה בקובץ**, בלי פירוש ובלי תרגום. */
  readonly reasonHe: string;
}

export interface UnreadableRow {
  readonly rowIndex: number;
  /** למה לא הצלחנו לקרוא אותה, בעברית שהמשתמשת מבינה. */
  readonly reasonHe: string;
}

export interface SettlementReport {
  readonly source: SettlementSource;
  readonly rows: readonly SettlementRow[];
  /**
   * ★★ עסקאות שנדחו. אופציונלי כדי שדוח שאין בו מושג כזה לא ייאלץ להצהיר
   * על רשימה ריקה — אבל **כל צרכן חייב להציג אותן**, ולא לספור אותן כחסר.
   */
  readonly declinedRows?: readonly DeclinedRow[];
  /**
   * ★ שורות שלא נקראו **נשארות בדוח**, ולא נזרקות בשקט. דוח שבו 12 שורות
   * נעלמו ואיש לא אמר על כך דבר הוא בדיוק הצורה שבה כלי כזה משקר: הסיכום
   * ייראה תקין, וההפרש ייראה קטן ממה שהוא באמת.
   */
  readonly unreadableRows: readonly UnreadableRow[];
}

/** דוח ריק של מקור נתון. שימושי כמצב התחלתי ובמבחנים. */
export function emptyReport(source: SettlementSource): SettlementReport {
  return { source, rows: [], unreadableRows: [], declinedRows: [] };
}

/** העסקאות שנדחו בדוח, תמיד כמערך. */
export function declinedOf(report: SettlementReport): readonly DeclinedRow[] {
  return report.declinedRows ?? [];
}

// ---------------------------------------------------------------------------
// כסף
// ---------------------------------------------------------------------------

/**
 * שקלים → אגורות, בעיגול מפורש.
 *
 * ★ עיגול ולא קיצוץ: הכפלה ב-100 של מספר עשרוני נותנת לעיתים ערך שנופל
 * טיפה מתחת לשלם, וקיצוץ היה גורע אגורה שלמה מהסכום.
 */
export function toAgorot(shekels: number): number {
  if (!Number.isFinite(shekels)) throw new RangeError('סכום שאינו מספר');
  return Math.round(shekels * 100);
}

/** אגורות → מחרוזת לתצוגה. שלילי מוצג עם מינוס. */
export function formatAgorot(agorot: number): string {
  const sign = agorot < 0 ? '-' : '';
  const abs = Math.abs(agorot);
  const whole = Math.trunc(abs / 100);
  const cents = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}.${String(cents).padStart(2, '0')} ₪`;
}

/** סכום של שורות, באגורות. חיבור של מספרים שלמים — מדויק תמיד. */
export function sumAgorot(rows: readonly { readonly amount: number }[]): number {
  let total = 0;
  for (const row of rows) total += row.amount;
  return total;
}

// ---------------------------------------------------------------------------
// ניכויים
// ---------------------------------------------------------------------------

/**
 * ★ "נגבו X, נוכו Y, נכנסו Z" — שלושת המספרים שהיא מחפשת.
 *
 * הם **אינם** חלק מההשוואה: ההשוואה היא ברוטו מול ברוטו, ואמורה לצאת אפס.
 * אלה מספרים שהיא רוצה לראות, ושעד היום חישבה ביד.
 */
export interface DeductionSummary {
  readonly grossAgorot: number;
  readonly feeAgorot: number;
  readonly vatAgorot: number;
  readonly netAgorot: number;
  /** כמה שורות דיווחו ניכוי. */
  readonly rowCount: number;
}

/**
 * סיכום הניכויים של דוח, או `null` כשהדוח אינו מדווח ניכויים כלל.
 *
 * ★ `null` ולא סיכום של אפסים: דוח בלי ניכויים ודוח שניכה 0 ₪ הם שתי
 * אמירות שונות, ורק אחת מהן ראויה להופיע על המסך.
 */
export function deductionsOf(report: SettlementReport): DeductionSummary | null {
  let gross = 0;
  let fee = 0;
  let vat = 0;
  let net = 0;
  let rowCount = 0;

  for (const row of report.rows) {
    if (row.feeAgorot === undefined && row.vatAgorot === undefined && row.netAgorot === undefined) {
      continue;
    }
    rowCount += 1;
    gross += row.amount;
    fee += row.feeAgorot ?? 0;
    vat += row.vatAgorot ?? 0;
    net += row.netAgorot ?? row.amount - (row.feeAgorot ?? 0) - (row.vatAgorot ?? 0);
  }

  if (rowCount === 0) return null;
  return { grossAgorot: gross, feeAgorot: fee, vatAgorot: vat, netAgorot: net, rowCount };
}

// ---------------------------------------------------------------------------
// תאריכים — חשבון על מחרוזות, בלי אזור זמן
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** האם המחרוזת היא yyyy-mm-dd תקין ואמיתי (30 בפברואר אינו תקין). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d));
  return (
    asDate.getUTCFullYear() === y && asDate.getUTCMonth() === m - 1 && asDate.getUTCDate() === d
  );
}

/**
 * מספר הימים בין שני תאריכים, כהפרש `to` פחות `from`. חיובי = `to` מאוחר יותר.
 *
 * ★ חשבון ב-UTC ולא פירוש מקומי של מחרוזת: המחשב של המשתמשת בישראל, מחשב
 * אחר לא, ושעון קיץ מזיז את חצות. חישוב על תאריך-בלבד ב-UTC נותן אותה
 * תשובה בכל מקום — וזה תנאי לדטרמיניזם של כל המנוע.
 */
export function daysBetween(from: string, to: string): number {
  const at = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// תקופה
// ---------------------------------------------------------------------------

export interface Period {
  /** ISO yyyy-mm-dd, כולל. */
  readonly from: string;
  /** ISO yyyy-mm-dd, **כולל**. היום האחרון בחודש נכלל בתוך הטווח. */
  readonly to: string;
}

/** האם התאריך בתוך התקופה (שני הקצוות כלולים). */
export function isWithinPeriod(date: string, period: Period): boolean {
  return date >= period.from && date <= period.to;
}

/**
 * מסנן דוח לתקופה. השורות שלא נקראו **נשארות** — הן חסרות תאריך מעצם
 * הגדרתן, ולא ייתכן לדעת אם הן בתקופה. להעלים אותן בסינון היה מסתיר בדיוק
 * את מה שצריך לראות.
 */
export function filterByPeriod(report: SettlementReport, period: Period): SettlementReport {
  return {
    source: report.source,
    rows: report.rows.filter((r) => isWithinPeriod(r.date, period)),
    unreadableRows: report.unreadableRows,
    // ★ גם הנדחות מסוננות לתקופה. הן שורות עם תאריך אמיתי, ואילו היו
    //   נשארות מחוץ לסינון היא הייתה רואה ביולי עסקה שנדחתה בפברואר.
    declinedRows: declinedOf(report).filter((r) => isWithinPeriod(r.date, period)),
  };
}

/** תחילת החודש וסופו, עבור מפתח חודש בצורת yyyy-mm. */
export function monthPeriod(monthKey: string): Period {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(last).padStart(2, '0')}` };
}

/** מפתח החודש שקדם לתאריך שניתן. ברירת המחדל של המסך. */
export function previousMonthKey(today: string): string {
  const [y, m] = today.split('-').map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, '0')}`;
}

/** מפתח החודש של התאריך שניתן. */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

const MONTHS_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/** מפתח חודש → שם החודש בעברית ושנה. */
export function monthLabelHe(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS_HE[m - 1] ?? monthKey} ${y}`;
}

/** תאריך ISO → תאריך לתצוגה, כמו שהיא כותבת אותו. */
export function formatDateHe(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}.${m}.${y}`;
}
