// ============================================================================
// tokenCrypto.ts — הצפנת ה-refresh token. AES-256-GCM.
//
// ---------------------------------------------------------------------------
// מה בדיוק מוגן כאן, ומה לא
// ---------------------------------------------------------------------------
// ה-refresh token הוא **המפתח לתיבה של דורית**. הוא לא פג, הוא מספיק לבדו
// כדי להנפיק access token, ומי שמחזיק בו קורא את כל התיבה בלי לעבור בשום
// מסך. זה הפריט הרגיש ביותר במסד כולו — רגיש יותר מכל כתובת מגורים, כי הוא
// נותן גישה למקור ולא לעותק.
//
// **ומה שההצפנה הזאת לא עושה, כדי שלא ניתלה בה יותר מדי:** המפתח יושב
// ב-Secret Manager ונגיש לאותו קוד שקורא את המסמך. תוקף שהריץ קוד בתוך
// ה-Function מפענח בשורה אחת. מה שההצפנה כן מונעת: דליפת המסד לבדה
// (גיבוי, ייצוא, קונסולה, `collectionGroup` בטעות) אינה מספיקה כדי לקרוא
// את התיבה. זו הפרדה אמיתית בין שני משטחי תקיפה, וזה כל מה שהיא.
//
// ★ ההגנה האמיתית על השדה הזה היא `firestore.rules` עם `if false` מוחלט,
// **ו**מודול הגישה היחיד (`functions/src/lib/tokenStore.ts`). ההצפנה היא
// השכבה השלישית, לא הראשונה.
//
// ---------------------------------------------------------------------------
// למה GCM ולא CBC
// ---------------------------------------------------------------------------
// GCM הוא AEAD: הוא מייצר תג אימות, ופענוח של טקסט שהשתנה **נכשל** במקום
// להחזיר זבל. במקרה שלנו זה לא ניואנס — טוקן שפוענח שגוי היה נשלח לגוגל,
// שהייתה מחזירה `invalid_grant`, והמערכת הייתה מסיקה "החיבור פג" ומבקשת
// מדורית להתחבר מחדש. כלומר שיבוש שקט במסד היה מתחזה למצב תקין לגמרי.
//
// ה-AAD (`additional authenticated data`) הוא ה-`uid`. משמעותו: העתקת מסמך
// טוקן ממשתמש אחד לאחר **נכשלת בפענוח**. במוצר עם משתמשת אחת זה תיאורטי;
// הוא בפנים כי הוא עולה שורה אחת, וכי המבנה כבר בנוי ל-`users/{uid}`.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
/** 12 בתים — האורך המומלץ ל-GCM. */
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** גרסת סכימה בתוך המחרוזת עצמה, כדי שהחלפת אלגוריתם לא תדרוש ניחוש. */
const ENVELOPE_VERSION = 'v1';

export class TokenCryptoError extends Error {
  readonly code: 'badKey' | 'badEnvelope' | 'decryptFailed';
  constructor(code: 'badKey' | 'badEnvelope' | 'decryptFailed') {
    super(code);
    this.name = 'TokenCryptoError';
    this.code = code;
  }
}

/**
 * ★ המפתח מגיע כ-base64 של 32 בתים.
 *
 * **לא** מחרוזת סיסמה עם hash: מפתח שנגזר מסיסמה שאדם בחר הוא מפתח חלש
 * שנראה חזק, וזו בדיוק הצורה שבה הצפנה הופכת לקישוט. `TOKEN_ENC_KEY` נוצר
 * ב-`openssl rand -base64 32` — ראה README.
 */
export function parseKey(raw: string | null | undefined): Buffer {
  const value = String(raw ?? '').trim();
  if (value.length === 0) throw new TokenCryptoError('badKey');
  let key: Buffer;
  try {
    key = Buffer.from(value, 'base64');
  } catch {
    throw new TokenCryptoError('badKey');
  }
  if (key.length !== KEY_BYTES) throw new TokenCryptoError('badKey');
  return key;
}

/**
 * מצפינה טוקן. הפלט הוא מחרוזת אחת שנשמרת כמות שהיא:
 * `v1.<iv>.<tag>.<ciphertext>`, כל חלק ב-base64.
 *
 * מחרוזת אחת ולא שלושה שדות במסמך, כדי שאי אפשר יהיה לכתוב מסמך עם ciphertext
 * חדש ו-iv ישן. ה-envelope הוא יחידה אחת שנכתבת יחד או לא נכתבת.
 */
export function encryptToken(plaintext: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

/**
 * מפענחת. **זורקת** על כל סטייה — גרסה לא מוכרת, אורך שגוי, תג שלא מתאים.
 *
 * אין כאן `try/catch` שמחזיר `null`: קורא שמקבל `null` יכול להמשיך בטעות
 * למסלול "אין טוקן, בקשי חיבור מחדש", וזה בדיוק המסלול שמוחק את החיבור
 * במקום לדווח על תקלה.
 */
export function decryptToken(envelope: string, key: Buffer, aad: string): string {
  const parts = String(envelope ?? '').split('.');
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new TokenCryptoError('badEnvelope');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new TokenCryptoError('badEnvelope');
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new TokenCryptoError('decryptFailed');
  }
}

/**
 * ★ `state` לזרימת ההרשאה — 32 בתים אקראיים, base64url.
 *
 * `randomBytes` ולא `Math.random`: ה-`state` הוא ההגנה היחידה מפני CSRF
 * בזרימת ה-OAuth. ערך שאפשר לנחש פירושו שתוקף יכול לגרום לדפדפן של דורית
 * לסיים זרימת הרשאה שהוא התחיל, כלומר לקשור **את החשבון שלו** לחיבור שלה.
 */
export function newOAuthState(): string {
  return randomBytes(32).toString('base64url');
}
