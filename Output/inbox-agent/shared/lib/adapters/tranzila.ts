// ============================================================================
// adapters/tranzila.ts — ★ הדוח מטרנזילה: **שורה לכל עסקה.**
//
// ---------------------------------------------------------------------------
// מה נמדד בקובץ האמיתי
// ---------------------------------------------------------------------------
// 33 עמודות. מהן **נישאות הלאה שבע**:
//
//   U  תאריך ושעה   → התאריך (סריאל של אקסל, עם שבר של שעה — נחתך)
//   V  סכום         → הסכום
//   W  מספר שידור   → ★ מפתח ההתאמה. ריק = העסקה לא נסלקה
//   K  מספר אישור   → לתצוגה בלבד
//   T  מספר עסקה    → לתצוגה בלבד
//   Z  סטטוס        → ריק = עברה; מלא = **נדחתה**, והטקסט הוא הסיבה
//   A  סוג תנועה    → 'חיוב'
//
// ---------------------------------------------------------------------------
// ⚠️★ ומה ש**לא נישא הלאה** — ולמה זה לא "לא נקרא"
// ---------------------------------------------------------------------------
// ת.ז, מספר כרטיס, ארבע ספרות אחרונות, כתובת IP, מספר חשבון, סניף וקוד בנק.
//
// ⚠️ **אבל הם כן נקראים.** כאן ישב קודם המשפט "כל השאר לא נכנסות לזיכרון
// בכלל", והוא פשוט לא נכון: הקובץ הוא ZIP, ו-`readSheetGrid` פורס אותו
// **במלואו** — כולל `xl/sharedStrings.xml`, שהיא טבלת המחרוזות של כל
// הגיליון ובה יושבים הת.ז ושמות בעלי הכרטיס — ובונה `Cell` לכל 33 העמודות
// של כל שורה. אין דרך לקרוא מ-ZIP שבע עמודות בלבד.
//
// ★ מה שכן צר, ובבחירה: ה-`SheetGrid` הוא **משתנה מקומי** בתוך `read()`
// שבמסך. הוא אינו נכנס ל-state, אינו נשמר, ואף לא אחד מ-33 השדות שורד את
// הפונקציה. **הקריאה רחבה בהכרח; ההחזקה צרה בבחירה** — ו-`MinimizedFields`
// הוא מה שאוכף אותה, כי הוא הופך נשיאה הלאה לשגיאת קומפילציה.
//
// 🔴 ולמה הוחלפו כאן שתי מילים: הערה שמתארת הגנה **חזקה מכפי שקיימת** גרועה
// מהיעדר הערה, כי היא עוצרת את הבדיקה הבאה. זו הפעם החמישית בפרויקט הזה
// שהתבנית הזאת נתפסת — הצהרה על מה שהקוד עושה, שלא אומתה מול מה שהקוד עושה.
//
// ---------------------------------------------------------------------------
// ★★ עמודת הסטטוס היא הפיצ׳ר, לא פרט טכני
// ---------------------------------------------------------------------------
// בקובץ שנמדד הייתה שורה עם `מספר שידור` ריק ועם טקסט סירוב בעמודת
// הסטטוס. היא הסבירה **את כל הפער** בין סכומי שני הדוחות: מה שנראה כמו כסף
// חסר היה בדיוק הסכום שנדחה.
//
// עסקה כזאת לא נסלקה ולעולם לא תופיע בגמא. אם נציג אותה כ"חסרה בדוח השני",
// נשלח אותה לחפש כסף שמעולם לא נגבה. לכן היא יוצאת לקטגוריה שלישית משלה.
//
// ---------------------------------------------------------------------------
// ★ זיהוי לפי צירוף כותרות, לא לפי שם קובץ ולא לפי סדר עמודות
// ---------------------------------------------------------------------------
// שם קובץ הוא מה שהיא שינתה בלי לשים לב, וסדר עמודות הוא מה שהיצוא ישנה
// בגרסה הבאה. הצירוף `מספר שידור` + `מספר אישור` קיים רק כאן.
// ============================================================================

import {
  toAgorot,
  type DeclinedRow,
  type SettlementRow,
  type UnreadableRow,
} from '../settlement';
import {
  cellAt,
  hasHeaders,
  headerIndex,
  serialToIso,
  type Cell,
} from '../xlsx';
import type { ReportAdapter } from '../reportAdapters';

/** הכותרות שבלעדיהן זה לא הקובץ הזה. */
export const TRANZILA_SIGNATURE = ['מספר שידור', 'מספר אישור'] as const;

const H = {
  date: 'תאריך ושעה',
  amount: 'סכום',
  settlement: 'מספר שידור',
  approval: 'מספר אישור',
  transaction: 'מספר עסקה',
  status: 'סטטוס',
  movement: 'סוג תנועה',
} as const;

/** סוג התנועה היחיד שנמדד בקובץ. ראו ההערה בגוף `parse`. */
const MOVEMENT_CHARGE = 'חיוב';

function numberOf(cell: Cell): number | null {
  if (cell.num !== null) return cell.num;
  const text = cell.text.replace(/[,\s₪]/g, '');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * התאריך. סריאל של אקסל, או ISO מפורש.
 *
 * ⚠️ במכוון **לא** `dd/mm/yyyy`: 3/4/2026 הוא גם ה-3 באפריל וגם ה-4 במרץ,
 * וההבדל בין השניים בחלון סבילות של שלושה ימים הוא התאמה שגויה. אין כאן
 * דרך לדעת, ולכן אין כאן ניחוש.
 */
function dateOf(cell: Cell): string | null {
  if (cell.num !== null) return serialToIso(cell.num);
  const text = cell.text.trim();
  return ISO.test(text) ? text : null;
}

interface Columns {
  readonly date: number;
  readonly amount: number;
  readonly settlement: number;
  readonly approval: number;
  readonly transaction: number;
  readonly status: number;
  readonly movement: number;
}

function labelOf(approval: string, transaction: string): string | null {
  const parts: string[] = [];
  if (approval !== '' && !/^0+$/.test(approval)) parts.push(`אישור ${approval}`);
  if (transaction !== '') parts.push(`עסקה ${transaction}`);
  return parts.length === 0 ? null : parts.join(' · ');
}

export const tranzilaAdapter: ReportAdapter = {
  id: 'tranzila-xlsx',
  source: 'tranzila',
  sourceHe: 'הדוח מטרנזילה',

  detect: (grid) => hasHeaders(grid, TRANZILA_SIGNATURE),

  parse: (grid) => {
    const columns: Columns = {
      date: headerIndex(grid, H.date),
      amount: headerIndex(grid, H.amount),
      settlement: headerIndex(grid, H.settlement),
      approval: headerIndex(grid, H.approval),
      transaction: headerIndex(grid, H.transaction),
      status: headerIndex(grid, H.status),
      movement: headerIndex(grid, H.movement),
    };

    const rows: SettlementRow[] = [];
    const declinedRows: DeclinedRow[] = [];
    const unreadableRows: UnreadableRow[] = [];

    for (const row of grid.rows) {
      const rowIndex = row.rowIndex;
      const date = dateOf(cellAt(row, columns.date));
      const shekels = numberOf(cellAt(row, columns.amount));
      const settlement = cellAt(row, columns.settlement).text.trim();
      const status = cellAt(row, columns.status).text.trim();
      const movement = cellAt(row, columns.movement).text.trim();

      if (date === null) {
        unreadableRows.push({ rowIndex, reasonHe: 'לא הצלחתי לקרוא את התאריך בשורה הזאת.' });
        continue;
      }
      if (shekels === null) {
        unreadableRows.push({ rowIndex, reasonHe: 'לא הצלחתי לקרוא את הסכום בשורה הזאת.' });
        continue;
      }

      // ★ הסכום הופך לאגורות **כאן**, בעיגול מפורש על ערך יחיד — ולא
      //   בסוף על סכום שנצבר. הכפלה ב-100 של שבר עשרוני נופלת לעיתים טיפה
      //   מתחת לשלם, וצבירה של שגיאות כאלה היא בדיוק ההפרש של אגורה
      //   שהיא תחפש אחריו שעה.
      const amount = toAgorot(shekels);

      // ★★ נדחתה. הקטגוריה השלישית — לא "חסרה", לא "לא התאימה".
      if (status !== '') {
        declinedRows.push({
          rowIndex,
          date,
          amount,
          reference: settlement === '' ? null : settlement,
          // הסיבה כפי שהיא בקובץ. בלי תרגום ובלי פירוש — היא זאת שתקריא
          // אותה בטלפון לחברת האשראי, ומילה שלנו במקומה תבלבל.
          reasonHe: status,
        });
        continue;
      }

      if (settlement === '') {
        unreadableRows.push({
          rowIndex,
          reasonHe: 'בשורה הזאת אין מספר שידור וגם אין סטטוס, ולא ידעתי אם העסקה נסלקה.',
        });
        continue;
      }

      // ⚠️★ סוג תנועה שאינו 'חיוב' לא נראה באף שורה בקובץ שנמדד, ולכן ערך
      //     לא מוכר יוצא לשורות שלא נקראו — עם הערך עצמו בתוך ההודעה, כדי
      //     שהדיווח שלה יגיע עם המידע שדרוש כדי להוסיף תמיכה.
      //
      // 🔴 **ואם יופיעו זיכויים בקובץ אמיתי — זה ייראה כרעש, וזה מכוון.**
      //     אל "תתקן" את זה בשורה אחת. זיכוי הוא סכום **שלילי**, וניחוש
      //     הסימן אינו אי-דיוק אלא היפוך: התאמה בין חיוב לזיכוי באותו גודל
      //     היא בדיוק המקרה שבו הכלי מציג תמונה הפוכה במשמעותה ונראה תקין
      //     לגמרי. עשרים שורות ב"לא הצלחתי לקרוא" הן שורות שהיא **בודקת**;
      //     עשרים שורות עם סימן הפוך הן שורות שהיא **לא** בודקת.
      //
      //     הדרך הנכונה לסגור את זה: קובץ אמיתי אחד עם זיכוי, ואז ענף
      //     מפורש — ולא הנחה שמישהו יזכור לאמת.
      if (columns.movement >= 0 && movement !== '' && movement !== MOVEMENT_CHARGE) {
        unreadableRows.push({
          rowIndex,
          reasonHe: `בשורה הזאת כתוב סוג תנועה שאני לא מכירה ("${movement}"), ולא רציתי לנחש אם זה חיוב או החזר.`,
        });
        continue;
      }

      rows.push({
        rowIndex,
        date,
        amount,
        reference: settlement,
        label: labelOf(
          cellAt(row, columns.approval).text.trim(),
          cellAt(row, columns.transaction).text.trim(),
        ),
      });
    }

    return { source: 'tranzila', rows, unreadableRows, declinedRows };
  },
};
