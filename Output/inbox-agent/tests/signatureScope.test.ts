// ============================================================================
// signatureScope.test.ts — ★★ מה החתימה מכסה, ומה שמעבר לה.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ---------------------------------------------------------------------------
// עד עכשיו הבדיקה שלנו הסתפקה ב-`dkim=pass` עם `d=` של הספק. הודעת סליקה
// אמיתית אחת שנבדקה אישרה שזה נכון — **ושזה לא מספיק**:
//
//   `l=3694`  → החתימה מכסה רק את 3694 הבתים הראשונים של הגוף. כל מה שמעבר
//               לזה אינו חתום, **והחתימה עדיין עוברת.**
//   `h=Received:From:To:Subject` → `Date` ו-`Message-ID` אינם חתומים.
//   `p=none`  → גוגל לא תדחה הודעה מזויפת בשם הספק. הבדיקה שלנו היא ההגנה
//               היחידה, ולכן אין כאן "מספיק טוב".
//
// המבחנים כאן הם בדיוק ההפרש בין "החתימה תקפה" ל"החתימה מכסה את מה שקראתי".
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ORDER_SENDER_ADDRESS,
  ORDER_SIGNING_DOMAIN,
  ORDER_SUBJECT_HE,
  isOrderSubject,
  parseOrderMessage,
} from '../shared/lib/orderParse';
import {
  limitToSignedBody,
  parseDkimSignature,
  signatureForDomain,
  signsHeader,
  canonicalizeBody,
  utf8ByteLength,
} from '../shared/lib/dkimSignature';
import { decodeMimeWords, selectReadablePart } from '../shared/lib/mimeBody';
import { contentFingerprint } from '../shared/lib/fingerprint';
import { readOrderBodies } from '../shared/lib/orderSource';
import { runOrderPipeline } from '../src/utils/orderPipeline';
import { orderMessages } from '../src/fixtures';

const DKIM_PASS =
  'mx.google.com; dkim=pass header.d=tranzila.com header.b=Ab3dEf; spf=pass smtp.mailfrom=tranzila.com';

const SIG = (over: Partial<{ l: number | null; h: string; d: string }> = {}) => {
  const parts = [
    'v=1',
    'a=rsa-sha256',
    'c=relaxed/relaxed',
    `d=${over.d ?? ORDER_SIGNING_DOMAIN}`,
    's=default',
    `h=${over.h ?? 'Received:From:To:Subject'}`,
    'bh=xxx=',
  ];
  if (over.l !== undefined && over.l !== null) parts.push(`l=${over.l}`);
  parts.push('b=yyy=');
  return parts.join('; ');
};

/** גוף הזמנה תקין כטקסט נקי — הצורה שבה החלק `text/plain` בנוי. */
function plainBody(over: Partial<Record<string, string>> = {}): string {
  const f = {
    name: 'רונית שדה',
    street: 'רחוב הדוגמה 14',
    city: 'תל דוגמה',
    paid: '42.00 ₪',
    product: 'מדבקות פרחי בר',
    qty: '1',
    price: '42.00',
    ...over,
  };
  return [
    'התקבלה עסקה חדשה.',
    'שם לקוח',
    f.name,
    'כתובת מייל',
    'ronit.s@lakoach.example',
    'טלפון',
    '050-555-0101',
    'כתובת',
    f.street,
    'עיר',
    f.city,
    'מדינה',
    'IL',
    'מיקוד',
    '6100200',
    'סכום ששולם',
    f.paid,
    'תשלומים',
    '1',
    'שם מוצר\tכמות\tמחיר ליחידה',
    `${f.product}\t${f.qty}\t${f.price}`,
  ].join('\n');
}

/** ★ ההזמנה השנייה שהתוקף מדביק בסוף — עם הכתובת שלו. */
const INJECTED = [
  '',
  'שם לקוח',
  'דן התוקף',
  'כתובת',
  'רחוב התוקף 9',
  'עיר',
  'קריית הזיוף',
  'מדבקות פרחי בר\t2\t42.00',
].join('\n');

/**
 * ★★ אורך הגוף **כפי ש-`l=` סופר אותו**, ולא אורכו הגולמי.
 *
 * ---------------------------------------------------------------------------
 * למה שלוש שורות במבחן הזה השתנו ב-16.9.2026
 * ---------------------------------------------------------------------------
 * הן חישבו `l` מ-`utf8ByteLength(body)` — כלומר מהבתים הגולמיים — בזמן
 * ש-`SIG` מצהיר `c=relaxed/relaxed`. **`l=` לעולם אינו נמדד על הגולמי**;
 * הוא נמדד על הגוף המקונן, ובגוף הזה (שורות מופרדות ב-`\n`) המקונן דווקא
 * **ארוך יותר**, כי כל מפריד הופך ל-CRLF.
 *
 * כלומר המבחנים האלה אימתו את הקוד מול חתימה שאנחנו בנינו לפי החישוב
 * השגוי של עצמנו — אותה מלכודת בדיוק כמו `header.d=` מול `header.i=`,
 * שכבה אחת עמוק יותר. הטענה שהם בודקים לא השתנתה: גוף שכולו חתום נקרא
 * במלואו, וזנב שמעבר לחתימה לא מגיע לכרטיס. רק הדרך לחשב את `l` תוקנה
 * למה שהתג באמת אומר.
 */
const signedLen = (body: string) => utf8ByteLength(canonicalizeBody(body, 'relaxed'));

function parseText(body: string, sig: string | null, subject = ORDER_SUBJECT_HE) {
  return parseOrderMessage({
    fromAddress: ORDER_SENDER_ADDRESS,
    subject,
    bodyText: body,
    authenticationResults: DKIM_PASS,
    dkimSignature: sig,
  });
}

// ---------------------------------------------------------------------------

describe('★★ `l=` — הגוף נחתך לפני שנקרא ממנו ערך', () => {
  it('גוף באורך `l` בדיוק — נקרא במלואו, בלי שום ממצא', () => {
    const body = plainBody();
    const r = parseText(body, SIG({ l: signedLen(body) }));
    expect(r.sourceVerified).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues).toHaveLength(0);
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
  });

  it('★★ טבלת הזמנה שנייה שהוזרקה אחרי הגבול **לא מגיעה לכרטיס**', () => {
    const body = plainBody();
    const attacked = body + INJECTED;
    const r = parseText(attacked, SIG({ l: signedLen(body) }));

    // הכתובת שנקראה היא של הלקוחה האמיתית.
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
    // ★ ומה שחשוב באמת: שום פרט של התוקף לא נמצא בשום מקום בתוצאה.
    const blob = JSON.stringify(r);
    expect(blob).not.toContain('התוקף');
    expect(blob).not.toContain('הזיוף');
  });

  // ---------------------------------------------------------------------------
  // ★★ המבחן הזה קידד "תוספת = חסימה", והוא נכתב מחדש ב-16.9.2026.
  //
  // ההנחה שמאחורי הגרסה הקודמת: זנב מעבר ל-`l=` פירושו שמישהו הוסיף. 60
  // ההזמנות האמיתיות הראשונות הפריכו אותה — **כולן** חצו את הגבול, כי כך
  // מערכת החתימה של הספק בנויה. מבחן שמקבע חסימה כזאת מקבע פסילה של 100%
  // מההזמנות התקינות.
  //
  // ★ מה שהמבחן צריך להוכיח במקום זאת הוא הטענה שבאמת מחזיקה את המערכת:
  // גם כשהתוקף **כן** הדביק הזמנה שנייה בסוף, הכתובת שנקראת היא של
  // הלקוחה, שום פרט שלו אינו קיים בתוצאה, וההזמנה התקינה ממשיכה לעבוד.
  // ההגנה היא החיתוך; החסימה הייתה הודעה על החיתוך, ולא החיתוך עצמו.
  it('★★ התוקף הדביק הזמנה שנייה — וההזמנה האמיתית נקראת, שלו לא', () => {
    const body = plainBody();
    const r = parseText(body + INJECTED, SIG({ l: signedLen(body) }));

    // ★★ מה שנקרא הוא ההזמנה החתומה, במלואה.
    expect(r.sourceVerified).toBe(true);
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
    expect(r.recipient.city).toBe('תל דוגמה');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].quantity).toBe(1);

    // ★★ ושום דבר מהתוקף — לא כתובת, לא שם, לא עיר — אינו קיים בתוצאה.
    const blob = JSON.stringify(r);
    for (const leaked of ['רחוב התוקף 9', 'דן התוקף', 'קריית הזיוף']) {
      expect(blob).not.toContain(leaked);
    }

    // ★ ולכן ההזמנה עוברת. אין כאן "ויתור": אין מה לחסום, כי אין מה לזלוג.
    expect(r.needsHumanReview).toBe(false);

    // ★ הממצא עצמו לא נמחק — הוא ירד לדרגה שאינה מוצגת על הכרטיס, וממשיך
    // להיספר. מבחן שהיה מקבל גם היעלמות מוחלטת שלו הוא מבחן חלש יותר.
    const found = r.issues.find((i) => i.code === 'unsignedBodyTail');
    expect(found?.severity).toBe('info');

    // ★★ והנימוק לא מכחיש את הכרטיס: יש כתובת, ולכן אסור שייכתב בו שלא
    // הוצגה כתובת. זה בדיוק הכשל שנתפס באותו יום במסך אחר.
    expect(r.reasonHe).not.toContain('לא הצגתי כתובת');
    expect(r.reasonHe).toContain('החלק שחברת הסליקה חתמה עליו');
  });

  // ---------------------------------------------------------------------------
  // ★★ ומה שכן נשאר חוסם — ההפרש שבו החסימה עדיין נכונה.
  it('★★ כשהחיתוך קטע את ההזמנה באמצע — אין כתובת, ויש הסבר', () => {
    const body = plainBody();
    // גבול שנופל לפני שטבלת המוצרים נגמרה: מה שחתום אינו הזמנה שלמה.
    const r = parseText(body + INJECTED, SIG({ l: 120 }));

    expect(r.sourceVerified).toBe(false);
    expect(r.recipient.street).toBeNull();
    const found = r.issues.find((i) => i.code === 'unsignedBodyTail');
    expect(found?.severity).toBe('block');

    // ★ הנוסח אומר מה קרה ומה לעשות — ו**אינו** מאשים. גבול `l=` שנגמר
    // מוקדם הוא התנהגות של מערכת החתימה, לא ראיה לתוקף.
    expect(found?.messageHe).toContain('נגמר לפני שההזמנה הושלמה');
    expect(found?.messageHe).not.toContain('מישהו');
    expect(r.reasonHe).not.toContain('מישהו');
  });

  it('★★ החיתוך הוא **בבתים** ולא בתווים', () => {
    // עברית ב-UTF-8 היא שני בתים לאות. חיתוך תמים לפי אורך המחרוזת היה
    // משאיר בערך פי שניים ממה שנחתם — כלומר משאיר בדיוק את מה שהוא נועד
    // למחוק.
    const heb = 'אבגד';
    expect(utf8ByteLength(heb)).toBe(8);
    expect(limitToSignedBody(heb, 4).body).toBe('אב');
    expect(limitToSignedBody(heb, 4).bytesDropped).toBe(4);
  });

  it('★ גבול שנופל באמצע תו רב-בתי — התו יורד כולו, בלי תו שבור', () => {
    const heb = 'אבגד';
    const cut = limitToSignedBody(heb, 5); // 5 בתים = שתי אותיות + חצי
    expect(cut.body).toBe('אב');
    expect(cut.body).not.toContain('�');
    expect(cut.truncated).toBe(true);
    expect(cut.bytesDropped).toBe(4);

    // אותו דבר עם תו מחוץ ל-BMP (4 בתים).
    const mixed = 'א😀';
    expect(utf8ByteLength(mixed)).toBe(6);
    expect(limitToSignedBody(mixed, 4).body).toBe('א');
  });

  it('★ אין `l=` בכלל → כל הגוף חתום, וזה המצב הטוב', () => {
    const body = plainBody();
    const r = parseText(body + INJECTED, SIG());
    // בלי הגבלה אין חיתוך — ולכן גם אין ממצא של תוספת. מה שכן נדלק כאן הוא
    // ההגנה הישנה: אותה תווית פעמיים עם ערכים שונים.
    expect(r.issues.some((i) => i.code === 'unsignedBodyTail')).toBe(false);
    expect(r.issues.some((i) => i.code === 'suspiciousValue')).toBe(true);
    expect(parseDkimSignature(SIG()).bodyLengthLimit).toBeNull();
  });

  it('★ `l=` פגום אינו "אין הגבלה" אלא סירוב', () => {
    const raw = 'v=1; d=tranzila.com; h=From:Subject; l=abc; b=x=';
    const r = parseOrderMessage({
      fromAddress: ORDER_SENDER_ADDRESS,
      subject: ORDER_SUBJECT_HE,
      bodyText: plainBody(),
      authenticationResults: DKIM_PASS,
      dkimSignature: raw,
    });
    expect(r.sourceVerified).toBe(false);
    expect(r.issues[0].code).toBe('signatureScopeUnreadable');
    expect(r.recipient.street).toBeNull();
  });

  // ★ הטענה כאן מעולם לא הייתה "חוסם" — היא "**ממצא אחד**, ולא שניים
  // ולא אפס", כשהחיתוך קרה באתר הקריאה ולא בפרסר. זה נשאר כפי שהוא;
  // רק שורת ה-`needsHumanReview` הוחלפה בבדיקת הדרגה, כי היא זו שמתארת
  // את ההתנהגות אחרי 16.9.
  it('★ הבתים שאתר הקריאה כבר חתך מדווחים כאותו ממצא', () => {
    // החיתוך יכול לקרות בשני מקומות; הממצא אחד, ולא שניים או אפס.
    const r = parseOrderMessage({
      fromAddress: ORDER_SENDER_ADDRESS,
      subject: ORDER_SUBJECT_HE,
      bodyText: plainBody(),
      authenticationResults: DKIM_PASS,
      dkimSignature: SIG(),
      unsignedTailBytes: 128,
    });
    const found = r.issues.filter((i) => i.code === 'unsignedBodyTail');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(r.needsHumanReview).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // ★★ ולמה לא ניסינו להבחין בין "זנב רגיל" ל"זנב שנראה כמו הזמנה שנייה".
  //
  // ההצעה המתבקשת הייתה: להסתכל בזנב, ואם הוא נראה כמו הזמנה — לחסום.
  // המבחן הזה מראה למה זה לא שווה כלום כבקרת אבטחה: **צורת הזנב היא בחירה
  // של התוקף.** אותה מתקפה בדיוק, בשתי צורות, כשאין `l=` שיחתוך —
  // ובשתיהן ההגנה שמחזיקה היא לא זיהוי הצורה.
  it('★★ חלק MIME שלם שהודבק בסוף — נקרא החלק הראשון, לא האחרון', () => {
    const B = '----=_test_boundary_x1';
    const part = (body: string) =>
      ['--' + B, 'Content-Type: text/plain; charset="UTF-8"', '', body].join('' + String.fromCharCode(13, 10));
    const raw = [
      part(plainBody()),
      part(plainBody({ name: 'דן התוקף', street: 'רחוב התוקף 9', city: 'קריית הזיוף' })),
      '--' + B + '--',
      '',
    ].join(String.fromCharCode(13, 10));

    // ★ אין `l=` — כלומר החיתוך לא מסיר כאן כלום, וזה המקרה הקשה.
    const picked = selectReadablePart(raw);
    expect(picked.kind).toBe('text');
    expect(picked.body).toContain('רחוב הדוגמה 14');
    // ★★ `pickFrom` בוחר את **הראשון** מסוג `text/plain`. חלק שהודבק
    // בסוף אינו יכול להחליף את החלק שהספק כתב, גם בלי שום חיתוך.
    expect(picked.body).not.toContain('רחוב התוקף 9');

    const r = parseText(picked.body, SIG());
    expect(r.recipient.street).toBe('רחוב הדוגמה 14');
    expect(JSON.stringify(r)).not.toContain('רחוב התוקף 9');
  });
});

// ---------------------------------------------------------------------------

describe('★ `h=` — מה בכלל חתום מבין הכותרות', () => {
  it('רשימה שאינה מכסה את השולח והנושא → אין פענוח', () => {
    const r = parseText(plainBody(), SIG({ h: 'Received:To:MIME-Version' }));
    expect(r.sourceVerified).toBe(false);
    expect(r.issues[0].code).toBe('signatureScopeMismatch');
    expect(r.recipient.name).toBeNull();
  });

  it('רשימה שמכסה את שניהם → ממשיכים כרגיל', () => {
    const tags = parseDkimSignature(SIG());
    expect(signsHeader(tags, 'From')).toBe(true);
    expect(signsHeader(tags, 'subject')).toBe(true);
    // ★ ואלה שני אלה שלא מכוסים בהודעה האמיתית — ולכן אסור להישען עליהם.
    expect(signsHeader(tags, 'date')).toBe(false);
    expect(signsHeader(tags, 'message-id')).toBe(false);
  });

  it('★ חתימה של דומיין אחר לא נקראת כאילו היא של הספק', () => {
    const r = parseText(plainBody(), SIG({ d: 'evil.example' }));
    expect(r.sourceVerified).toBe(false);
    expect(r.issues[0].code).toBe('dkimFail');
  });

  it('★ מבין כמה חתימות נבחרת זו של הספק', () => {
    const tags = signatureForDomain(
      [SIG({ d: 'relay.example', l: 10 }), SIG({ l: 4242 })],
      ORDER_SIGNING_DOMAIN,
    );
    expect(tags.matchesDomain).toBe(true);
    expect(tags.bodyLengthLimit).toBe(4242);
  });

  it('אין כותרת חתימה בכלל → הערה גלויה, לא חסימה', () => {
    const r = parseText(plainBody(), null);
    expect(r.sourceVerified).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.issues.some((i) => i.code === 'signatureScopeUnknown')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('★ הנושא מגיע מקודד (RFC 2047)', () => {
  const b64 = `=?UTF-8?B?${Buffer.from(ORDER_SUBJECT_HE, 'utf8').toString('base64')}?=`;

  it('בסיס 64 מפוענח לפני ההשוואה', () => {
    expect(isOrderSubject(b64)).toBe(true);
  });

  it('קידוד Q מפוענח גם הוא, כולל קו תחתון כרווח', () => {
    expect(decodeMimeWords('=?UTF-8?Q?=D7=A2=D7=A1=D7=A7=D7=94_=D7=97=D7=93=D7=A9=D7=94?=')).toBe(
      'עסקה חדשה',
    );
  });

  it('שתי מילים מקודדות סמוכות — הרווח ביניהן אינו חלק מהטקסט', () => {
    const a = `=?UTF-8?B?${Buffer.from('עסקה ', 'utf8').toString('base64')}?=`;
    const b = `=?UTF-8?B?${Buffer.from('חדשה', 'utf8').toString('base64')}?=`;
    expect(decodeMimeWords(`${a} ${b}`)).toBe('עסקה חדשה');
  });

  it('נושא רגיל לא נפגע', () => {
    expect(isOrderSubject(ORDER_SUBJECT_HE)).toBe(true);
    expect(decodeMimeWords('עסקה חדשה')).toBe('עסקה חדשה');
  });

  it('★★ ובלי הפענוח — הזמנה אמיתית הייתה נדחית', () => {
    // המבחן הזה מתעד את הכשל שהיה קורה: השוואה ישירה מול המחרוזת המקודדת.
    expect(b64).not.toBe(ORDER_SUBJECT_HE);
    const r = parseText(plainBody(), SIG(), b64);
    expect(r.sourceVerified).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('★★ קוראים מ-`text/plain`', () => {
  const rawMime = [
    '--=_alt_001',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '=D7=A2=D7=99=D7=A8',
    '=D7=AA=D7=9C =D7=93=D7=95=D7=92=D7=9E=D7=94',
    '--=_alt_001',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<p>=D7=94=D7=98=D7=9E=D7=A2=D7=94 =D7=9E=D7=94-HTML</p>',
    '--=_alt_001--',
    '',
  ].join('\r\n');

  it('החלק שנבחר הוא הטקסט, לא ה-HTML', () => {
    const picked = selectReadablePart(rawMime);
    expect(picked.kind).toBe('text');
    expect(picked.body).toContain('תל דוגמה');
    expect(picked.body).not.toContain('HTML');
    expect(picked.partCount).toBe(2);
  });

  it('★ שבירת שורה רכה של quoted-printable מחוברת חזרה', () => {
    // בלי זה מילה עברית נקראת חצי — ואז שם רחוב יוצא שגוי על החבילה.
    const raw = [
      '--=_alt_002',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '=D7=A8=D7=97=D7=95=D7=91 =D7=94=D7=93=D7=95=D7=92=D7=9E=',
      '=D7=94 14',
      '--=_alt_002--',
      '',
    ].join('\r\n');
    expect(selectReadablePart(raw).body).toContain('רחוב הדוגמה 14');
  });

  it('★ הודעה בלי חלק טקסט — נפילה לאחור ל-HTML, ומדווחת ככזאת', () => {
    const raw = [
      '--=_alt_003',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<p>שלום</p>',
      '--=_alt_003--',
      '',
    ].join('\r\n');
    const picked = selectReadablePart(raw);
    expect(picked.kind).toBe('html');
  });

  it('★★ אתר הקריאה בוחר את הטקסט, וסופר מאיזה חלק קרא', () => {
    const read = readOrderBodies([
      {
        messageId: 'm1',
        threadId: 't1',
        fromAddress: ORDER_SENDER_ADDRESS,
        subject: ORDER_SUBJECT_HE,
        receivedAt: '2026-08-26T08:00:00+03:00',
        bodyRaw: rawMime,
        dkimSignature: SIG(),
      },
    ]);
    expect(read.parts).toEqual(['text']);
    expect(read.bodies.get('m1')?.kind).toBe('text');
    expect(read.bodies.get('m1')?.body).not.toContain('<p>');
  });

  it('★★ ובגוף הגולמי החיתוך קורה **לפני** בחירת החלק', () => {
    // כאן `l=` נגמר בתוך חלק הטקסט: מה שאחריו — כולל חלק MIME שלם — לא
    // מגיע הלאה בכלל.
    const head = [
      '--=_alt_004',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'שם לקוח',
      'רונית שדה',
      '',
    ].join('\r\n');
    const tail = ['רחוב התוקף 9', '--=_alt_004--', ''].join('\r\n');

    const read = readOrderBodies([
      {
        messageId: 'm2',
        threadId: 't2',
        fromAddress: ORDER_SENDER_ADDRESS,
        subject: ORDER_SUBJECT_HE,
        receivedAt: '2026-08-26T08:00:00+03:00',
        bodyRaw: head + tail,
        dkimSignature: SIG({ l: utf8ByteLength(head) }),
      },
    ]);
    const part = read.bodies.get('m2');
    expect(part?.body).toContain('רונית שדה');
    expect(part?.body).not.toContain('התוקף');
    expect(part?.unsignedBytes).toBeGreaterThan(0);
    expect(read.unsignedTailCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('★★ כפילות לפי תוכן חתום, לא לפי מזהה', () => {
  const base = {
    threadId: 't',
    fromAddress: ORDER_SENDER_ADDRESS,
    subject: ORDER_SUBJECT_HE,
    dkimSignature: SIG(),
    authenticationResults: DKIM_PASS,
  };

  const run = runOrderPipeline(
    [
      { ...base, messageId: 'a1', threadId: 'ta', receivedAt: '2026-08-26T08:00:00+03:00', bodyText: plainBody() },
      // ★ אותה הודעה בדיוק, עם מזהה אחר. `Message-ID` אינו חתום — כלומר
      // שינוי שלו אינו שובר שום דבר, וזיהוי לפי מזהה בלבד לא היה רואה כלום.
      { ...base, messageId: 'a2', threadId: 'tb', receivedAt: '2026-08-26T09:30:00+03:00', bodyText: plainBody() },
      { ...base, messageId: 'a3', threadId: 'tc', receivedAt: '2026-08-26T10:00:00+03:00', bodyText: plainBody({ name: 'מיכל אלמוג', street: 'שדרות המשל 8' }) },
    ],
    { now: '2026-08-26T13:00:00+03:00' },
  );

  it('הראשונה נשארת ברשימת האריזה', () => {
    expect(run.toShip.map((o) => o.sourceMessageId)).toContain('a1');
  });

  it('★ השנייה נעצרת לבדיקה עם הסבר, ולא נמחקת', () => {
    const dup = run.orders.find((o) => o.sourceMessageId === 'a2');
    expect(dup?.needsHumanReview).toBe(true);
    expect(dup?.issues.some((i) => i.code === 'duplicateOrder')).toBe(true);
    expect(run.needsAttention.map((o) => o.sourceMessageId)).toContain('a2');
  });

  it('הזמנה אחרת באותו יום אינה כפילות', () => {
    const other = run.orders.find((o) => o.sourceMessageId === 'a3');
    expect(other?.issues.some((i) => i.code === 'duplicateOrder')).toBe(false);
  });

  it('★ מפתח התוכן יציב מול רווחים ושורות, ושונה מול תוכן שונה', () => {
    const a = contentFingerprint('שם לקוח\nרונית שדה');
    const b = contentFingerprint('  שם לקוח   רונית שדה  ');
    const c = contentFingerprint('שם לקוח\nדן התוקף');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(contentFingerprint('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('★★ על ה-fixtures — ההודעה העוינת החדשה', () => {
  const run = runOrderPipeline(orderMessages, { now: '2026-08-26T13:00:00+03:00' });
  const byId = (id: string) => run.orders.find((o) => o.sourceMessageId === id);

  // ---------------------------------------------------------------------------
  // ★★ ההכרעה על msg-120 (16.9.2026): **מתקבלת, בלי הערה על הכרטיס.**
  //
  // ההזמנה שהספק חתם עליה נקראה במלואה ובמדויק; ההזמנה שהתוקף הדביק אחריה
  // נחתכה לפני שנקרא ממנה תו אחד. אין פער בין מה שמוצג לבין מה שנחתם, ולכן
  // אין מה לבקש מבעלת העסק שתבדוק. חסימה כאן הייתה אומרת לה "משהו לא
  // בסדר" על הזמנה שהיא בדיוק בסדר — ובאותו מנגנון בדיוק היא הייתה נאמרת
  // על כל 60 ההזמנות האמיתיות שלה, שאין בהן שום תוקף.
  //
  // ★ ההוכחה שהתצוגה נקייה יושבת ב-`orderPipeline.test.tsx`, על ה-HTML
  // המרונדר עצמו ולא על האובייקט.
  it('★★ msg-120 — מתקבלת, והכתובת שנקראה היא של הלקוחה החתומה', () => {
    const o = byId('msg-120');
    expect(o?.needsHumanReview).toBe(false);
    expect(run.toShip.map((x) => x.sourceMessageId)).toContain('msg-120');
    expect(run.needsAttention.map((x) => x.sourceMessageId)).not.toContain('msg-120');

    // ★★ הפרטים הם של הנמענת מהחלק החתום, ורק שלה.
    expect(o?.recipient.name).toBe('נועה גלעד');
    expect(o?.recipient.street).toBe('רחוב הדוגמה 33');
    expect(o?.recipient.city).toBe('ניר הדוגמה');
    expect(o?.recipient.phone).toBe('050-555-0120');

    // ★ ההזמנה השנייה שהודבקה ביקשה 2 יחידות. נקראה אחת — שלה.
    expect(o?.items).toHaveLength(1);
    expect(o?.items[0].quantity).toBe(1);

    // ★ הממצא נשמר ונספר, בדרגה שאינה מוצגת על הכרטיס.
    const found = o?.issues.find((i) => i.code === 'unsignedBodyTail');
    expect(found?.severity).toBe('info');
    expect(o?.issues.some((i) => i.severity === 'warn')).toBe(false);
  });

  it('★★ הכתובת של התוקף אינה נמצאת בשום מקום בתוצאת הריצה', () => {
    const blob = JSON.stringify(run);
    for (const leaked of ['רחוב התוקף 9', 'דן התוקף', 'קריית הזיוף', 'dan@matchzeh.example']) {
      expect(blob).not.toContain(leaked);
    }
  });

  it('★ msg-121 — חתימה שאינה מכסה את השולח והנושא אינה מספיקה', () => {
    const o = byId('msg-121');
    expect(o?.issues.some((i) => i.code === 'signatureScopeMismatch')).toBe(true);
    expect(o?.recipient.street).toBeNull();
  });

  it('★ כל ההודעות בקובץ נקראו מחלק הטקסט, ואחת בלבד נחתכה', () => {
    expect(run.stats.readParts).toEqual(['text']);
    expect(run.stats.unsignedTail).toBe(1);
  });

  it('★ הודעה בלי `l=` נקראת במלואה כרגיל', () => {
    // msg-111 היא ההזמנה מרובת הפריטים, והחתימה שלה בלי תג אורך.
    const o = byId('msg-111');
    expect(o?.needsHumanReview).toBe(false);
    expect(o?.items.filter((i) => i.isPackable).reduce((s, i) => s + i.quantity, 0)).toBe(14);
  });
});
