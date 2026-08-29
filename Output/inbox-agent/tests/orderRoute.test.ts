// ============================================================================
// orderRoute.test.ts — המסלול `order` במסנן, ובתוכנית הארכוב.
//
// ---------------------------------------------------------------------------
// ★★ מה היה כאן, ולמה חצי מהקובץ נמחק
// ---------------------------------------------------------------------------
// הקובץ הזה נכתב כדי להחזיק הבטחה אחת: **הזמנה לא נשלחת למודל, אף פעם.** הוא
// עשה את זה בדרך היחידה שהייתה אפשרית אז — הריץ את הצינור המלא על התיבה
// כולה וספר קריאות מודל, כדי שהטענה תישען על קוד ולא על תרשים.
//
// בסבב הצמצום **מסלול המודל הוסר, ואוסף `items` נמחק** (סקירת עדי, B13).
// לכן אין יותר `runPipeline` להריץ, אין `TriageItem` לבדוק, ואין `llmCalls`
// לספור — והמבחנים שנשענו עליהם ירדו יחד איתם.
//
// ★ ההבטחה עצמה לא נחלשה, היא עברה לרף גבוה יותר:
//   · `tests/noModelPath.test.ts` — **אין בגרף הבנייה שום נתיב למודל.** לא
//     "הזמנה לא מגיעה למודל" אלא "אין מודל להגיע אליו, ואין קריאת רשת".
//   · `tests/orderSource.test.ts` — גוף הודעה נקרא רק משולח הסליקה, ורק
//     באתר קריאה אחד.
//
// מה שנשאר כאן הוא מה שעדיין חי ועדיין יכול להישבר: **המסלול `order` בתוך
// המסנן** (שממשיך לשרת את מודול החשבוניות ואת תוכנית הארכוב המוקפאים),
// ו**כלל 11** — הזמנה לא מאורכבת לעולם.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { buildPlan } from '../frozen/utils/plannedActions';
import { hydrateLedger } from '../frozen/utils/inboxFixture';
import { mergedInbox, orderMessages, SEEDED_BRIEF_HISTORY } from '../frozen/fixtures';
import { triageFilter } from '../frozen/lib/triageFilter';
import { ORDER_SENDER_ADDRESS, ORDER_SUBJECT_HE } from '../shared/lib/orderParse';

const merged = mergedInbox();

describe('המסנן — הסדר', () => {
  const orderMsg = {
    messageId: 'x',
    threadId: 't',
    fromAddress: ORDER_SENDER_ADDRESS,
    subject: ORDER_SUBJECT_HE,
    receivedAt: '2026-08-26T08:00:00+03:00',
  };

  it('★★ הוראת משתמש שאומרת "רעש" **לא** קוברת הזמנה', () => {
    // הוראה היא העדפה; הזמנה היא עובדה שמישהי שילמה עליה. הוראה שנכתבה
    // פעם אחת על הדומיין של הסליקה הייתה קוברת כל הזמנה שתגיע אחריה.
    const d = triageFilter(orderMsg, {
      userRules: [{ scope: 'domain', value: 'tranzila.com', verdict: 'noise' }],
    });
    expect(d.verdict).toBe('order');
  });

  it('★ כותרות דיוור על הודעת הזמנה לא משנות כלום', () => {
    const d = triageFilter(
      { ...orderMsg, listUnsubscribe: '<https://x.example/u>', precedence: 'bulk' },
      {},
    );
    expect(d.verdict).toBe('order');
  });

  it('הנימוק אומר במפורש שהפרטים לא יוצאים', () => {
    expect(triageFilter(orderMsg, {}).reasonHe).toContain('לא נשלחים');
  });

  it('★ ומה ש**אינו** הודעת הזמנה ממשיך בטריאז׳ הרגיל', () => {
    // `msg-105` מתחזה לספק מכתובת דומה, ו-`msg-113` היא הודעת תחזוקה
    // אמיתית מהספק. שתיהן חייבות להיות מסווגות כרגיל — מסלול `order` שהיה
    // בולע אותן היה **מרחיב** את הפטור לפי טקסט שהתוקף שולט בו.
    for (const id of ['msg-105', 'msg-113']) {
      const msg = merged.messages.find((m) => m.messageId === id);
      expect(msg).toBeTruthy();
      expect(triageFilter(msg!, {}).verdict).not.toBe('order');
    }
  });
});

describe('★★ כלל 11 — הזמנה לא מאורכבת לעולם', () => {
  const senders = hydrateLedger(merged.senders);
  const plan = buildPlan(
    {
      messages: merged.messages,
      senders,
      sentAddresses: merged.sentAddresses,
      signalThreadIds: merged.signalThreadIds,
      briefHistory: SEEDED_BRIEF_HISTORY,
    },
    { now: '2026-08-26T09:00:00+03:00' },
  );

  it('אף הודעת הזמנה אינה ברשימת הארכוב', () => {
    const archivedIds = new Set(plan.willArchive.map((a) => a.itemId));
    for (const m of orderMessages) expect(archivedIds.has(m.messageId)).toBe(false);
  });

  it('★ הנימוק שמוצג הוא הנימוק הנכון, ולא "זה לא פרסומת"', () => {
    const action = plan.actions.find((a) => a.itemId === 'msg-101');
    expect(action?.decision.rule).toBe('orderMessage');
    expect(action?.decision.reasonHe).toContain('חבילה');
  });

  it('★★ גם הודעת הזמנה שלא הצלחנו לקרוא חסינה', () => {
    // ואולי דווקא היא: אם היא יורדת מהמסך, אף אחד לא יגלה שמשהו השתבש.
    for (const id of ['msg-106', 'msg-117', 'msg-118']) {
      const action = plan.actions.find((a) => a.itemId === id);
      expect(action?.decision.action).toBe('keep');
      expect(action?.decision.rule).toBe('orderMessage');
    }
  });

  it('הודעת הזמנה מקבלת תווית ייעודית מה-allowlist', () => {
    const action = plan.actions.find((a) => a.itemId === 'msg-101');
    expect(action?.labels).toContain('סוכן/הזמנה');
  });
});
