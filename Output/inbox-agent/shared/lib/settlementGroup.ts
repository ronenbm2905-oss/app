// ============================================================================
// settlementGroup.ts — ★★ הממצא שמשנה את העיצוב: **הגרעין אינו העסקה.**
//
// ---------------------------------------------------------------------------
// מה נמדד בשני הקבצים האמיתיים
// ---------------------------------------------------------------------------
// טרנזילה נותנת **שורה לכל עסקה**. גמא נותנת **שורה לכל (מספר שידור ×
// מותג)**, מצטברת. שני המבנים אינם מתיישרים זה על זה בשום כיוון, ושתי
// הצורות הופיעו באותו קובץ:
//
//   · שידור אחד = **שתי עסקאות** בטרנזילה מול **שורה אחת** בגמא, שסכומה
//     הוא סכום שתיהן.
//   · שידור אחר = **שתי עסקאות** בטרנזילה מול **שתי שורות** בגמא, כי
//     המותג שונה.
//
// כלומר: ההתאמה **אינה** עסקה-לעסקה, ואינה שורה-לשורה. היא **שידור לשידור**.
//
// ---------------------------------------------------------------------------
// ★★ ולמה לא מיפוי מותגים
// ---------------------------------------------------------------------------
// שמות המותגים שונים בין שני הקבצים ("מאסטרקארד" מול "מסטר~"). מיפוי ביניהם
// הוא ניחוש — ובעיקר הוא **מיותר**: קיבוץ לפי מספר שידור בלבד נתן על
// הנתונים האמיתיים התאמה מלאה, כל שידור מול המקבילה שלו ובפער אפס. פיצ׳ר
// שמוסיף ניחוש כדי להגיע לאותה תשובה הוא פיצ׳ר שיישבר על הקובץ הבא.
//
// ---------------------------------------------------------------------------
// ★ ולמה זה **לא** נכנס ל-`reconcile.ts`
// ---------------------------------------------------------------------------
// המנוע כבר יודע לעשות בדיוק את מה שצריך: להתאים לפי אסמכתא, לסרב לנחש
// כשהיא כפולה, ולמדוד פערים. השינוי כאן אינו בהתאמה אלא ב**מה שנכנס** אליה.
// לכן זה שלב שקודם לו — פונקציה טהורה שהופכת דוח ברמת עסקה לדוח ברמת שידור,
// והמנוע ממשיך לרוץ כמו שהוא. שכבה דקה מחוץ למנוע במקום עוד מצב בתוכו.
//
// ---------------------------------------------------------------------------
// ★ ושורות המקור נשמרות
// ---------------------------------------------------------------------------
// קבוצה שלא תאמה היא בדיוק הרגע שבו היא צריכה לראות **ממה היא מורכבת** —
// סכום מצטבר, ומתחתיו שתי העסקאות שהרכיבו אותו. קבוצה בלי החברים שלה היא
// מספר שאי אפשר ללכת איתו לקובץ המקורי ולבדוק.
// ============================================================================

import {
  declinedOf,
  type SettlementReport,
  type SettlementRow,
} from './settlement';

/** שורה מקובצת: כל מה ששורה רגילה היא, ועוד שורות המקור שהרכיבו אותה. */
export interface GroupedSettlementRow extends SettlementRow {
  readonly members: readonly SettlementRow[];
}

/** האם השורה הזאת היא קבוצה. משמש את המסך כדי לדעת אם לפרט. */
export function isGrouped(row: SettlementRow): row is GroupedSettlementRow {
  return Array.isArray((row as GroupedSettlementRow).members);
}

/**
 * שורות המקור של שורה — הקבוצה שלה, או היא עצמה.
 * קיים כדי שהמסך והייצוא לא יצטרכו לבדוק את הטיפוס בכל מקום.
 */
export function membersOf(row: SettlementRow): readonly SettlementRow[] {
  return isGrouped(row) ? row.members : [row];
}

/**
 * נירמול מפתח הקיבוץ.
 *
 * ★ זהה במכוון ל-`normalizeReference` של המנוע: רווחים ואותיות בלבד. הסרת
 * אפסים מובילים הייתה מחברת מספר שידור עם אפס מוביל לאחד בלעדיו — אולי
 * נכון, ואולי חיבור של שני שידורים שונים. אנחנו לא מנחשים על פורמט.
 */
function keyOf(reference: string | null): string | null {
  if (reference === null) return null;
  const normalized = reference.trim().replace(/\s+/g, ' ').toUpperCase();
  return normalized === '' ? null : normalized;
}

function sumDefined(
  rows: readonly SettlementRow[],
  pick: (row: SettlementRow) => number | undefined,
): number | undefined {
  let total = 0;
  let any = false;
  for (const row of rows) {
    const value = pick(row);
    if (value === undefined) continue;
    any = true;
    total += value;
  }
  return any ? total : undefined;
}

function labelOf(members: readonly SettlementRow[]): string | null {
  if (members.length === 1) return members[0].label;
  // ★ מה שהיא צריכה לדעת מיד: שהמספר שלמעלה אינו עסקה אחת.
  return `${members.length} עסקאות באותו שידור`;
}

/**
 * ★★ דוח ברמת עסקה → דוח ברמת שידור.
 *
 * · המפתח הוא האסמכתא (מספר השידור) בלבד.
 * · הסכום הוא **הסכום המצטבר** של הקבוצה, בחיבור מספרים שלמים.
 * · התאריך הוא **המוקדם ביותר** בקבוצה — הוא התאריך שבו העסקה הראשונה
 *   באמת קרתה, והוא זה שצריך לעמוד מול חלון הסבילות של המנוע.
 * · `rowIndex` הוא הקטן ביותר, כדי ש"שורה 12" תצביע על תחילת הקבוצה בקובץ.
 *
 * ⚠️ שורה **בלי** אסמכתא אינה מקובצת עם שורות אחרות חסרות אסמכתא. אין להן
 * מפתח משותף, ואיחוד שלהן היה המצאת קבוצה שלא קיימת בשום קובץ.
 */
export function groupBySettlement(report: SettlementReport): SettlementReport {
  const order: (string | number)[] = [];
  const buckets = new Map<string | number, SettlementRow[]>();

  for (const row of report.rows) {
    const key = keyOf(row.reference);
    // שורה בלי אסמכתא מקבלת מפתח ייחודי משלה — כלומר נשארת לבדה.
    const bucketKey: string | number = key === null ? row.rowIndex : `#${key}`;
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.push(row);
    } else {
      buckets.set(bucketKey, [row]);
      order.push(bucketKey);
    }
  }

  const rows: SettlementRow[] = order.map((bucketKey) => {
    const members = [...(buckets.get(bucketKey) ?? [])].sort((x, y) => x.rowIndex - y.rowIndex);
    const first = members[0];

    let date = first.date;
    let amount = 0;
    let rowIndex = first.rowIndex;
    for (const member of members) {
      if (member.date < date) date = member.date;
      if (member.rowIndex < rowIndex) rowIndex = member.rowIndex;
      amount += member.amount;
    }

    const grouped: GroupedSettlementRow = {
      rowIndex,
      date,
      amount,
      reference: first.reference,
      label: labelOf(members),
      feeAgorot: sumDefined(members, (m) => m.feeAgorot),
      vatAgorot: sumDefined(members, (m) => m.vatAgorot),
      netAgorot: sumDefined(members, (m) => m.netAgorot),
      members,
    };
    return grouped;
  });

  rows.sort((x, y) => (x.date !== y.date ? (x.date < y.date ? -1 : 1) : x.rowIndex - y.rowIndex));

  return {
    source: report.source,
    rows,
    unreadableRows: report.unreadableRows,
    declinedRows: declinedOf(report),
  };
}
