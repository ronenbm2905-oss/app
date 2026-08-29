// ============================================================================
// senderLedger.test.ts — ★ המבחן שסוגר את הדליפה מבפנים.
//
// הטענה שנבדקת כאן היא לא על הפנקס אלא על **הארכוב**: הכלל "רק המסנן
// הדטרמיניסטי מארכב, לא המודל" תקף רק כל עוד אי אפשר להזין את הפנקס מפלט
// מודל. אחרת המודל מארכב בעקיפין, בעיכוב של ריצה אחת, ובלי שאף מבחן על
// `triageFilter` יבחין.
//
// לכן המבחנים כאן בודקים דבר לא רגיל: **מה אי אפשר להעביר לפונקציה.**
// ============================================================================

import { describe, expect, it } from 'vitest';
import { applyLedgerEvidence, ledgerVerdictMayArchive } from '../frozen/lib/senderLedger';
import type { MessageMeta, SenderLedgerEntry } from '../frozen/types';

const USER = 'local-single-user';

function msg(over: Partial<MessageMeta> = {}): MessageMeta {
  return {
    messageId: 'm-1',
    threadId: 't-1',
    fromAddress: 'campaign@shivuk-express.example',
    fromName: 'שיווק',
    subject: 'מבצע',
    receivedAt: '2026-08-25T08:00:00+03:00',
    ...over,
  };
}

function entry(over: Partial<SenderLedgerEntry> = {}): SenderLedgerEntry {
  return {
    userId: USER,
    domainKey: 'shivuk-express.example',
    defaultVerdict: 'unknown',
    verdictSource: 'header',
    neverAutoNoise: false,
    invoiceSource: false,
    messageCount: 3,
    repliedCount: 0,
    lastSeenAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

describe('★ שני מקורות, ואין שלישי', () => {
  it('ראיה מכותרות קובעת רעש — וזה מותר', () => {
    const { entry: next } = applyLedgerEvidence(
      undefined,
      { source: 'header', message: msg({ listUnsubscribe: '<https://x.example/u>' }) },
      USER,
    );
    expect(next.defaultVerdict).toBe('noise');
    expect(next.verdictSource).toBe('header');
    expect(ledgerVerdictMayArchive(next)).toBe(true);
  });

  it('מייל בלי כותרות דיוור לא מזיז את הפסק', () => {
    const { entry: next } = applyLedgerEvidence(entry(), { source: 'header', message: msg() }, USER);
    expect(next.defaultVerdict).toBe('unknown');
    // אבל המונה כן עולה — למידה על נפח מותרת, למידה על פסק דין לא.
    expect(next.messageCount).toBe(4);
  });

  it('הכרעה של המשתמשת נרשמת כ-`user`', () => {
    const { entry: next } = applyLedgerEvidence(
      undefined,
      { source: 'user', verdict: 'signal', domainKey: 'sapak.example' },
      USER,
    );
    expect(next.verdictSource).toBe('user');
    expect(next.defaultVerdict).toBe('signal');
  });

  it('★ הכרעת משתמשת לא נשחקת בלמידה אוטומטית', () => {
    // אחרת כל החלטה מפורשת שלה נמחקת תוך שבוע, והיא מפסיקה לסמוך על הכלי.
    const pinned = entry({ defaultVerdict: 'signal', verdictSource: 'user' });
    const { entry: next } = applyLedgerEvidence(
      pinned,
      { source: 'header', message: msg({ listUnsubscribe: '<https://x.example/u>' }) },
      USER,
    );
    expect(next.defaultVerdict).toBe('signal');
    expect(next.verdictSource).toBe('user');
  });

  it('★ אין דרך להעביר פלט מודל לפונקציה', () => {
    // המבחן האמיתי הוא בקומפיילר: `LedgerEvidence` הוא union של שני ענפים,
    // ולאף אחד מהם אין שדה שמייצג פסיקת מודל. השורה למטה מתעדת את הטענה
    // בצורה שאפשר להריץ: כל מקור שנוצר הוא אחד משניים.
    const fromHeader = applyLedgerEvidence(undefined, { source: 'header', message: msg() }, USER);
    const fromUser = applyLedgerEvidence(
      undefined,
      { source: 'user', verdict: 'noise', domainKey: 'x.example' },
      USER,
    );
    for (const r of [fromHeader, fromUser]) {
      expect(['header', 'user']).toContain(r.entry.verdictSource);
    }
  });

  it('כל עדכון מגיע עם הסבר קריא', () => {
    const r = applyLedgerEvidence(
      undefined,
      { source: 'header', message: msg({ precedence: 'bulk' }) },
      USER,
    );
    expect(r.changeHe).toContain('דיוור המוני');
    expect(r.changeHe).not.toMatch(/noise|verdict/i);
  });
});

describe('שער הארכוב', () => {
  it('פסק ממקור כותרות או משתמשת — מותר לארכב לפיו', () => {
    expect(ledgerVerdictMayArchive(entry({ verdictSource: 'header' }))).toBe(true);
    expect(ledgerVerdictMayArchive(entry({ verdictSource: 'user' }))).toBe(true);
  });

  it('אין רשומה — הפסק לא הגיע מהפנקס, ואין מה לחסום', () => {
    expect(ledgerVerdictMayArchive(undefined)).toBe(true);
  });

  it('★ מקור שאינו ברשימה — נחסם', () => {
    // מצב שלא אמור להתקיים. בדיוק בגלל זה יש עליו בדיקה: אם הוא כן קורה,
    // הסיבה הסבירה היחידה היא שמישהו כתב לפנקס ממקום שלא היה אמור.
    const tampered = { ...entry(), verdictSource: 'model' } as unknown as SenderLedgerEntry;
    expect(ledgerVerdictMayArchive(tampered)).toBe(false);
  });
});
