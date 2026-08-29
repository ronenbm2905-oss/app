// ============================================================================
// supportMode.test.ts — ★★ B3′. המתג, הפקיעה, והיומן שדורית רואה.
//
// מה שנבדק כאן הוא לא "האם הפונקציה מחזירה ערך" אלא שלוש טענות שהמנגנון
// כולו עומד עליהן:
//   1. הוא **פג מעצמו**, ולא תלוי בתהליך שיכבה אותו.
//   2. הפקיעה היא בסוף היום **בשעון שלה**, לא ב-UTC.
//   3. הרשומה שנשמרת היא **שדות**, והעברית **נגזרת** מהם — לא להפך.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  describeAccessEntryHe,
  enableSupportMode,
  isSupportModeActive,
  SUPPORT_MODE_BANNER_HE,
  SUPPORT_MODE_OFF,
  supportModeExpiryFor,
  type AccessLogEntry,
} from '../shared/lib/supportMode';

const entry = (over: Partial<AccessLogEntry> = {}): AccessLogEntry => ({
  id: 'e1',
  at: '2026-09-03T11:20:00.000Z', // 14:20 בישראל
  actor: 'holder',
  action: 'orderContentOpened',
  targetKind: 'order',
  targetCount: 1,
  sourceMessageId: 'msg-1',
  ...over,
});

describe('★★ המתג פג מעצמו', () => {
  it('כבוי כברירת מחדל — ולא "דלוק עד שיכבו"', () => {
    expect(isSupportModeActive(SUPPORT_MODE_OFF)).toBe(false);
    expect(isSupportModeActive(null)).toBe(false);
    expect(isSupportModeActive(undefined)).toBe(false);
  });

  it('דלוק אחרי הדלקה', () => {
    const now = new Date('2026-09-03T11:00:00.000Z');
    const state = enableSupportMode(now);
    expect(isSupportModeActive(state, now)).toBe(true);
  });

  it('★★ הדגל נשאר `enabled: true` — והבדיקה מחזירה false אחרי הפקיעה', () => {
    const now = new Date('2026-09-03T11:00:00.000Z');
    const state = enableSupportMode(now);

    // אחרי חצות בישראל.
    const tomorrow = new Date('2026-09-04T05:00:00.000Z');

    // ★★ זו כל הנקודה: הדגל **עדיין** true, כי אף תהליך לא כיבה אותו.
    // אילו הבדיקה הייתה `state.enabled`, הגישה הייתה נשארת פתוחה —
    // בדיוק צורת הכשל של `purgeAfter` שנכתב ואיש לא קרא.
    expect(state.enabled).toBe(true);
    expect(isSupportModeActive(state, tomorrow)).toBe(false);
  });

  it('מצב עם `enabled: true` ובלי `expiresAt` נחשב כבוי', () => {
    expect(isSupportModeActive({ enabled: true, expiresAt: null, enabledAt: null })).toBe(false);
  });

  it('`expiresAt` פגום נחשב כבוי — הכיוון הבטוח', () => {
    expect(
      isSupportModeActive({ enabled: true, expiresAt: 'לא-תאריך', enabledAt: null }),
    ).toBe(false);
  });
});

describe('★ הפקיעה בשעון ישראל', () => {
  it('הדלקה בצהריים פגה באותו לילה, לא כעבור 24 שעות', () => {
    // 12:00 בישראל (קיץ, UTC+3) = 09:00 UTC.
    const noon = new Date('2026-09-03T09:00:00.000Z');
    const expiry = new Date(supportModeExpiryFor(noon));
    const hours = (expiry.getTime() - noon.getTime()) / (60 * 60 * 1000);
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThan(14);
  });

  it('★★ הפקיעה היא חצות **בישראל** ולא חצות UTC', () => {
    const noon = new Date('2026-09-03T09:00:00.000Z');
    const expiryIso = supportModeExpiryFor(noon);

    const asJerusalem = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(expiryIso));

    // חצות בדיוק, לפי השעון שלה.
    expect(asJerusalem).toBe('00:00');
  });

  it('גם בחורף (UTC+2) הפקיעה היא חצות מקומית', () => {
    const winterNoon = new Date('2026-01-15T10:00:00.000Z'); // 12:00 בישראל
    const asJerusalem = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(supportModeExpiryFor(winterNoon)));
    expect(asJerusalem).toBe('00:00');
  });

  it('★ הדלקה מאוחרת בלילה עדיין פגה באותו לילה — חלון קצר, לא 24 שעות', () => {
    // 23:00 בישראל.
    const late = new Date('2026-09-03T20:00:00.000Z');
    const minutes = (new Date(supportModeExpiryFor(late)).getTime() - late.getTime()) / 60000;
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThanOrEqual(60);
  });
});

describe('★ היומן — עברית שנגזרת משדות', () => {
  it('פתיחת הזמנה בידי רונן, בעברית, עם שעה בשעון שלה', () => {
    const text = describeAccessEntryHe(entry());
    expect(text).toContain('רונן');
    expect(text).toContain('14:20'); // 11:20 UTC בשעון ישראל
    expect(text).toContain('הזמנה אחת');
  });

  it('★★ ניסיון שנחסם נרשם גם הוא — יומן שרושם רק הצלחות מספר חצי סיפור', () => {
    const text = describeAccessEntryHe(entry({ action: 'accessDenied' }));
    expect(text).toContain('לא היה יכול');
    expect(text).toContain('מצב התמיכה היה כבוי');
  });

  it('פקיעה עצמית מנוסחת כמשהו שקרה לבד', () => {
    expect(describeAccessEntryHe(entry({ action: 'supportModeExpired' }))).toContain(
      'נכבה מעצמו',
    );
  });

  it('הדלקה בידי דורית מנוסחת בגוף שני', () => {
    const text = describeAccessEntryHe(
      entry({ action: 'supportModeEnabled', actor: 'owner', targetKind: 'supportMode' }),
    );
    expect(text).toContain('את');
    expect(text).toContain('נכבה לבד בסוף היום');
  });

  it('★ פעולה שלא זוהתה מוצגת ולא נבלעת', () => {
    const text = describeAccessEntryHe(entry({ action: 'somethingNew' as never }));
    expect(text).toContain('פעולה שלא זיהיתי');
  });

  it('ריבוי פריטים מנוסח נכון', () => {
    expect(describeAccessEntryHe(entry({ targetCount: 3 }))).toContain('3 הזמנות');
  });

  it('⛔ הרשומה אינה מכילה שדה תוכן — הטיפוס נעול', () => {
    const e = entry();
    // שמות השדות המותרים, מפורשות. הוספת שדה תוכן תפיל את המבחן הזה.
    expect(Object.keys(e).sort()).toEqual(
      ['action', 'actor', 'at', 'id', 'sourceMessageId', 'targetCount', 'targetKind'].sort(),
    );
  });
});

describe('הבאנר', () => {
  it('אומר שהוא נכבה לבד ושכל פתיחה נרשמת', () => {
    expect(SUPPORT_MODE_BANNER_HE).toContain('נכבה לבד בסוף היום');
    expect(SUPPORT_MODE_BANNER_HE).toContain('נרשמת');
  });
});
