// ============================================================================
// gmailContract.ts — ★★ החוזה של שכבת השליפה. **הבקרה שהכי קל לאבד.**
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה קיים, ולמה הוא זורק ולא מחזיר "בערך"
// ---------------------------------------------------------------------------
// ה-README של פרוסה 0 רשם את זה כסעיף 3ב, וזה הסעיף היחיד שנוסח כאזהרה
// ולא כמשימה:
//
// > *"שליפה שתביא רק גוף מפוענח **תשתיק את החיתוך** בלי להפיל שום מבחן."*
//
// זו טענה מדויקת על הקוד שכבר קיים, ולא חשש כללי. מסלול הכשל, שורה-שורה:
//
//  1. `readOne` ב-`orderSource.ts` קורא `signatureForDomain(msg.dkimSignature)`.
//     אם אין כותרת חתימה → `sig.present === false` → `limit = null`.
//  2. `limitToSignedBody(body, null)` מחזיר את הגוף **כולו**, `bytesDropped = 0`.
//  3. `parseOrderMessage` רואה `unsignedBytes === 0`, ולכן **אין** ממצא
//     `unsignedBodyTail` — יש רק הערת `signatureScopeUnknown` בדרגת `warn`.
//  4. `needsHumanReview` נגזר מ-`severity === 'block'` בלבד → ההזמנה נכנסת
//     ל"עוד לא יצא" עם **כפתור העתקת כתובת**.
//
// כלומר: תוקף שהדביק טבלת הזמנה שנייה בסוף הודעה חתומה מקבל כרטיס תקין
// לגמרי. וכל 356 המבחנים נשארים ירוקים, כי כולם מזינים fixture שיש בו
// `dkimSignature` — הם בודקים את הלוגיקה, לא את מה שהוזן לה.
//
// **ולכן החוזה הזה הוא שער ולא ולידציה.** הוא לא מסמן, לא מדרג ולא מחזיר
// דגל שאפשר להתעלם ממנו: הודעה שהגיעה בלי גוף גולמי או בלי כותרת חתימה
// **לא הופכת ל-candidate בכלל.** אין ערך חלקי לזלוג ממנה הלאה.
//
// ---------------------------------------------------------------------------
// ★ ארבעת הדברים ששכבת השליפה חייבת להביא (README §3ב)
// ---------------------------------------------------------------------------
//  (א) `Authentication-Results` של גוגל — עליה עומד כל אימות המקור (B10).
//  (ב) כותרת/כותרות `DKIM-Signature` **כפי שהן** — משם `l=` ו-`h=`.
//  (ג) **הגוף הגולמי** — `l=` נמדד בבתים שלו, לא של חלק מפוענח.
//  (ד) `receivedAt` מ-`internalDate`, ולא מכותרת `Date` (שאינה חתומה).
//
// כל אחד מהארבעה הוא `throw` נפרד עם קוד משלו, ולא בדיקה אחת מאוחדת: כשזה
// ייפול בפרודקשן, ההבדל בין "גוגל החזירה פורמט אחר" לבין "לספק אין חתימה
// היום" הוא ההבדל בין תיקון של דקה לבין חקירה של יום.
//
// ---------------------------------------------------------------------------
// ★ למה זה יושב ב-`shared/` ולא ב-`functions/`
// ---------------------------------------------------------------------------
// כדי שהוא ייבדק ב-`npm test` של השורש, בלי ענן ובלי אמולטור. בקרה שאפשר
// להריץ רק אחרי deploy היא בקרה שלא רצה. `functions/src/lib/gmailFetch.ts`
// דק בכוונה: הוא קורא ל-API ומעביר לכאן.
// ============================================================================

import type { OrderSourceCandidate } from './orderSource';
import { isOrderSender } from './orderParse';

/**
 * ★★ הפורמט שנדרש מ-`users.messages.get`. **`raw` ותו לא.**
 *
 * `full` מחזיר `payload` עם חלקים מפוענחים ו-`headers` — כלומר גוף שאפשר
 * לקרוא ממנו, וכותרות שאפשר לקרוא מהן. הוא נראה עשיר יותר, והוא **בדיוק
 * הפורמט שמשתיק את החיתוך**: הבתים שהוא מחזיר אינם הבתים שנחתמו.
 *
 * `metadata` מחזיר כותרות בלי גוף, ו-`minimal` בלי שניהם.
 *
 * הקבוע מיוצא כדי שאתר הקריאה יעביר **אותו** ולא מחרוזת משלו, ו-
 * `scripts/check-gmail-fetch.mjs` מוודא שזה מה שקורה בפועל.
 */
export const GMAIL_MESSAGE_FORMAT = 'raw' as const;

/** הכותרות שחייבות להגיע. היעדר כל אחת מהן הוא כשל, לא "אין מידע". */
export const REQUIRED_HEADERS = ['DKIM-Signature', 'Authentication-Results'] as const;

export type FetchContractCode =
  /** חזרה תשובה עם `payload` ובלי `raw` — כלומר הפורמט שהתבקש לא היה `raw`. */
  | 'formatNotRaw'
  /** אין `raw`, ואין גם `payload`. תשובה ריקה או `minimal`. */
  | 'rawBodyMissing'
  /** ה-base64url לא נפתח. הודעה פגומה, או קידוד לא צפוי. */
  | 'rawBodyUndecodable'
  /** ★★ אין כותרת `DKIM-Signature`. **בלעדיה אין `l=` ואין חיתוך.** */
  | 'dkimSignatureHeaderMissing'
  /** אין `Authentication-Results`. בלעדיה אין אימות מקור בכלל (B10). */
  | 'authResultsHeaderMissing'
  /** אין `internalDate` — כלומר אין זמן קליטה, רק כותרת `Date` שאינה חתומה. */
  | 'internalDateMissing'
  /** אין הפרדת כותרות/גוף, כלומר אין גוף. */
  | 'bodySeparatorMissing'
  /** ★★ ההודעה לא מכתובת הסליקה. הגוף שלה **לא נשלף כלל**. */
  | 'senderMismatch';

/**
 * ★ ההודעה בעברית לכל קוד.
 *
 * היא מיועדת ל**רונן**, לא לדורית: כשהחוזה נשבר אין מה שדורית יכולה לעשות,
 * והמסך שלה יגיד לה רק "לא הצלחתי לקרוא הזמנות הבוקר". הטקסט כאן נשמר
 * ב-`syncRuns`, בלי שום פרט מההודעה עצמה.
 */
export const FETCH_CONTRACT_MESSAGES_HE: Record<FetchContractCode, string> = {
  formatNotRaw:
    'גוגל החזירה הודעה מפוענחת ולא גוף גולמי. בפורמט הזה אי אפשר למדוד את l= של החתימה, ולכן חיתוך הזנב הלא-חתום לא היה מתבצע. עצרתי.',
  rawBodyMissing: 'ההודעה חזרה בלי גוף כלל. לא ניסיתי לקרוא ממנה דבר.',
  rawBodyUndecodable: 'לא הצלחתי לפתוח את הגוף הגולמי של ההודעה.',
  dkimSignatureHeaderMissing:
    'להודעה אין כותרת DKIM-Signature. בלעדיה אי אפשר לדעת איזה חלק מהגוף חתום, כלומר תוספת שנוספה אחרי החתימה הייתה נקראת כאילו היא חלק מההזמנה. עצרתי.',
  authResultsHeaderMissing:
    'להודעה אין כותרת Authentication-Results של גוגל. בלעדיה אין על מה לבסס את אימות השולח.',
  internalDateMissing:
    'להודעה אין internalDate. תאריך מכותרת Date אינו חתום ואינו קביל כאן.',
  bodySeparatorMissing: 'ההודעה הגולמית אינה מפרידה בין כותרות לגוף.',
  senderMismatch:
    'ההודעה לא הגיעה מכתובת הסליקה. לא שלפתי ממנה גוף ולא קראתי ממנה דבר.',
};

/**
 * ★ שגיאת חוזה.
 *
 * **בלי שדה `details` ובלי צירוף ההודעה.** זה בדיוק הלקח מ-`FriendlyError`:
 * האובייקט שהיה נוח לצרף "למי שיתקן" הוא ההודעה שגרמה לתקלה, והיא מכילה
 * כתובת מגורים. מה שנשמר הוא הקוד, המשפט, ו-`messageId` — שהוא מזהה של
 * גוגל, לא תוכן.
 */
export class FetchContractError extends Error {
  readonly code: FetchContractCode;
  readonly messageHe: string;
  readonly messageId: string | null;

  constructor(code: FetchContractCode, messageId: string | null = null) {
    super(code);
    this.name = 'FetchContractError';
    this.code = code;
    this.messageHe = FETCH_CONTRACT_MESSAGES_HE[code];
    this.messageId = messageId;
  }
}

/**
 * התשובה של `users.messages.get`, בשדות שאנחנו נוגעים בהם.
 *
 * `payload` מוגדר כ-`unknown` ולא כמבנה: אנחנו **לא** קוראים ממנו שום דבר,
 * והוא קיים בטיפוס רק כדי שנוכל לזהות שהתקבל הפורמט הלא נכון. טיפוס מלא
 * היה הזמנה לקרוא ממנו "רק את הכותרות".
 */
export interface GmailRawMessage {
  id?: string | null;
  threadId?: string | null;
  /** מילישניות מאז epoch, כמחרוזת. זמן הקליטה אצל גוגל. */
  internalDate?: string | null;
  /** ★★ ההודעה המלאה כ-base64url. זה מה שאנחנו רוצים. */
  raw?: string | null;
  /** ★ נוכחותו בלי `raw` = הפורמט שהתבקש לא היה `raw`. לא נקרא ממנו דבר. */
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// פענוח וקריאת כותרות
// ---------------------------------------------------------------------------

function decodeBase64Url(raw: string): string | null {
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    // `Buffer` קיים ב-Node (Functions) וב-vitest. הקובץ הזה לא נכנס לגרף
    // הבנייה של הדפדפן — ראה `scripts/check-no-model.mjs`, שמוודא זאת.
    const bytes = Buffer.from(padded, 'base64');
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * ★ פיצול הודעת RFC 822 לכותרות ולגוף, **בשורה הריקה הראשונה**.
 *
 * הגבול הזה הוא בדיוק הגבול שעליו `l=` נמדד: תג האורך בחתימה סופר בתים של
 * ה**גוף**, מהתו הראשון שאחרי השורה הריקה. חישוב שיכלול את הכותרות היה
 * חותך במקום הלא נכון — כלומר משאיר יותר ממה שנחתם, בדיוק בכיוון המסוכן.
 *
 * `\r\n\r\n` הוא הגבול התקני. נפילה אחורה ל-`\n\n` קיימת כי חלק מהמערכות
 * מנרמלות שורות בדרך, ובלעדיה הודעה תקינה לגמרי הייתה נדחית.
 */
function splitHeadersAndBody(rfc822: string): { headers: string; body: string } | null {
  const crlf = rfc822.indexOf('\r\n\r\n');
  if (crlf >= 0) {
    return { headers: rfc822.slice(0, crlf), body: rfc822.slice(crlf + 4) };
  }
  const lf = rfc822.indexOf('\n\n');
  if (lf >= 0) {
    return { headers: rfc822.slice(0, lf), body: rfc822.slice(lf + 2) };
  }
  return null;
}

/**
 * כל הערכים של כותרת אחת, **אחרי unfold** ובסדר שבו הופיעו.
 *
 * מחזיר מערך ולא ערך יחיד כי `DKIM-Signature` מופיעה לגיטימית יותר מפעם
 * אחת (ספק + מתווך). `signatureForDomain` הוא זה שבוחר את הרלוונטית.
 */
export function readHeader(headerBlock: string, name: string): string[] {
  const lines = headerBlock.split(/\r?\n/);
  const target = name.toLowerCase();
  const out: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    // המשך של כותרת מתקפלת: מתחיל ברווח או טאב.
    if (/^[ \t]/.test(line)) {
      if (current !== null) current += ' ' + line.trim();
      continue;
    }
    if (current !== null) {
      out.push(current);
      current = null;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    if (line.slice(0, colon).trim().toLowerCase() === target) {
      current = line.slice(colon + 1).trim();
    }
  }
  if (current !== null) out.push(current);
  return out;
}

/** כתובת מתוך `From: "שם" <a@b>`. שם התצוגה מוחזר בנפרד — ואינו ראיה. */
function parseFrom(raw: string): { address: string; name?: string } {
  const angle = raw.match(/<([^>]*)>/);
  if (angle) {
    const name = raw.slice(0, raw.indexOf('<')).trim().replace(/^"|"$/g, '');
    return { address: angle[1].trim(), name: name || undefined };
  }
  return { address: raw.trim() };
}

// ---------------------------------------------------------------------------
// ★★ השער
// ---------------------------------------------------------------------------

/**
 * ★★ ממירה תשובת Gmail ל-candidate — **או זורקת**.
 *
 * אין מסלול שלישי. אין "candidate חלקי", אין `degraded: true`, ואין ערך
 * החזרה שאפשר לבדוק ולשכוח לבדוק. זו ההחלטה המרכזית בקובץ: כל מנגנון שמחזיר
 * דגל מסתמך על כך שמישהו יקרא אותו, ובדיוק זה מה שהסקירה מכנה "הצהרה בלי
 * מנגנון".
 *
 * שים לב לסדר הבדיקות — הוא לא שרירותי:
 *   1. פורמט (יש בכלל גוף גולמי?)
 *   2. `internalDate` (יש זמן קליטה שאפשר לסמוך עליו?)
 *   3. פענוח והפרדה
 *   4. ★★ `DKIM-Signature` — **לפני** שהגוף נכנס לאובייקט המוחזר
 *   5. `Authentication-Results`
 *
 * הגוף נכתב לאובייקט רק אחרי ששלב 4 עבר. זה אותו עיקרון בדיוק כמו
 * `readOrderBodies`, שבודק את השולח **לפני** שהוא ניגש לשדה: ערך שכבר נשלף
 * למשתנה הוא ערך שה-refactor הבא יעביר הלאה.
 */
export function gmailMessageToCandidate(msg: GmailRawMessage): OrderSourceCandidate {
  const id = typeof msg.id === 'string' && msg.id.length > 0 ? msg.id : null;

  // --- 1. ★★ פורמט. ---------------------------------------------------------
  const raw = typeof msg.raw === 'string' ? msg.raw : '';
  if (raw.length === 0) {
    throw new FetchContractError(
      msg.payload !== undefined && msg.payload !== null ? 'formatNotRaw' : 'rawBodyMissing',
      id,
    );
  }

  // --- 2. זמן הקליטה. -------------------------------------------------------
  const internal = typeof msg.internalDate === 'string' ? msg.internalDate.trim() : '';
  const internalMs = Number(internal);
  if (internal.length === 0 || !Number.isFinite(internalMs)) {
    throw new FetchContractError('internalDateMissing', id);
  }

  // --- 3. פענוח והפרדה. -----------------------------------------------------
  const rfc822 = decodeBase64Url(raw);
  if (rfc822 === null || rfc822.length === 0) {
    throw new FetchContractError('rawBodyUndecodable', id);
  }
  const split = splitHeadersAndBody(rfc822);
  if (split === null) {
    throw new FetchContractError('bodySeparatorMissing', id);
  }

  // --- 3ב. ★★ השולח — **לפני שהגוף נכנס לאובייקט כלשהו.** -----------------
  //
  // ---------------------------------------------------------------------------
  // למה כאן ולא רק ב-`readOrderBodies`
  // ---------------------------------------------------------------------------
  // `readOrderBodies` בודק שולח לפני שהוא **קורא** גוף, וזה נכון ומספיק
  // לצינור המקומי, שבו ההודעות כבר בזיכרון מקובץ. בענן זה לא מספיק: כאן
  // אנחנו אלה ש**מייצרים** את הגוף — מפענחים base64 של הודעה שלמה ושמים
  // אותה במחרוזת. הודעה משולח אחר שתגיע לכאן תיווצר במלואה בזיכרון של
  // הפונקציה, ורק אחר כך תסורב.
  //
  // השאילתה קבועה ל-`from:` של הספק, ולכן זה לא אמור לקרות — **ו"לא אמור
  // לקרות" הוא בדיוק הביטוי שנתפסנו עליו פעמיים בפרויקט הזה.** כאן זה עולה
  // שתי שורות: מי שלא מכתובת הסליקה, הגוף שלו לא נשלף.
  //
  // ★ ההערכה מתבצעת על `From` הגולמי, וזו אינה בדיקת אבטחה — `From` ניתן
  // לזיוף. זו בדיקת **היקף קריאה** (B12): היא לא קובעת שההודעה אמיתית, היא
  // קובעת שלא נגענו במה שלא ביקשנו. האימות האמיתי הוא ה-DKIM, בפרסר.
  const from = parseFrom(readHeader(split.headers, 'From')[0] ?? '');
  if (!isOrderSender(from.address)) {
    throw new FetchContractError('senderMismatch', id);
  }

  // --- 4. ★★ כותרת החתימה. ה**בדיקה שכל הפרוסה הזאת עומדת עליה.** ----------
  const dkimSignature = readHeader(split.headers, 'DKIM-Signature');
  if (dkimSignature.length === 0) {
    throw new FetchContractError('dkimSignatureHeaderMissing', id);
  }

  // --- 5. תוצאת האימות של גוגל. --------------------------------------------
  const authResults = readHeader(split.headers, 'Authentication-Results');
  if (authResults.length === 0) {
    throw new FetchContractError('authResultsHeaderMissing', id);
  }

  return {
    messageId: id ?? '',
    threadId: typeof msg.threadId === 'string' ? msg.threadId : (id ?? ''),
    fromAddress: from.address,
    ...(from.name ? { fromName: from.name } : {}),
    // ★ הנושא מועבר **כפי שהוא**, מקודד. `normalizeSubject` בפרסר מפענח
    // RFC 2047 בעצמו — ופענוח כאן היה יוצר נקודה שנייה שבה נושא מנורמל,
    // כלומר שתי הגדרות ל"מהו הנושא הקבוע".
    subject: readHeader(split.headers, 'Subject')[0] ?? '',
    // ★★ (ד) זמן הקליטה, מ-`internalDate`. **לא** מכותרת `Date`.
    receivedAt: new Date(internalMs).toISOString(),
    // ★★ (ג) הגוף הגולמי, כפי שהוא על החוט. זה מה ש-`l=` נמדד עליו.
    bodyRaw: split.body,
    // ★★ (א) ו-(ב).
    authenticationResults: authResults.join('; '),
    dkimSignature,
  };
}

/**
 * ★ בדיקה שאפשר להריץ על candidate שכבר נבנה — לשימוש בשכבת הסנכרון,
 * **כרשת שנייה ולא כתחליף**.
 *
 * למה בכלל שנייה: `gmailMessageToCandidate` מגן על המסלול שעובר דרכו. אם
 * מישהו יוסיף מסלול שני — מטמון, ייבוא, "בדיקה מהירה מול קובץ" — הוא לא
 * יעבור דרכו. הפונקציה הזאת יושבת ב-`syncOrders` ממש לפני הכתיבה, ותופסת
 * גם את המסלול שעוד לא נכתב.
 *
 * מחזירה `null` כשהכול תקין, או קוד. **הקורא חייב לעצור** — ראה
 * `assertCandidateComplete`.
 */
export function candidateContractViolation(
  candidate: Partial<OrderSourceCandidate>,
): FetchContractCode | null {
  const rawBody = candidate.bodyRaw;
  if (typeof rawBody !== 'string' || rawBody.length === 0) return 'rawBodyMissing';

  const sig = candidate.dkimSignature;
  const hasSignature =
    typeof sig === 'string' ? sig.trim().length > 0 : Array.isArray(sig) && sig.length > 0;
  if (!hasSignature) return 'dkimSignatureHeaderMissing';

  const auth = candidate.authenticationResults;
  if (typeof auth !== 'string' || auth.trim().length === 0) return 'authResultsHeaderMissing';

  if (typeof candidate.receivedAt !== 'string' || candidate.receivedAt.length === 0) {
    return 'internalDateMissing';
  }
  return null;
}

/** גרסת ה-throw של הבדיקה. זו שנקראת בקוד — כדי שאי אפשר יהיה להתעלם. */
export function assertCandidateComplete(candidate: Partial<OrderSourceCandidate>): void {
  const violation = candidateContractViolation(candidate);
  if (violation !== null) {
    throw new FetchContractError(violation, candidate.messageId ?? null);
  }
}
