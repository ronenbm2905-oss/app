// ============================================================================
// orderSource.test.ts — ★★ B12: היקף הקריאה בפועל.
//
// ---------------------------------------------------------------------------
// מה נבדק כאן, ולמה זה חוסם ולא מומלץ
// ---------------------------------------------------------------------------
// מסך ההסבר אומר למשתמשת שהכלי מסתכל **רק על ההודעות של חברת התשלומים**,
// ובאותה נשימה אומר לה שההרשאה שהיא נותנת היא **לכל התיבה**. הפער הזה מוחזק
// בדבר אחד בלבד: הקוד.
//
// > *"הצהרה בלי מנגנון היא מצג שווא — פעם שלישית באותו פרויקט."* (8ב.3ג)
//
// שלוש הדרישות שם: שאילתה קבועה · קריאת גוף רק למה שחזר ממנה · אתר קריאה
// יחיד + grep + **מבחן שמוכיח שהודעה משולח אחר אינה מייצרת קריאת גוף**.
// זה המבחן.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ORDER_SOURCE_QUERY,
  ORDER_SOURCE_WINDOW_DAYS,
  readOrderBodies,
} from '../shared/lib/orderSource';
import { ORDER_SENDER_ADDRESS, ORDER_SUBJECT_HE } from '../shared/lib/orderParse';
import { runOrderPipeline } from '../src/utils/orderPipeline';
import { orderMessages } from '../src/fixtures';
import { findViolations } from '../scripts/check-order-source.mjs';

const base = {
  messageId: 'm1',
  threadId: 't1',
  subject: ORDER_SUBJECT_HE,
  receivedAt: '2026-08-26T08:00:00+03:00',
};

const SECRET = 'רחוב הסוד 12, תל אביב';

describe('★★ אתר הקריאה היחיד', () => {
  it('גוף נקרא מהודעה של חברת התשלומים', () => {
    const read = readOrderBodies([
      { ...base, fromAddress: ORDER_SENDER_ADDRESS, bodyHtml: SECRET },
    ]);
    expect(read.readCount).toBe(1);
    // ★ מה שמוחזר הוא **החלק שנבחר**, ולא מחרוזת: הקורא צריך לדעת גם מאיזה
    // חלק MIME זה הגיע וגם כמה בתים ירדו מחוץ להיקף החתימה.
    expect(read.bodies.get('m1')?.body).toBe(SECRET);
    expect(read.bodies.get('m1')?.unsignedBytes).toBe(0);
    expect(read.sources).toEqual(['tranzila.com']);
  });

  it('★★ הודעה משולח אחר — הגוף שלה לא נקרא ולא מוחזר', () => {
    const read = readOrderBodies([
      { ...base, fromAddress: 'someone@else.example', bodyHtml: SECRET },
    ]);
    expect(read.readCount).toBe(0);
    expect(read.bodies.size).toBe(0);
    expect(read.refusedCount).toBe(1);
    expect(JSON.stringify(read)).not.toContain('הסוד');
  });

  it('★ גם כשהנושא מזויף במדויק — השולח הוא שקובע', () => {
    // הנושא הוא טקסט שהתוקף שולט בו. הוא נבדק בהמשך, יחד עם החתימה, ולא
    // כאן: ההחלטה כאן צרה ומכנית — האם מותר בכלל לגעת בגוף.
    const read = readOrderBodies([
      { ...base, fromAddress: '"pay@tranzila.com" <attacker@evil.example>', bodyHtml: SECRET },
    ]);
    expect(read.readCount).toBe(0);
  });

  it('★ כתובת עם שם תצוגה ובאותיות גדולות — כן נקראת', () => {
    // נרמול הכתובת הוא אותו נרמול של הפענוח, ולכן אין מצב שהודעה אמיתית
    // תיפול כאן ותיראה כמו זיוף.
    const read = readOrderBodies([
      { ...base, fromAddress: '"Tranzila" <Pay@Tranzila.COM>', bodyHtml: SECRET },
    ]);
    expect(read.readCount).toBe(1);
  });

  it('שולח נכון בלי גוף — לא סירוב, פשוט אין מה לקרוא', () => {
    const read = readOrderBodies([{ ...base, fromAddress: ORDER_SENDER_ADDRESS }]);
    expect(read.readCount).toBe(0);
    expect(read.refusedCount).toBe(0);
  });
});

describe('★ השאילתה קבועה בקוד', () => {
  it('מכילה את השולח, את הנושא ואת חלון הזמן', () => {
    expect(ORDER_SOURCE_QUERY).toContain(`from:${ORDER_SENDER_ADDRESS}`);
    expect(ORDER_SOURCE_QUERY).toContain(ORDER_SUBJECT_HE);
    expect(ORDER_SOURCE_QUERY).toContain(`newer_than:${ORDER_SOURCE_WINDOW_DAYS}d`);
  });

  it('★★ אין דרך לשנות אותה מבחוץ — הבדיקה על גרף הבנייה ירוקה', () => {
    // כולל: אין `import.meta.env` ואין השמה לשאילתה בשום קובץ שנבנה.
    expect(findViolations()).toEqual([]);
  });
});

describe('★ הצינור המלא — על ה-fixtures', () => {
  const run = runOrderPipeline(orderMessages, { now: '2026-08-26T13:00:00+03:00' });

  it('המונה שמוצג במסך סופר קריאות אמיתיות, ומקור אחד', () => {
    expect(run.stats.messagesRead).toBeGreaterThan(0);
    expect(run.stats.readSources).toEqual(['tranzila.com']);
    expect(run.stats.sourceQuery).toBe(ORDER_SOURCE_QUERY);
  });

  it('★★ הודעה מדומיין מתחזה בקובץ הדוגמה לא הפכה להזמנה', () => {
    // `msg-105` יושב ב-fixture בדיוק בשביל זה.
    const ids = run.orders.map((o) => o.sourceMessageId);
    expect(ids).not.toContain('msg-105');
  });

  it('★ מספר ההזמנות אינו גדול ממספר ההודעות שנקראו', () => {
    // טענה מבנית: אי אפשר לייצר הזמנה בלי לקרוא גוף, וגוף נקרא רק מהמקור
    // המורשה. כל הזמנה שתופיע מעבר לזה הגיעה מאיפשהו אחר.
    expect(run.orders.length).toBeLessThanOrEqual(run.stats.messagesRead);
  });
});
