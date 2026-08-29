// ============================================================================
// gmailContract.test.ts — ★★★ **המבחן של הפרוסה הזאת.**
//
// ---------------------------------------------------------------------------
// מה הוא מגן עליו, ולמה הוא נכתב אחרת מכל מבחן אחר בפרויקט
// ---------------------------------------------------------------------------
// כל 356 המבחנים הקיימים מזינים fixture שיש בו `bodyRaw` **ו**-`dkimSignature`.
// כלומר כולם בודקים את הלוגיקה — ואף אחד מהם לא בודק **מה הוזן לה**. זו
// בדיוק האזהרה שנכתבה ב-README:
//
// > *"אם שכבת ה-Gmail תביא רק חלק מפוענח בלי כותרת חתימה, החיתוך פשוט לא
// > יקרה — **כל המבחנים יישארו ירוקים, וההגנה תיעלם בשקט.** זו הצורה
// > המסוכנת ביותר שבה בקרה נעלמת."*
//
// המבחן הזה הוא ההפך: הוא מזין **שליפה פגומה** ודורש שהמערכת תסרב. הוא
// ייכשל אם מישהו ישנה את `format` ל-`full`, אם יפסיקו לקרוא את כותרת
// החתימה, או אם השער יוחלף בבדיקה מרככת שמחזירה דגל במקום לזרוק.
//
// ---------------------------------------------------------------------------
// ★★★ ומה שהתגלה תוך כדי כתיבתו — האזהרה הייתה נכונה, ורכה מדי
// ---------------------------------------------------------------------------
// ה-README ניסח את הסכנה כ"גוף מפוענח **בלי** כותרת חתימה". התברר
// ש**התנאי השני מיותר**: מספיק גוף מפוענח, גם כשהחתימה הגיעה במלואה.
//
// `l=` נמדד בבתים של הגוף **הגולמי**; החלק המפוענח קצר ממנו תמיד. לכן
// `limitToSignedBody(decoded, 2612)` מחזיר את הכול, `bytesDropped = 0`,
// ואין ממצא. החיתוך לא נשבר — הוא הפך ל-no-op חשבוני, בלי חריג ובלי שגיאה.
//
// ההנמקה המלאה, והמדידה שמוכיחה אותה, יושבות מעל ה-`describe` השני.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  candidateContractViolation,
  FetchContractError,
  gmailMessageToCandidate,
  GMAIL_MESSAGE_FORMAT,
  readHeader,
  type GmailRawMessage,
} from '../shared/lib/gmailContract';
import { readOrderBodies } from '../shared/lib/orderSource';
import { parseOrderMessage } from '../shared/lib/orderParse';
import { ordersFixture } from '../src/fixtures';

// ---------------------------------------------------------------------------
// עזרים: בניית תשובת Gmail אמיתית מהפיקסצ'ר
// ---------------------------------------------------------------------------

const SAMPLE = ordersFixture.messages.find((m) => m.messageId === 'msg-101')!;

const AUTH_RESULTS =
  'mx.google.com; dkim=pass header.d=tranzila.com header.b=Ab3dEf; spf=pass smtp.mailfrom=tranzila.com; dmarc=pass header.from=tranzila.com';

/** כותרות + שורה ריקה + גוף, כפי שההודעה יושבת על החוט. */
function rfc822(opts: {
  from?: string;
  subject?: string;
  body: string;
  dkim?: string | null;
  auth?: string | null;
}): string {
  const headers = [
    'Received: by mx.google.com with SMTP id abc123',
    `From: ${opts.from ?? '"טרנזילה" <pay@tranzila.com>'}`,
    'To: dorit@example.com',
    `Subject: ${opts.subject ?? SAMPLE.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="----=_tranzila_alt_9f2c1"',
  ];
  if (opts.auth !== null) headers.push(`Authentication-Results: ${opts.auth ?? AUTH_RESULTS}`);
  if (opts.dkim !== null) headers.push(`DKIM-Signature: ${opts.dkim ?? SAMPLE.dkimSignature}`);
  return headers.join('\r\n') + '\r\n\r\n' + opts.body;
}

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

/** ★ תשובת `messages.get(format:'raw')` תקינה. */
function rawResponse(overrides: Partial<GmailRawMessage> = {}, body = SAMPLE.bodyRaw!): GmailRawMessage {
  return {
    id: 'gmail-1',
    threadId: 'thread-1',
    internalDate: String(Date.parse('2026-08-26T08:12:00+03:00')),
    raw: b64url(rfc822({ body })),
    ...overrides,
  };
}

/**
 * ★★ **השליפה הפגומה.** זו שכל הסעיף נכתב עליה.
 *
 * זה בדיוק מה ש-`format:'full'` מחזיר: `payload` עם חלקים מפוענחים, בלי
 * `raw`. הוא נראה עשיר יותר — יש בו את כל התוכן — ולכן הוא הפיתוי.
 */
function decodedOnlyResponse(body: string): GmailRawMessage {
  return {
    id: 'gmail-1',
    threadId: 'thread-1',
    internalDate: String(Date.parse('2026-08-26T08:12:00+03:00')),
    payload: {
      headers: [{ name: 'From', value: 'pay@tranzila.com' }],
      parts: [{ mimeType: 'text/plain', body: { data: b64url(body) } }],
    },
  };
}

/**
 * ★★ הזנב שהתוקף מדביק.
 *
 * התרחיש מ-8א/B10: התוקף קנה מהחנות בעצמו, קיבל הודעה **אמיתית וחתומה**,
 * והדביק בסופה טבלת הזמנה שנייה עם הכתובת שלו. `dkim=pass` נשאר תקף, כי
 * `l=` מכסה רק את הבתים הראשונים.
 */
const ATTACKER_STREET = 'רחוב התוקף 99';
const forgedTail =
  '\r\n------=_tranzila_alt_9f2c1\r\n' +
  'Content-Type: text/plain; charset="UTF-8"\r\n\r\n' +
  'שם לקוח\r\nתוקף אלמוני\r\n' +
  `כתובת\r\n${ATTACKER_STREET}\r\n` +
  'עיר\r\nעיר התוקף\r\n' +
  'מיקוד\r\n1111111\r\n' +
  'סכום ששולם\r\n999.00 ₪\r\n';

// ---------------------------------------------------------------------------

describe('gmailContract — ארבעת הדברים ששכבת השליפה חייבת להביא', () => {
  it('הפורמט הנדרש הוא raw, וזה קבוע ולא מחרוזת מקומית', () => {
    expect(GMAIL_MESSAGE_FORMAT).toBe('raw');
  });

  it('שליפה תקינה מייצרת candidate עם גוף גולמי, חתימה, ותוצאת אימות', () => {
    const c = gmailMessageToCandidate(rawResponse());
    expect(c.bodyRaw).toContain('tranzila_alt');
    expect(c.dkimSignature).toBeTruthy();
    expect(String(c.authenticationResults)).toContain('dkim=pass');
    // ★ (ד) — זמן הקליטה, לא כותרת Date.
    expect(c.receivedAt).toBe(new Date(Date.parse('2026-08-26T08:12:00+03:00')).toISOString());
  });

  it('★★ תשובה עם payload ובלי raw — נזרקת כ-formatNotRaw', () => {
    expect(() => gmailMessageToCandidate(decodedOnlyResponse(SAMPLE.bodyRaw!))).toThrowError(
      FetchContractError,
    );
    try {
      gmailMessageToCandidate(decodedOnlyResponse(SAMPLE.bodyRaw!));
    } catch (e) {
      expect((e as FetchContractError).code).toBe('formatNotRaw');
    }
  });

  it('★★ הודעה בלי כותרת DKIM-Signature — נזרקת, ולא "נקראת בזהירות"', () => {
    const raw = b64url(rfc822({ body: SAMPLE.bodyRaw!, dkim: null }));
    try {
      gmailMessageToCandidate(rawResponse({ raw }));
      throw new Error('היה אמור להיזרק');
    } catch (e) {
      expect(e).toBeInstanceOf(FetchContractError);
      expect((e as FetchContractError).code).toBe('dkimSignatureHeaderMissing');
    }
  });

  it('הודעה בלי Authentication-Results — נזרקת', () => {
    const raw = b64url(rfc822({ body: SAMPLE.bodyRaw!, auth: null }));
    try {
      gmailMessageToCandidate(rawResponse({ raw }));
      throw new Error('היה אמור להיזרק');
    } catch (e) {
      expect((e as FetchContractError).code).toBe('authResultsHeaderMissing');
    }
  });

  it('הודעה בלי internalDate — נזרקת. תאריך מכותרת Date אינו קביל', () => {
    try {
      gmailMessageToCandidate(rawResponse({ internalDate: null }));
      throw new Error('היה אמור להיזרק');
    } catch (e) {
      expect((e as FetchContractError).code).toBe('internalDateMissing');
    }
  });

  it('★ הודעה משולח אחר — הגוף לא נשלף בכלל', () => {
    const raw = b64url(
      rfc822({ body: SAMPLE.bodyRaw!, from: '"מערכת סליקה" <attacker@gmail.com>' }),
    );
    try {
      gmailMessageToCandidate(rawResponse({ raw }));
      throw new Error('היה אמור להיזרק');
    } catch (e) {
      expect((e as FetchContractError).code).toBe('senderMismatch');
    }
  });

  it('כותרת מתקפלת (folded) נקראת כערך אחד', () => {
    const headers = 'From: pay@tranzila.com\r\nDKIM-Signature: v=1; a=rsa;\r\n  l=100; d=x\r\n';
    expect(readHeader(headers, 'DKIM-Signature')[0]).toBe('v=1; a=rsa; l=100; d=x');
  });

  it('שתי כותרות DKIM-Signature חוזרות שתיהן', () => {
    const headers = 'DKIM-Signature: v=1; d=a.com\r\nDKIM-Signature: v=1; d=b.com\r\n';
    expect(readHeader(headers, 'DKIM-Signature')).toHaveLength(2);
  });
});

describe('★★ הרשת השנייה — candidateContractViolation', () => {
  it('candidate בלי גוף גולמי נפסל', () => {
    expect(candidateContractViolation({ dkimSignature: 'x', authenticationResults: 'y' })).toBe(
      'rawBodyMissing',
    );
  });

  it('★★ candidate עם גוף ובלי חתימה נפסל — זה המקרה שנעלם בשקט', () => {
    expect(
      candidateContractViolation({ bodyRaw: 'abc', authenticationResults: 'y', receivedAt: 'z' }),
    ).toBe('dkimSignatureHeaderMissing');
  });

  it('candidate מלא עובר', () => {
    expect(
      candidateContractViolation({
        bodyRaw: 'abc',
        dkimSignature: ['sig'],
        authenticationResults: 'dkim=pass',
        receivedAt: '2026-08-26T05:12:00.000Z',
      }),
    ).toBeNull();
  });
});


// ============================================================================
// ★★★ הלב: אותה הודעה, שתי שכבות שליפה, שתי תוצאות הפוכות
// ============================================================================
//
// ---------------------------------------------------------------------------
// ★★★ מה שהתגלה כשנכתב המבחן הזה, והוא חד יותר ממה שנוסח ב-README
// ---------------------------------------------------------------------------
// האזהרה המקורית דיברה על שליפה שמביאה **גוף מפוענח בלי כותרת חתימה**.
// המבחן הזה מראה שהתנאי השני מיותר: **מספיק גוף מפוענח, גם כשהחתימה כן
// הגיעה.**
//
// הסיבה אריתמטית ולא עקרונית. `l=` נמדד בבתים של הגוף **הגולמי** — כאן
// `l=2612` על גוף גולמי באורך 2612. החלק המפוענח `text/plain` קצר בהרבה
// (קידוד quoted-printable ותגי MIME נעלמים בפענוח). לכן:
//
//     limitToSignedBody(decoded, 2612)  →  מחזיר את הכול. bytesDropped = 0.
//
// כלומר החיתוך **מתבצע** — הוא פשוט לא חותך כלום, כי הגבול רחב מהקלט.
// ואז `unsignedBytes === 0`, אין ממצא `unsignedBodyTail`, ואיש לא מקבל
// שום סימן שההודעה נגעה. הבקרה לא נשברה — היא הפכה ל-no-op חשבוני.
//
// **וזו בדיוק "בקרה שנעלמת בשקט".** אין חריג, אין שגיאה, אין מבחן אדום.
// יש `Math.min` שמחזיר את הצד הלא נכון.
//
// ---------------------------------------------------------------------------
// מה נשבר בפועל — הוכחה, לא הצהרה
// ---------------------------------------------------------------------------
// `contentKey` נגזר **מהגוף החתום שנקרא**, וזו ההגנה מפני שידור חוזר: תג
// ה-`h=` של הספק אינו מכסה את `Message-ID`, ולכן אפשר לקחת הודעת עסקה
// אמיתית, לשנות בה את המזהה, ולשלוח שוב.
//
// עם חיתוך אמיתי, שתי גרסאות של אותה הזמנה עם זנבות שונים מייצרות **אותו**
// `contentKey` → השנייה מסומנת ככפילות ולא נארזת.
// בלי חיתוך אמיתי, הן מייצרות **מפתחות שונים** → שתי הזמנות, שתי חבילות,
// תשלום אחד.
// ============================================================================

/** ★ החלק המפוענח, כפי ש-`format:'full'` היה מחזיר אותו. */
function decodedPlainPart(): string {
  const c = gmailMessageToCandidate(rawResponse());
  return readOrderBodies([c]).bodies.get(c.messageId)!.body;
}

/** שני זנבות שונים על אותה הזמנה חתומה — תרחיש השידור החוזר. */
const TAIL_A = '\r\nX-Tracking: aaaaaaaaaaaaaaaaaaaa\r\n';
const TAIL_B = '\r\nX-Tracking: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\r\n';

function parseWith(body: string, kind: 'text' | 'raw-derived', unsignedBytes: number) {
  return parseOrderMessage({
    fromAddress: 'pay@tranzila.com',
    subject: SAMPLE.subject,
    bodyText: body,
    authenticationResults: AUTH_RESULTS,
    dkimSignature: SAMPLE.dkimSignature,
    unsignedTailBytes: kind === 'raw-derived' ? unsignedBytes : 0,
  });
}

describe('★★★ החיתוך ל-l= — והוכחה שהוא תלוי בגוף הגולמי ולא בפרסר', () => {
  it('★★ מסלול raw: זנב שנוסף אחרי החתימה נחתך, ומדווח כממצא חוסם', () => {
    const c = gmailMessageToCandidate(rawResponse({}, SAMPLE.bodyRaw! + forgedTail));
    const read = readOrderBodies([c]);

    expect(read.unsignedTailCount).toBe(1);
    const part = read.bodies.get(c.messageId)!;
    expect(part.unsignedBytes).toBeGreaterThan(0);

    // ★★ מה שהתוקף הדביק לא עבר הלאה בכלל.
    expect(part.body).not.toContain(ATTACKER_STREET);

    const parsed = parseWith(part.body, 'raw-derived', part.unsignedBytes);
    expect(parsed.needsHumanReview).toBe(true);
    expect(parsed.issues.some((i) => i.code === 'unsignedBodyTail')).toBe(true);
    expect(JSON.stringify(parsed)).not.toContain(ATTACKER_STREET);
  });

  it('★★★ מסלול מפוענח: אותה חתימה בדיוק — והחיתוך לא חותך כלום', () => {
    const plain = decodedPlainPart();

    // ה-l= הוא 2612 בתים גולמיים; החלק המפוענח קצר ממנו.
    expect(Buffer.byteLength(plain, 'utf8')).toBeLessThan(2612);

    const parsed = parseWith(plain + TAIL_A, 'text', 0);

    // ★★★ **אין ממצא. אין אזהרה. אין שום סימן שההודעה נגעה.**
    expect(parsed.issues.some((i) => i.code === 'unsignedBodyTail')).toBe(false);
    expect(parsed.sourceVerified).toBe(true);
  });

  it('★★★ ולכן זיהוי הכפילות נשבר: אותה הזמנה, שני זנבות, שני מפתחות תוכן', () => {
    const plain = decodedPlainPart();

    const a = parseWith(plain + TAIL_A, 'text', 0);
    const b = parseWith(plain + TAIL_B, 'text', 0);

    // שניהם נקראו בהצלחה — כלומר שניהם היו מגיעים לרשימת האריזה.
    expect(a.contentKey).toBeTruthy();
    expect(b.contentKey).toBeTruthy();

    // ★★★ **וזה הכשל.** אותה הזמנה חתומה, שני מפתחות שונים → `markDuplicates`
    // לא יסמן דבר → שתי חבילות יוצאות על תשלום אחד.
    expect(a.contentKey).not.toBe(b.contentKey);
  });

  it('★★ ומול זה — מסלול raw מייצר מפתח תוכן **זהה** לשני הזנבות', () => {
    const readA = readOrderBodies([
      gmailMessageToCandidate(rawResponse({ id: 'a' }, SAMPLE.bodyRaw! + TAIL_A)),
    ]);
    const readB = readOrderBodies([
      gmailMessageToCandidate(rawResponse({ id: 'b' }, SAMPLE.bodyRaw! + TAIL_B)),
    ]);

    const partA = readA.bodies.get('a')!;
    const partB = readB.bodies.get('b')!;

    // הזנב נחתך בשני המקרים, ולכן מה שנקרא זהה.
    expect(partA.unsignedBytes).toBeGreaterThan(0);
    expect(partB.unsignedBytes).toBeGreaterThan(0);
    expect(partA.body).toBe(partB.body);

    const a = parseWith(partA.body, 'raw-derived', partA.unsignedBytes);
    const b = parseWith(partB.body, 'raw-derived', partB.unsignedBytes);

    // ★★ אותו מפתח → הכפילות נתפסת. **זה מה שהחיתוך קונה.**
    expect(a.contentKey).toBe(b.contentKey);
  });

  it('★★★ והשער: השליפה המפוענחת נדחית לפני שהיא מגיעה לפרסר בכלל', () => {
    expect(() =>
      gmailMessageToCandidate(decodedOnlyResponse(decodedPlainPart() + TAIL_A)),
    ).toThrowError(FetchContractError);
  });
});
