// ============================================================================
// adapters/gamma.ts — ★ הדוח מגמא: **שורה לכל (שידור × מותג), מצטברת.**
//
// ---------------------------------------------------------------------------
// מה נמדד בדוח של חברת האשראי — 12 עמודות
// ---------------------------------------------------------------------------
//   A מסוף · B שם מסוף · C מותג · D מ.שידור · E ת.שידור · F סה"כ ברוטו ·
//   G סליקה ע.תפעולי · H ניכיון ע.מימוני · I הנחה ע.מועדון · J מע"מ ·
//   K נטו לתש' · L ת.תשלום
//
// נקראות: **D** (מפתח ההתאמה), **E** (תאריך), **F** (ברוטו — ★ זה מה
// שמושווה מול טרנזילה), **G/H/I** (ניכויים), **J** (מע"מ), **K** (נטו).
//
// ⛔ `B שם מסוף` מכיל שם עסק — נקרא מהקובץ ככל תא אחר, **ולא נישא הלאה.**
// (ההבחנה הזאת אינה קוסמטית — ראו את ההערה המקבילה ב-`tranzila.ts`: קובץ
// xlsx נפרס במלואו, ולכן "לא נקרא" הוא משפט שאי אפשר לעמוד מאחוריו.)
// `C מותג` אינו נישא כי אין בו צורך: הקיבוץ הוא לפי שידור בלבד, ומיפוי
// שמות מותגים בין שני הקבצים הוא ניחוש מיותר (ראו `settlementGroup.ts`).
// `L ת.תשלום` ריק בפועל.
//
// ---------------------------------------------------------------------------
// ★★ מה מושווים, ולמה זה אמור לצאת אפס
// ---------------------------------------------------------------------------
// **ברוטו מול סכום טרנזילה.** העמלה נמדדה כ**אחוז קבוע מהברוטו**, ועליה
// מע"מ; והנטו הוא ברוטו פחות שניהם. כלומר אין כאן "פער עמלה" להסביר —
// ההשוואה על הברוטו יוצאת בדיוק אפס. מנגנון `consistentFeePattern` שבמנוע
// נשאר על מקומו לקובץ שיתנהג אחרת, אבל כאן הוא לא אמור להידלק, ואם הוא
// נדלק — זה ממצא.
//
// ★ במקום זה, מה שהיא כן רוצה לראות: **כמה עמלה נוכתה.** "נגבו X, נוכו Y,
// נכנסו Z" הוא החישוב שהיא עושה היום ביד, והוא יושב על השורות האלה.
// ============================================================================

import {
  toAgorot,
  type SettlementRow,
  type UnreadableRow,
} from '../settlement';
import { cellAt, hasHeaders, headerIndex, serialToIso, type Cell } from '../xlsx';
import type { ReportAdapter } from '../reportAdapters';

/** הכותרות שבלעדיהן זה לא הקובץ הזה. */
export const GAMMA_SIGNATURE = ['מ.שידור', 'סה"כ ברוטו'] as const;

const H = {
  settlement: 'מ.שידור',
  date: 'ת.שידור',
  gross: 'סה"כ ברוטו',
  clearing: 'סליקה ע.תפעולי',
  finance: 'ניכיון ע.מימוני',
  club: 'הנחה ע.מועדון',
  vat: 'מע"מ',
  net: "נטו לתש'",
} as const;

function numberOf(cell: Cell): number | null {
  if (cell.num !== null) return cell.num;
  const text = cell.text.replace(/[,\s₪]/g, '');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** ערך כספי אופציונלי: תא ריק הוא `0`, תא לא־מספרי הוא `null` (כשל). */
function agorotOr(cell: Cell, fallback: number | null): number | null {
  if (cell.text.trim() === '') return fallback;
  const value = numberOf(cell);
  return value === null ? null : toAgorot(value);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function dateOf(cell: Cell): string | null {
  if (cell.num !== null) return serialToIso(cell.num);
  const text = cell.text.trim();
  return ISO.test(text) ? text : null;
}

export const gammaAdapter: ReportAdapter = {
  id: 'gamma-xlsx',
  source: 'gamma',
  sourceHe: 'הדוח מגמא',

  detect: (grid) => hasHeaders(grid, GAMMA_SIGNATURE),

  parse: (grid) => {
    const columns = {
      settlement: headerIndex(grid, H.settlement),
      date: headerIndex(grid, H.date),
      gross: headerIndex(grid, H.gross),
      clearing: headerIndex(grid, H.clearing),
      finance: headerIndex(grid, H.finance),
      club: headerIndex(grid, H.club),
      vat: headerIndex(grid, H.vat),
      net: headerIndex(grid, H.net),
    };

    const rows: SettlementRow[] = [];
    const unreadableRows: UnreadableRow[] = [];

    for (const row of grid.rows) {
      const rowIndex = row.rowIndex;
      const date = dateOf(cellAt(row, columns.date));
      const gross = numberOf(cellAt(row, columns.gross));
      const settlement = cellAt(row, columns.settlement).text.trim();

      if (date === null) {
        unreadableRows.push({ rowIndex, reasonHe: 'לא הצלחתי לקרוא את התאריך בשורה הזאת.' });
        continue;
      }
      if (gross === null) {
        unreadableRows.push({ rowIndex, reasonHe: 'לא הצלחתי לקרוא את הסכום בשורה הזאת.' });
        continue;
      }
      if (settlement === '') {
        unreadableRows.push({
          rowIndex,
          reasonHe: 'בשורה הזאת אין מספר שידור, ולא היה לי לפי מה להשוות אותה.',
        });
        continue;
      }

      // ★ שלוש עמודות הניכוי מסוכמות יחד. בקובץ שנמדד שתיים מהן אפס, אבל
      //   "אפס היום" אינו "לא קיים" — ולקרוא רק את הראשונה היה מייצר נטו
      //   שגוי ביום שבו תופיע הנחת מועדון.
      const clearing = agorotOr(cellAt(row, columns.clearing), 0);
      const finance = agorotOr(cellAt(row, columns.finance), 0);
      const club = agorotOr(cellAt(row, columns.club), 0);
      const vat = agorotOr(cellAt(row, columns.vat), 0);

      if (clearing === null || finance === null || club === null || vat === null) {
        unreadableRows.push({
          rowIndex,
          reasonHe: 'לא הצלחתי לקרוא את העמלות בשורה הזאת.',
        });
        continue;
      }

      const amount = toAgorot(gross);
      const feeAgorot = clearing + finance + club;
      // ★ הנטו מהקובץ אם יש, ואחרת חשבון. לא הפוך: המספר שהיא תראה בדף
      //   החשבון הוא מה שגמא כתבה, גם אם החשבון שלנו נותן אגורה אחרת.
      const netAgorot = agorotOr(cellAt(row, columns.net), amount - feeAgorot - vat) ?? 0;

      rows.push({
        rowIndex,
        date,
        amount,
        reference: settlement,
        label: null,
        feeAgorot,
        vatAgorot: vat,
        netAgorot,
      });
    }

    return { source: 'gamma', rows, unreadableRows, declinedRows: [] };
  },
};
