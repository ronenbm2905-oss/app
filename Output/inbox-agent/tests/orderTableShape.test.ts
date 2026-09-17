// ============================================================================
// orderTableShape.test.ts — ★★ צורת טבלת המוצרים, כפי שהיא מגיעה באמת.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה נולד
// ---------------------------------------------------------------------------
// המדידה על 60 הודעות אמיתיות החזירה `table=0 מתוך 60`: טבלת המוצרים לא
// נמצאה באף אחת מהן, ו-`!table` חוסם. הסיבה התבררה כשראינו את המבנה — בחלק
// ה-`text/plain` של הספק, מה שהיה טבלת HTML **משוטח כך שכל תא יושב בשורה
// משלו**, בלי טאב ובלי רווח כפול, והקבוצות מופרדות בשורות ריקות.
//
// `splitCells` מפצל על טאב או שני רווחים ומעלה. ההנחה הזאת לא הגיעה משום
// הודעה — היא הגיעה מה-fixtures שאנחנו כתבנו. זו הפעם השלישית שאותה תבנית
// מפילה אותנו (`header.d=`, `c=`, וכאן), ולכן המבחנים כאן בנויים סביב
// **המבנה שנצפה**, ולא סביב זה שנוח לנו לכתוב.
//
// ---------------------------------------------------------------------------
// ★ ומה המבחנים האלה שומרים עליו חוץ מהקריאה עצמה
// ---------------------------------------------------------------------------
// "שלוש שורות = מוצר" הוא מבנה שביר: שורה חסרה מזיזה את כל מה שאחריה,
// והכמות של מוצר אחד נדבקת למחיר של אחר. לכן חצי מהמבחנים כאן בודקים את
// **הסירוב**: קבוצה שבורה חייבת לחסום ולא לנחש, כי לשלוח 1 במקום 4 היא
// הטעות היקרה במסך הזה, ולשלוח את המוצר הלא נכון גרוע ממנה.
//
// ⛔ כל הערכים כאן מומצאים. אין בקובץ הזה שם, כתובת או טלפון של אדם אמיתי.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ORDER_SENDER_ADDRESS,
  ORDER_SUBJECT_HE,
  orderTextToBlocks,
  parseOrderMessage,
} from '../shared/lib/orderParse';
import { summarizeReads } from '../shared/lib/readDiagnostics';

const AUTH =
  'mx.google.com; dkim=pass header.d=tranzila.com header.b=Ab3dEf; spf=pass smtp.mailfrom=tranzila.com';

/** בלי `l=` — כל הגוף חתום, כדי ששום מבחן כאן לא יימדד מול היקף החתימה. */
const SIGNATURE =
  'v=1; a=rsa-sha256; c=relaxed/relaxed; d=tranzila.com; s=default; h=Received:From:To:Subject; bh=xxx=; b=yyy=';

/** שדות הלקוחה — בדיוק במבנה של ההודעה: תווית בשורה, ערך בשורה הבאה. */
const FIELDS = [
  ' פרטי הלקוח:',
  '',
  '',
  ' שם לקוח',
  ' לקוחה לדוגמה',
  ' כתובת מייל',
  ' example@example.test',
  ' טלפון',
  ' 050-000-0000',
  ' כתובת',
  ' רחוב הדוגמה 14',
  ' עיר',
  ' תל דוגמה',
  ' מדינה',
  ' IL',
  ' מיקוד',
  ' 6100200',
].join('\r\n');

/**
 * ★★ הגוף, במבנה שנצפה: תא בשורה, רווח מוביל, שורות ריקות בין הקבוצות.
 *
 * `table` הוא רצף השורות של אזור המוצרים — כל מבחן משנה בו בדיוק דבר אחד.
 */
function stackedBody(table: string[], paid = '99.00'): string {
  return [
    FIELDS,
    '',
    '',
    ' מוצרים עבורם בוצע החיוב:',
    '',
    '',
    ...table,
    '',
    '',
    ' סכום ששולם',
    ` ${paid} ₪`,
    ' תשלומים',
    ' 1',
  ].join('\r\n');
}

/** טבלה תקינה: כותרת, מוצר, ושורת המשלוח במחיר 0. */
const REAL_TABLE = [
  ' שם מוצר',
  ' כמות',
  ' מחיר ליחידה',
  '',
  '',
  ' מדבקות לדרך - הכי משתלם',
  ' 1',
  ' 99',
  '',
  '',
  ' 2 מוצרים ומעלה משלוח ללא עלות',
  ' 1',
  ' 0',
];

function parseText(bodyText: string) {
  return parseOrderMessage({
    fromAddress: ORDER_SENDER_ADDRESS,
    subject: ORDER_SUBJECT_HE,
    authenticationResults: AUTH,
    dkimSignature: SIGNATURE,
    bodyText,
  });
}

// ---------------------------------------------------------------------------
// ★★ המבנה האמיתי
// ---------------------------------------------------------------------------

describe('★★ תא בשורה נפרדת — המבנה שחסם 60 מתוך 60', () => {
  const r = parseText(stackedBody(REAL_TABLE));

  it('הטבלה נמצאת, ושתי השורות נקראות במלואן', () => {
    expect(r.structure?.productTableFound).toBe(true);
    expect(r.structure?.productCellMode).toBe('stacked');
    expect(r.structure?.productRows).toBe(2);
    expect(r.items).toHaveLength(2);
  });

  it('שם, כמות ומחיר נקראו — ולא הוסקו', () => {
    expect(r.items[0].productName).toBe('מדבקות לדרך - הכי משתלם');
    expect(r.items[0].quantity).toBe(1);
    expect(r.items[0].unitPrice).toBe(99);
  });

  it('★ שורת המחיר-0 מזוהה כלא-לארוז, ולא נספרת כפריט שני', () => {
    expect(r.items[1].unitPrice).toBe(0);
    expect(r.items[1].isPackable).toBe(false);
    expect(r.items.filter((i) => i.isPackable)).toHaveLength(1);
  });

  it('ההזמנה נקראת עד הסוף — בלי ממצא חוסם', () => {
    expect(r.sourceVerified).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues.filter((i) => i.severity === 'block')).toEqual([]);
    expect(r.paidTotal).toBe(99);
    expect(r.recipient.city).toBe('תל דוגמה');
  });
});

describe('★ כמות דו-ספרתית ושני מוצרים שונים באותה הזמנה', () => {
  const r = parseText(
    stackedBody(
      [
        ' שם מוצר',
        ' כמות',
        ' מחיר ליחידה',
        '',
        '',
        ' מדבקות שם לילדים',
        ' 12',
        ' 8.50',
        '',
        '',
        ' תיק גב מעוצב',
        ' 2',
        ' 45',
        '',
        '',
        ' 2 מוצרים ומעלה משלוח ללא עלות',
        ' 1',
        ' 0',
      ],
      '192.00',
    ),
  );

  it('הכמות 12 אינה נקראת כ-1, ושני המוצרים נפרדים', () => {
    expect(r.items.map((i) => [i.productName, i.quantity])).toEqual([
      ['מדבקות שם לילדים', 12],
      ['תיק גב מעוצב', 2],
      ['2 מוצרים ומעלה משלוח ללא עלות', 1],
    ]);
  });

  it('★ המכפלה מסתדרת מול הסכום ששולם', () => {
    expect(r.paidTotal).toBe(192);
    expect(r.needsHumanReview).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ★★ הסירוב — החצי החשוב
// ---------------------------------------------------------------------------

describe('★★ שורה חסרה באמצע → חסימה, לא ניחוש', () => {
  // הכמות של המוצר הראשון נעלמה. פרסר שסופר שלוש שורות היה קורא כאן
  // "99" ככמות ואת שם המוצר הבא כמחיר — ושולח חבילה לא נכונה בלי להתלונן.
  const r = parseText(
    stackedBody(
      [
        ' שם מוצר',
        ' כמות',
        ' מחיר ליחידה',
        '',
        '',
        ' מדבקות לדרך - הכי משתלם',
        ' 99',
        '',
        '',
        ' תיק גב מעוצב',
        ' 2',
        ' 45',
      ],
      '189.00',
    ),
  );

  it('ההזמנה יוצאת לבדיקה עם ממצא חוסם ייעודי', () => {
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'rowUnreadable' && i.severity === 'block')).toBe(true);
  });

  it('★ ולא נוצרה שום כמות מנוחשת מהשורות שאחרי השבר', () => {
    expect(r.items).toEqual([]);
    expect(r.structure?.productRowsUnreadable).toBe(1);
  });

  it('★ והנימוק אומר לה לפתוח את המייל, ולא נותן כתובת להעתקה', () => {
    expect(r.reasonHe).toContain('לא הצגתי כתובת');
  });
});

describe('★ יישור שזז בלי לשנות את הספירה', () => {
  // שתי שורות חסרות, כך שמספר השורות נשאר כפולה של 3 — הספירה "מסתדרת"
  // והתוכן זז. זה המקרה שבו בדיקת התאים היא הדבר היחיד שעומד בדרך.
  const r = parseText(
    stackedBody(
      [' שם מוצר', ' כמות', ' מחיר ליחידה', '', '', ' מדבקות לדרך', ' 99', ' תיק גב מעוצב'],
      '99.00',
    ),
  );

  it('נתפס כשורה שלא נקראה, ולא כמוצר בשם "99"', () => {
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'rowUnreadable')).toBe(true);
    expect(r.items).toEqual([]);
  });
});

describe('★ אימות המכפלה נשאר חוסם גם במבנה הזה', () => {
  const r = parseText(stackedBody(REAL_TABLE, '149.00'));

  it('סכום השורות שאינו הסכום ששולם — "צריך שתסתכלי"', () => {
    expect(r.items).toHaveLength(2);
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'totalMismatch')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ★ מה שאסור להפוך לחסימה
// ---------------------------------------------------------------------------

describe('★ טקסט סיום אחרי הטבלה אינו שורה שבורה', () => {
  const r = parseText(
    [
      stackedBody(REAL_TABLE),
      '',
      '',
      ' תודה שקנית אצלנו!',
      ' נשמח לראותך שוב',
    ].join('\r\n'),
  );

  it('הטבלה נקראת, ואין ממצא חוסם על ברכת הסיום', () => {
    expect(r.items).toHaveLength(2);
    expect(r.structure?.productRowsUnreadable).toBe(0);
    expect(r.needsHumanReview).toBe(false);
  });
});

describe('★ סדר העמודות נקרא מהכותרת, גם כשהוא מתחלף', () => {
  const r = parseText(
    stackedBody(
      [
        ' שם מוצר',
        ' מחיר ליחידה',
        ' כמות',
        '',
        '',
        ' מדבקות לדרך',
        ' 33',
        ' 3',
      ],
      '99.00',
    ),
  );

  it('3 יחידות ב-33 ולא 33 יחידות ב-3', () => {
    expect(r.items[0].quantity).toBe(3);
    expect(r.items[0].unitPrice).toBe(33);
    expect(r.needsHumanReview).toBe(false);
  });
});

describe('★★ הקבוצות — המפריד שהיה נזרק', () => {
  it('שורה ריקה תוחמת קבוצה, וקבוצה חסרת שורה נראית כחסרה', () => {
    const blocks = orderTextToBlocks(' א\r\n ב\r\n\r\n\r\n ג\r\n ד\r\n ה\r\n');
    expect(blocks).toEqual([
      ['א', 'ב'],
      ['ג', 'ד', 'ה'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// ★★ `מיקוד` — התווית היחידה ב-`missing`, ומה המדידה צריכה להגיד עליה
// ---------------------------------------------------------------------------
//
// `labelsMissing` היא רשימת **חיתוך**: תווית נכנסת אליה אם חסרה בלפחות
// הודעה אחת. כלומר `missing=1` על 60 הודעות אינו אומר "המבנה השתנה" — הוא
// יכול להיות גם "לקוחה אחת לא מילאה מיקוד", וזה הבדל בין תקלה לבין יום רגיל.
//
// ★ ולמה דווקא `מיקוד` הוא המועמד הטבעי לזה: הוא השדה היחיד ברשימה שאפשר
// להשאיר ריק בטופס. הוא גם **אינו** ב-`REQUIRED_LABELS` בדיוק מהסיבה הזאת,
// ולכן היעדרו לא חוסם כלום — הוא לא היה הסיבה שההזמנות נחסמו.
//
// שני המבחנים כאן לא מכריעים איזו משתי האפשרויות נכונה — הם מוודאים
// ש**המדידה** תכריע: `missmax` מול `msgs`.

describe('★★ מיקוד חסר — מה זה כן, ומה זה לא', () => {
  // ★ אותה הודעה בדיוק, פחות שתי שורות: התווית `מיקוד` והערך שלה. זה מה
  // שקורה כשלקוחה משאירה את השדה ריק והספק לא שולח את השורה בכלל.
  const r = parseText(
    stackedBody(REAL_TABLE)
      .split('\r\n')
      .filter((line) => line.trim() !== 'מיקוד' && line.trim() !== '6100200')
      .join('\r\n'),
  );

  it('★ שורה שלא נשלחה כלל → התווית חסרה, וההזמנה עדיין נקראת', () => {
    expect(r.structure?.labelsMissing).toContain('מיקוד');
    expect(r.sourceVerified).toBe(true);
    // ⛔ זה העיקר: מיקוד חסר **אינו** חוסם. הוא הערה על הכרטיס, לא סיבה
    // שההזמנה לא נקראה.
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues.some((i) => i.code === 'missingField' && i.severity === 'warn')).toBe(true);
  });

  it('★★ והמדידה מבדילה "חסר באחת" מ"חסר בכולן"', () => {
    const full = parseText(stackedBody(REAL_TABLE));
    const d = summarizeReads([], [r.structure!, full.structure!, full.structure!]);

    expect(d.labelsMissing).toEqual(['מיקוד']);
    // ★ 1 מתוך 3 — לקוחה שלא מילאה. אילו היה כאן 3, זה היה מבנה שהשתנה,
    // ואז מיקוד היה נקרא כמו שאר התוויות ולא נמצא — שאלה אחרת לגמרי.
    expect(d.labelsMissingCounts).toEqual([{ label: 'מיקוד', count: 1 }]);
    expect(d.structuresMeasured).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// ★ והמבנה הישן ממשיך לעבוד
// ---------------------------------------------------------------------------

describe('★ הצורה השורתית לא נשברה', () => {
  const html = `<table>
    <tr><td>שם לקוח</td><td>לקוחה לדוגמה</td></tr>
    <tr><td>כתובת</td><td>רחוב הדוגמה 14</td></tr>
    <tr><td>עיר</td><td>תל דוגמה</td></tr>
    <tr><td>סכום ששולם</td><td>84.00 ₪</td></tr>
  </table>
  <table><tr><th>שם מוצר</th><th>כמות</th><th>מחיר ליחידה</th></tr>
  <tr><td>מדבקות</td><td>2</td><td>42.00</td></tr></table>`;

  const r = parseOrderMessage({
    fromAddress: ORDER_SENDER_ADDRESS,
    subject: ORDER_SUBJECT_HE,
    authenticationResults: AUTH,
    dkimSignature: SIGNATURE,
    bodyHtml: html,
  });

  it('נקראת כמו קודם, ונמדדת כצורה השורתית', () => {
    expect(r.items).toHaveLength(1);
    expect(r.items[0].quantity).toBe(2);
    expect(r.structure?.productCellMode).toBe('inline');
    expect(r.structure?.productRows).toBe(1);
    expect(r.needsHumanReview).toBe(false);
  });
});
