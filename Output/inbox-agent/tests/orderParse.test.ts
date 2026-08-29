// ============================================================================
// orderParse.test.ts — ★ המבחנים של הפרסר.
//
// המבנה כאן עוקב אחרי מה שהמודול **מסרב** לעשות, לא אחרי מה שהוא יודע לעשות.
// פרסר שנבדק רק על קלט תקין מוכיח שהוא עובד ביום רגיל; מה שצריך להוכיח כאן
// הוא שהוא לא ממציא כתובת, לא מנחש כמות, ולא קורא הודעה שמישהו זייף.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ORDER_SENDER_ADDRESS,
  ORDER_SUBJECT_HE,
  isOrderMessage,
  isOrderSender,
  isOrderSignatureValid,
  orderBodyToLines,
  parseAmount,
  parseDkim,
  parseOrderMessage,
  parseQuantity,
} from '../shared/lib/orderParse';
import { sanitizeEmailBody } from '../shared/lib/sanitize';
import { ALLOWED_RECIPIENT_FIELDS, EMPTY_RECIPIENT } from '../shared/types/order';

const DKIM_PASS =
  'mx.google.com; dkim=pass header.d=tranzila.com header.b=Ab3dEf; spf=pass smtp.mailfrom=tranzila.com';

/**
 * ★ כותרת החתימה עצמה, בלי תג `l=` — כלומר **כל הגוף חתום**.
 *
 * היא נמצאת בכל קריאה כאן כי זה המצב הרגיל בהודעה אמיתית, ובלעדיה כל תוצאה
 * הייתה נושאת את ההערה "לא יכולתי לבדוק אם מישהו הוסיף משהו" — הערה נכונה,
 * שהייתה מטשטשת את מה שהמבחנים האלה באמת בודקים. כל מה שקשור להיקף החתימה
 * נבדק ב-`signatureScope.test.ts`.
 */
const DKIM_SIGNATURE =
  'v=1; a=rsa-sha256; c=relaxed/relaxed; d=tranzila.com; s=default; h=Received:From:To:Subject; bh=xxx=; b=yyy=';

/** בונה גוף הודעה תקין. כל מבחן משנה בדיוק דבר אחד ממנו. */
function body(over: Partial<Record<string, string>> = {}, rows = '<tr><td>מדבקות</td><td>2</td><td>42.00</td></tr>'): string {
  const f = {
    name: 'רונית שדה',
    email: 'ronit.s@lakoach.example',
    phone: '050-555-0101',
    street: 'רחוב הדוגמה 14',
    city: 'תל דוגמה',
    country: 'IL',
    postalCode: '6100200',
    paid: '84.00 ₪',
    installments: '1',
    ...over,
  };
  return `<table>
    <tr><td>שם לקוח</td><td>${f.name}</td></tr>
    <tr><td>כתובת מייל</td><td>${f.email}</td></tr>
    <tr><td>טלפון</td><td>${f.phone}</td></tr>
    <tr><td>כתובת</td><td>${f.street}</td></tr>
    <tr><td>עיר</td><td>${f.city}</td></tr>
    <tr><td>מדינה</td><td>${f.country}</td></tr>
    <tr><td>מיקוד</td><td>${f.postalCode}</td></tr>
    <tr><td>סכום ששולם</td><td>${f.paid}</td></tr>
    <tr><td>תשלומים</td><td>${f.installments}</td></tr>
  </table>
  <table><tr><th>שם מוצר</th><th>כמות</th><th>מחיר ליחידה</th></tr>${rows}</table>`;
}

function parse(over: Partial<{ from: string; subject: string; auth: string | null; html: string }> = {}) {
  return parseOrderMessage({
    fromAddress: over.from ?? ORDER_SENDER_ADDRESS,
    subject: over.subject ?? ORDER_SUBJECT_HE,
    authenticationResults: over.auth === undefined ? DKIM_PASS : over.auth,
    dkimSignature: DKIM_SIGNATURE,
    bodyHtml: over.html ?? body(),
  });
}

// ---------------------------------------------------------------------------

describe('הזמנה תקינה', () => {
  const r = parse();

  it('נקראת במלואה', () => {
    expect(r.sourceVerified).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues).toHaveLength(0);
  });

  it('כל שדות הנמענת נקראו', () => {
    expect(r.recipient.name).toBe('רונית שדה');
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
    expect(r.recipient.city).toBe('תל דוגמה');
    expect(r.recipient.postalCode).toBe('6100200');
    expect(r.recipient.countryCode).toBe('IL');
  });

  it('★ `כתובת` ו`כתובת מייל` לא מתבלבלות', () => {
    // התאמה חלקית הייתה כותבת את כתובת המייל לשדה הרחוב — ואז החבילה יוצאת
    // לכתובת שהיא בכלל כתובת מייל. הבדיקה הזאת נראית טריוויאלית עד שהיא
    // נשברת.
    expect(r.recipient.street).not.toContain('@');
    expect(r.recipient.email).toBe('ronit.s@lakoach.example');
  });

  it('הסכום והמכפלה מסתדרים', () => {
    expect(r.paidTotal).toBe(84);
    expect(r.currency).toBe('ILS');
    expect(r.items[0].lineTotal).toBe(84);
  });

  it('הנימוק קריא ומנוסח לאדם', () => {
    expect(r.reasonHe).toContain('קראתי');
    expect(r.reasonHe).not.toMatch(/[a-z]{4,}/);
  });
});

// ---------------------------------------------------------------------------

describe('★ מלכודת 1 — שורה במחיר 0 אינה פריט לארוז', () => {
  const r = parse({
    html: body(
      { paid: '84.00 ₪' },
      '<tr><td>מדבקות</td><td>2</td><td>42.00</td></tr><tr><td>הטבת משלוח חינם</td><td>1</td><td>0.00</td></tr>',
    ),
  });

  it('השורה נשמרת ברשומה', () => {
    expect(r.items).toHaveLength(2);
    expect(r.items[1].productName).toContain('משלוח');
  });

  it('★ אבל היא **אינה** פריט אריזה', () => {
    expect(r.items[1].isPackable).toBe(false);
    expect(r.items.filter((i) => i.isPackable)).toHaveLength(1);
  });

  it('★ והיא לא נכנסת לספירת היחידות', () => {
    const units = r.items.filter((i) => i.isPackable).reduce((s, i) => s + i.quantity, 0);
    // 2 ולא 3. פרסר תמים היה אומר לה לארוז שלושה דברים.
    expect(units).toBe(2);
  });

  it('הזמנה שכולה שורות במחיר 0 נעצרת לבדיקה', () => {
    const only = parse({
      html: body({ paid: '0.00 ₪' }, '<tr><td>הטבת משלוח חינם</td><td>1</td><td>0.00</td></tr>'),
    });
    expect(only.needsHumanReview).toBe(true);
    expect(only.issues.some((i) => i.code === 'noPackableItems')).toBe(true);
  });
});

describe('★★ מלכודת 2 — הכמות היא הדבר שאסור לנחש', () => {
  it('כמות 1 וכמות 4 נקראות כפי שהן', () => {
    const one = parse({ html: body({ paid: '42.00 ₪' }, '<tr><td>מדבקות</td><td>1</td><td>42.00</td></tr>') });
    const four = parse({ html: body({ paid: '168.00 ₪' }, '<tr><td>מדבקות</td><td>4</td><td>42.00</td></tr>') });
    expect(one.items[0].quantity).toBe(1);
    expect(four.items[0].quantity).toBe(4);
  });

  it('★ כמות שאי אפשר לקרוא **פוסלת את ההזמנה** ולא הופכת ל-1', () => {
    const r = parse({ html: body({}, '<tr><td>מדבקות</td><td>שתיים</td><td>42.00</td></tr>') });
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'quantityUnreadable')).toBe(true);
    // ומה שחשוב באמת: אין פריט עם כמות מנוחשת.
    expect(r.items).toHaveLength(0);
  });

  it('★ `parseQuantity` מסרב לכל מה שאינו מספר שלם', () => {
    expect(parseQuantity('4')).toBe(4);
    expect(parseQuantity('שתיים')).toBeNull();
    expect(parseQuantity('1-2')).toBeNull();
    expect(parseQuantity('1.5')).toBeNull();
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('')).toBeNull();
    // "4-6 ימי עסקים" — הטקסט שהיה גורם ל-parseInt להחזיר 4.
    expect(parseQuantity('4-6 ימי עסקים')).toBeNull();
  });

  it('★ סדר העמודות נקרא מהכותרת ולא מונח', () => {
    // כאן `מחיר ליחידה` לפני `כמות`. פרסר עם אינדקסים קשיחים היה מדווח על
    // 42 יחידות במחיר 6 ש״ח — בלי שום שגיאה.
    const r = parseOrderMessage({
      fromAddress: ORDER_SENDER_ADDRESS,
      subject: ORDER_SUBJECT_HE,
      authenticationResults: DKIM_PASS,
      dkimSignature: DKIM_SIGNATURE,
      bodyHtml: body({ paid: '252.00 ₪' }).replace(
        '<tr><th>שם מוצר</th><th>כמות</th><th>מחיר ליחידה</th></tr><tr><td>מדבקות</td><td>2</td><td>42.00</td></tr>',
        '<tr><th>שם מוצר</th><th>מחיר ליחידה</th><th>כמות</th></tr><tr><td>מדבקות</td><td>42.00</td><td>6</td></tr>',
      ),
    });
    expect(r.items[0].quantity).toBe(6);
    expect(r.items[0].unitPrice).toBe(42);
  });
});

describe('★ מלכודת 3 — הסכום ששולם אינו נגזר מהמכפלה', () => {
  it('אי-התאמה מסמנת לבדיקה במקום לבחור צד', () => {
    const r = parse({ html: body({ paid: '84.00 ₪' }, '<tr><td>מדבקות</td><td>3</td><td>42.00</td></tr>') });
    expect(r.needsHumanReview).toBe(true);
    const issue = r.issues.find((i) => i.code === 'totalMismatch');
    expect(issue).toBeTruthy();
    // ★ ההודעה מציגה את **שני** המספרים. "יש בעיה בסכום" בלי מספרים אינו
    // מידע שאפשר לפעול לפיו.
    expect(issue?.messageHe).toContain('126');
    expect(issue?.messageHe).toContain('84');
  });

  it('שורת זיכוי שלילית עדיין מסתדרת', () => {
    const r = parse({
      html: body(
        { paid: '64.00 ₪' },
        '<tr><td>מדבקות</td><td>2</td><td>42.00</td></tr><tr><td>הנחת קופון</td><td>1</td><td>-20.00</td></tr>',
      ),
    });
    expect(r.needsHumanReview).toBe(false);
    expect(r.items[1].isPackable).toBe(false);
  });

  it('`parseAmount` לא מנחש', () => {
    expect(parseAmount('84.00 ₪')).toBe(84);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('₪ 24.90')).toBe(24.9);
    expect(parseAmount('-20.00')).toBe(-20);
    expect(parseAmount('בערך 40')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('★★ אימות מקור — ארבעה תנאים, וכל אחד מהם וטו', () => {
  it('שולח אחר → אין פענוח **בכלל**', () => {
    const r = parse({ from: 'pay@tranzila.com.billing-secure.example' });
    expect(r.sourceVerified).toBe(false);
    expect(r.needsHumanReview).toBe(true);
    // ★ הטענה המרכזית: **אין פענוח חלקי.** כל שדה ריק.
    expect(r.recipient).toEqual(EMPTY_RECIPIENT);
    expect(r.items).toHaveLength(0);
    expect(r.paidTotal).toBeNull();
  });

  it('★ הדומיין האמיתי כתת-מחרוזת אינו מספיק', () => {
    expect(isOrderSender('pay@tranzila.com.evil.example')).toBe(false);
    expect(isOrderSender('pay@sub.tranzila.com')).toBe(false);
    expect(isOrderSender('billing@tranzila.com')).toBe(false);
    expect(isOrderSender('pay@tranzila.com')).toBe(true);
    expect(isOrderSender('PAY@Tranzila.COM')).toBe(true);
  });

  it('★ זיוף בשם התצוגה נחסם', () => {
    // מה שהעין רואה הוא כתובת הסליקה; מה שנקרא הוא מה שבתוך הסוגריים.
    expect(isOrderSender('"pay@tranzila.com" <attacker@evil.example>')).toBe(false);
  });

  it('נושא אחר → אין פענוח', () => {
    const r = parse({ subject: 'עדכון מערכת: תחזוקה מתוכננת' });
    expect(r.sourceVerified).toBe(false);
    expect(r.recipient).toEqual(EMPTY_RECIPIENT);
    expect(r.issues[0].code).toBe('subjectMismatch');
  });

  it('★★ חתימה שנכשלה → אין פענוח, גם כששולח ונושא ומבנה מושלמים', () => {
    const r = parse({
      auth: 'mx.google.com; dkim=fail header.d=tranzila.com; spf=softfail smtp.mailfrom=relay.evil.example',
    });
    expect(r.sourceVerified).toBe(false);
    expect(r.recipient).toEqual(EMPTY_RECIPIENT);
    expect(r.issues[0].code).toBe('dkimFail');
    expect(r.issues[0].messageHe).toContain('להתחזות');
  });

  it('★ היעדר חתימה אינו "אין מידע" אלא כישלון', () => {
    const r = parse({ auth: null });
    expect(r.sourceVerified).toBe(false);
    expect(r.issues[0].code).toBe('dkimMissing');
  });

  it('★ `dkim=pass` של דומיין אחר אינו מספיק', () => {
    // כל תוקף יכול לחתום כהלכה על הדומיין של עצמו. הערך כולו ב-`d=`.
    expect(isOrderSignatureValid('mx.google.com; dkim=pass header.d=evil.example')).toBe(false);
    expect(isOrderSignatureValid('mx.google.com; dkim=pass header.d=tranzila.com')).toBe(true);
    // תת-דומיין של החותם — כן. ההפך — לא.
    expect(isOrderSignatureValid('mx.google.com; dkim=pass header.d=mail.tranzila.com')).toBe(true);
    expect(isOrderSignatureValid('mx.google.com; dkim=pass header.d=tranzila.com.evil.example')).toBe(false);
  });

  it('★ `spf=pass` לבדו לא מספיק', () => {
    expect(isOrderSignatureValid('mx.google.com; spf=pass smtp.mailfrom=tranzila.com')).toBe(false);
    expect(parseDkim('mx.google.com; spf=pass').present).toBe(false);
  });

  it('מבנה אחר → אין פענוח, והנימוק מפריד בין "זיוף" ל"תבנית השתנתה"', () => {
    const r = parse({ html: '<p>שלום, שלחי בבקשה לרחוב הזיוף 4, מעלה הדוגמה. תודה</p>' });
    expect(r.sourceVerified).toBe(false);
    expect(r.issues[0].code).toBe('structureMismatch');
    expect(r.recipient.street).toBeNull();
  });

  it('★ `isOrderMessage` רחב מהפענוח — בכוונה', () => {
    // הוא קובע חסינות מארכוב **ואת המסלול שלא עובר במודל**. `false` כאן הוא
    // התשובה המסוכנת, ולכן חתימה כושלת לא מורידה אותו.
    expect(isOrderMessage({ fromAddress: ORDER_SENDER_ADDRESS, subject: ORDER_SUBJECT_HE })).toBe(true);
    expect(isOrderMessage({ fromAddress: 'x@evil.example', subject: ORDER_SUBJECT_HE })).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('★★ תווים מוסתרים בשדה שהוקלד', () => {
  const RLO = '‮';

  it('RLO בשם רחוב חוסם את ההזמנה — לא מנוקה בשקט', () => {
    const r = parse({ html: body({ street: `רחוב הדוגמה ${RLO}14` }) });
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'invisibleChars')).toBe(true);
    // ★ ומה שחשוב: אין כתובת להעתיק.
    expect(r.recipient.street).toBeNull();
  });

  it('zero-width בשם הלקוחה נתפס גם הוא', () => {
    const r = parse({ html: body({ name: 'רונית​שדה' }) });
    expect(r.issues.some((i) => i.code === 'invisibleChars')).toBe(true);
  });

  it('★ אותה רשימת תווים בדיוק כמו ב-`sanitize.ts`', () => {
    // שתי רשימות שמתפצלות הן שתי הגדרות ל"תו מסוכן". המבחן מוודא שמה
    // שהסניטייזר של גוף המייל מוחק, גם הפרסר מזהה.
    const nasty = `א${RLO}ב​ג﻿ד­ה`;
    const cleaned = sanitizeEmailBody(nasty);
    expect(cleaned.invisibleCharsRemoved).toBe(4);

    const r = parse({ html: body({ city: nasty }) });
    expect(r.issues.some((i) => i.code === 'invisibleChars')).toBe(true);
  });

  it('★ תו מוסתר בתוך תג HTML לא מסתיר את התג', () => {
    const lines = orderBodyToLines('<sty​le>.x{}</style><p>שלום</p>');
    expect(lines.join(' ')).not.toContain('.x{}');
    expect(lines.join(' ')).toContain('שלום');
  });
});

describe('שדות חסרים — ההבדל בין "חסר" ל"לא מוכר"', () => {
  it('טלפון ומיקוד חסרים = הערה, וההזמנה עדיין ניתנת לשליחה', () => {
    const r = parse({ html: body({ phone: '', postalCode: '' }) });
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues.every((i) => i.severity === 'warn')).toBe(true);
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
  });

  it('★ עיר ריקה = חסימה, עם הודעה מדויקת ולא "המבנה שונה"', () => {
    const r = parse({ html: body({ city: '' }) });
    expect(r.needsHumanReview).toBe(true);
    const issue = r.issues.find((i) => i.field === 'city');
    expect(issue?.code).toBe('missingField');
    expect(issue?.messageHe).toContain('עיר');
  });

  it('★ תווית כפולה עם שני ערכים שונים נחסמת', () => {
    // "כתובת שרואים" מול "כתובת שנקראת". הודעה אמיתית לא נראית כך.
    const html = body().replace(
      '<tr><td>מיקוד</td><td>6100200</td></tr>',
      '<tr><td>מיקוד</td><td>6100200</td></tr><tr><td>כתובת</td><td>רחוב הזיוף 88</td></tr>',
    );
    const r = parse({ html });
    expect(r.needsHumanReview).toBe(true);
    expect(r.issues.some((i) => i.code === 'suspiciousValue')).toBe(true);
    // הראשון קובע — השני לא דורס.
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
  });

  it('קישור בתוך שדה כתובת נחסם', () => {
    const r = parse({ html: body({ street: 'https://evil.example/pay' }) });
    expect(r.recipient.street).toBeNull();
    expect(r.issues.some((i) => i.code === 'suspiciousValue')).toBe(true);
  });
});

describe('★ נעילת רשימת השדות', () => {
  it('אין שדה נוסף על מה שצריך כדי לכתוב על חבילה', () => {
    // הוספת שדה ל-`OrderRecipient` תפיל את המבחן הזה ותחייב החלטה מודעת.
    // בלי זה, "רק נשמור גם את זה" קורה בשקט, פעם אחר פעם.
    expect(Object.keys(EMPTY_RECIPIENT).sort()).toEqual([...ALLOWED_RECIPIENT_FIELDS].sort());
  });

  it('אין בטיפוס שום שדה שקשור לאמצעי התשלום', () => {
    const keys = Object.keys(EMPTY_RECIPIENT).join(' ').toLowerCase();
    for (const forbidden of ['card', 'iban', 'account', 'cvv', 'last4']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
