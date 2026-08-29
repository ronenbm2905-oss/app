// ============================================================================
// cloudGuards.test.ts — שלוש הבקרות של שכבת הענן, כמבחן ולא רק כ-CI.
//
//   1. ה-scopes          — scope אחד, ואין שני.
//   2. `invalid_grant`   — המצב היחיד שדורש פעולה מדורית.
//   3. הצפנת הטוקן       — AES-256-GCM, ופענוח שמסרב במקום להחזיר זבל.
//
// ---------------------------------------------------------------------------
// למה גם מבחן וגם `scripts/check-*.mjs`
// ---------------------------------------------------------------------------
// אותו נימוק שכתוב ב-README על `check-no-model`: *"בקרה שקיימת בצינור אחד
// בלבד היא בקרה שאפשר לעקוף בטעות."* `npm run build` מריץ את הסקריפטים;
// `npm test` מריץ את זה. מי שירוץ רק אחד מהשניים עדיין ייתפס.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  AUTHORIZATION_SCOPES,
  FORBIDDEN_SCOPE_MARKERS,
  GMAIL_SCOPES,
  SCOPE_DESCRIPTION_HE,
  SCOPE_PARAM,
} from '../shared/lib/googleScopes';
import {
  connectionMessageHe,
  connectionStateAfterError,
  CONNECTION_EXPIRED_HE,
  INVALID_GRANT,
  isInvalidGrant,
  needsUserAction,
} from '../shared/lib/googleConnection';
import {
  decryptToken,
  encryptToken,
  newOAuthState,
  parseKey,
  TokenCryptoError,
} from '../shared/lib/tokenCrypto';

// ---------------------------------------------------------------------------

describe('★★ ההרשאות — scope אחד, ואין שני', () => {
  it('gmail.readonly בלבד', () => {
    expect(GMAIL_SCOPES).toEqual(['https://www.googleapis.com/auth/gmail.readonly']);
    expect(GMAIL_SCOPES).toHaveLength(1);
  });

  it('★★ אין gmail.modify, compose, send, labels — ולא Calendar ולא Drive', () => {
    const joined = [...GMAIL_SCOPES, ...AUTHORIZATION_SCOPES, SCOPE_PARAM].join(' ');
    for (const marker of FORBIDDEN_SCOPE_MARKERS) {
      expect(joined).not.toContain(marker);
    }
  });

  it('רשימת ההרשאה זהה לרשימת ה-scopes — אין "עוד אחד רק לזהות"', () => {
    // ★ לא `openid`/`email`/`profile`: הזהות נקבעת ב-Firebase Auth, בזרימה
    // אחרת לגמרי, ובאסימון שלה אין גישה ל-Gmail.
    expect(AUTHORIZATION_SCOPES).toEqual([...GMAIL_SCOPES]);
    expect(SCOPE_PARAM).toBe(GMAIL_SCOPES[0]);
  });

  it('התיאור לדורית אומר שאי אפשר לשלוח ולא למחוק', () => {
    expect(SCOPE_DESCRIPTION_HE).toContain('קריאה בלבד');
    expect(SCOPE_DESCRIPTION_HE).toContain('לשלוח');
  });
});

describe('★★ invalid_grant — המצב היחיד שדורש לחיצה שלה', () => {
  it('נתפס מ-`error` ישיר', () => {
    expect(isInvalidGrant({ error: INVALID_GRANT })).toBe(true);
  });

  it('נתפס מתוך `response.data.error` (הצורה של googleapis)', () => {
    expect(isInvalidGrant({ response: { data: { error: 'invalid_grant' } } })).toBe(true);
  });

  it('נתפס מתוך הודעת שגיאה', () => {
    expect(isInvalidGrant(new Error('invalid_grant: Token has been expired or revoked.'))).toBe(
      true,
    );
  });

  it('★★ `invalid_client` **אינו** invalid_grant — הוא תקלת קונפיג של רונן', () => {
    // חיבור מחדש לא יפתור אותו, ולכן אסור לשלוח את דורית ללחוץ.
    expect(isInvalidGrant({ error: 'invalid_client' })).toBe(false);
    expect(isInvalidGrant(new Error('invalid_client'))).toBe(false);
  });

  it('★ `invalid_grant_type` אינו נתפס — גבול מילה, לא `includes`', () => {
    expect(isInvalidGrant(new Error('invalid_grant_type'))).toBe(false);
  });

  it('שגיאת רשת אינה מייצרת "החיבור פג"', () => {
    expect(connectionStateAfterError(new Error('fetch failed'))).toBe('error');
    expect(connectionStateAfterError({ error: INVALID_GRANT })).toBe('expired');
  });

  it('★★ הבאנר אומר "שום דבר לא נמחק" — וזה החלק שמונע ממנה להעתיק הכול לפנקס', () => {
    expect(CONNECTION_EXPIRED_HE).toContain('שום דבר לא נמחק');
    expect(CONNECTION_EXPIRED_HE).toContain('להתחבר מחדש');
  });

  it('רק expired ו-disconnected דורשים פעולה', () => {
    expect(needsUserAction('expired')).toBe(true);
    expect(needsUserAction('disconnected')).toBe(true);
    expect(needsUserAction('error')).toBe(false);
    expect(needsUserAction('connected')).toBe(false);
  });

  it('מצב תקין אינו מייצר הודעה', () => {
    expect(connectionMessageHe('connected')).toBeNull();
    expect(connectionMessageHe('error')).toContain('אין מה לעשות מצדך');
  });
});

describe('★ הצפנת ה-refresh token', () => {
  // 32 בתים, base64.
  const KEY_B64 = Buffer.alloc(32, 7).toString('base64');
  const key = parseKey(KEY_B64);

  it('הלוך ושוב', () => {
    const envelope = encryptToken('1//refresh-token-value', key, 'uid-1');
    expect(decryptToken(envelope, key, 'uid-1')).toBe('1//refresh-token-value');
  });

  it('הטוקן אינו מופיע ב-envelope', () => {
    const envelope = encryptToken('1//secret-value', key, 'uid-1');
    expect(envelope).not.toContain('secret-value');
    expect(envelope.startsWith('v1.')).toBe(true);
  });

  it('שתי הצפנות של אותו ערך שונות זו מזו (IV אקראי)', () => {
    expect(encryptToken('x', key, 'u')).not.toBe(encryptToken('x', key, 'u'));
  });

  it('★★ מסמך שהועתק למשתמש אחר לא נפתח (ה-AAD הוא ה-uid)', () => {
    const envelope = encryptToken('1//secret', key, 'uid-1');
    expect(() => decryptToken(envelope, key, 'uid-2')).toThrowError(TokenCryptoError);
  });

  it('★★ ciphertext שהשתנה **נכשל** ולא מחזיר זבל', () => {
    // זו הסיבה ל-GCM: פענוח שמחזיר זבל היה נשלח לגוגל, חוזר `invalid_grant`,
    // והמערכת הייתה מסיקה "החיבור פג" — כלומר שיבוש שקט מתחזה למצב תקין.
    const envelope = encryptToken('1//secret', key, 'uid-1');
    const parts = envelope.split('.');
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('zzzz').toString('base64')].join(
      '.',
    );
    expect(() => decryptToken(tampered, key, 'uid-1')).toThrowError(TokenCryptoError);
  });

  it('מפתח באורך שגוי נדחה', () => {
    expect(() => parseKey(Buffer.alloc(16).toString('base64'))).toThrowError(TokenCryptoError);
    expect(() => parseKey('')).toThrowError(TokenCryptoError);
    expect(() => parseKey(null)).toThrowError(TokenCryptoError);
  });

  it('envelope בגרסה לא מוכרת נדחה', () => {
    expect(() => decryptToken('v9.a.b.c', key, 'u')).toThrowError(TokenCryptoError);
    expect(() => decryptToken('לא-envelope', key, 'u')).toThrowError(TokenCryptoError);
  });

  it('★ ה-state אקראי ובאורך סביר', () => {
    const a = newOAuthState();
    const b = newOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });
});
