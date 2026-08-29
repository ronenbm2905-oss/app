// ============================================================================
// orderPipeline.test.ts — הצינור והמסך, על ה-fixtures.
//
// המבחנים כאן בודקים את מה שהמשתמשת רואה בפועל, ולא רק את הפונקציות הטהורות:
// אילו הזמנות בכל רשימה, כמה יחידות, ומה **לא** מופיע.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OrdersView } from '../src/components/OrdersView';
import { runOrderPipeline } from '../src/utils/orderPipeline';
import { orderMessages, SEEDED_SHIPMENTS } from '../src/fixtures';
import { formatAddressBlock } from '../shared/types';

const NOW = '2026-08-26T13:00:00+03:00';
const run = runOrderPipeline(orderMessages, { shipments: SEEDED_SHIPMENTS, now: NOW });
const byId = (id: string) => run.orders.find((o) => o.sourceMessageId === id);

const html = renderToString(
  <OrdersView result={run} canEdit onToggleShipped={() => {}} onPurgeRequest={() => ''} />,
);

// ---------------------------------------------------------------------------

describe('הפרדה בין מה שיצא למה שלא', () => {
  it('שלוש רשימות, בלי חפיפה', () => {
    const ids = [...run.needsAttention, ...run.toShip, ...run.shipped].map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(run.orders.length);
  });

  it('הישן ראשון ברשימת האריזה', () => {
    const dates = run.toShip.map((o) => o.receivedAt);
    expect([...dates].sort()).toEqual(dates);
  });

  it('הזמנה שסומנה כנשלחה יורדת מרשימת האריזה', () => {
    expect(run.toShip.some((o) => o.sourceMessageId === 'msg-110')).toBe(false);
    expect(run.shipped.some((o) => o.sourceMessageId === 'msg-110')).toBe(true);
  });
});

describe('★ ספירת היחידות — המספר שהמסך צועק', () => {
  it('כמות 1 וכמות 4 של אותו מוצר', () => {
    expect(byId('msg-101')?.items[0].quantity).toBe(1);
    expect(byId('msg-102')?.items[0].quantity).toBe(4);
  });

  it('★ שורת ההטבה במחיר 0 לא נכנסת לספירה', () => {
    const o = byId('msg-103');
    expect(o?.items).toHaveLength(2);
    expect(o?.items.filter((i) => i.isPackable)).toHaveLength(1);
  });

  it('הזמנה מרובת פריטים נספרת נכון', () => {
    const o = byId('msg-111');
    const units = o?.items.filter((i) => i.isPackable).reduce((s, i) => s + i.quantity, 0);
    expect(units).toBe(14);
  });

  it('★ המספר הכולל מתעלם ממה שלא ניתן לארוז ומהזמנות חסומות', () => {
    const expected = run.toShip.reduce(
      (sum, o) => sum + o.items.filter((i) => i.isPackable).reduce((s, i) => s + i.quantity, 0),
      0,
    );
    expect(run.stats.unitsToPack).toBe(expected);
  });
});

describe('★★ הזמנות חסומות', () => {
  it('הזמנה שהמכפלה בה לא מסתדרת נמצאת ב"צריך שתסתכלי"', () => {
    expect(run.needsAttention.some((o) => o.sourceMessageId === 'msg-104')).toBe(true);
  });

  it('כל הזמנה חסומה נושאת סיבה קריאה', () => {
    for (const o of run.needsAttention) {
      const blocking = o.issues.filter((i) => i.severity === 'block');
      expect(blocking.length).toBeGreaterThan(0);
      for (const issue of blocking) {
        expect(issue.messageHe.length).toBeGreaterThan(10);
        expect(issue.messageHe).not.toMatch(/[a-z]{5,}/);
      }
    }
  });

  it('★★ אף כתובת של הזמנה חסומה לא מגיעה ל-HTML', () => {
    // הטענה המרכזית של המסך: כרטיס חסום הוא הסבר, לא פעולה בלחיצה אחת.
    for (const o of run.needsAttention) {
      const address = formatAddressBlock(o.recipient);
      if (address) expect(html).not.toContain(address);
      for (const v of Object.values(o.recipient)) {
        if (v) expect(html).not.toContain(v);
      }
    }
  });

  it('הודעה מדומיין מתחזה לא מייצרת כרטיס בכלל', () => {
    expect(byId('msg-105')).toBeUndefined();
    expect(run.openQuestions.map((q) => q.messageId)).toContain('msg-105');
  });

  it('★ ההודעה על המתחזה לא מכילה שום פרט ממנה', () => {
    const q = run.openQuestions.find((x) => x.messageId === 'msg-105');
    expect(q?.reasonHe).toContain('לא הגיעה מכתובת הסליקה');
    expect(JSON.stringify(q)).not.toContain('דנה');
    expect(JSON.stringify(q)).not.toContain('הזיוף');
  });

  it('הודעה שאינה הזמנה כלל לא מופיעה בשום רשימה', () => {
    expect(byId('msg-113')).toBeUndefined();
    expect(run.openQuestions.map((q) => q.messageId)).not.toContain('msg-113');
  });
});

describe('★★ המחיקה, מקצה לקצה', () => {
  it('הזמנה שנשלחה לפני 70 יום — הכתובת שלה כבר לא קיימת', () => {
    const o = byId('msg-109');
    expect(o?.recipientPurged).toBe(true);
    expect(o?.recipient.street).toBeNull();
    expect(o?.items[0].quantity).toBe(3);
  });

  it('הזמנה שנשלחה לפני חמישה ימים — הכתובת נשארה', () => {
    expect(byId('msg-110')?.recipient.city).toBe('תל דוגמה');
  });

  it('★★ אין עותק של כתובת שנמחקה בשום מקום בתוצאה', () => {
    // ★ זו הבדיקה שסקירת עדי דרשה: "מסך ההזמנות של היום" מחזיק את אותן
    // כתובות ואינו יושב ב-`orders`. כאן נסרקת **כל התוצאה** — כל הרשימות,
    // הסטטיסטיקות והשאלות הפתוחות — אחרי המחיקה.
    const blob = JSON.stringify(run);
    for (const leaked of ['הילה נחום', 'שדרות הדוגמה 30', '050-555-0109', 'hila.n@lakoach.example']) {
      expect(blob).not.toContain(leaked);
    }
  });

  it('★★ וגם לא ב-HTML של המסך', () => {
    for (const leaked of ['הילה נחום', 'שדרות הדוגמה 30', '050-555-0109']) {
      expect(html).not.toContain(leaked);
    }
  });

  it('★ הזמנה מלפני חמישה חודשים שאיש לא סימן מופיעה ברשימת "יימחקו בקרוב"', () => {
    expect(run.expiringSoon.map((o) => o.sourceMessageId)).toContain('msg-119');
    // והיא **עדיין ברשימת האריזה** — היא לא נעלמה, רק סומנה.
    expect(run.toShip.some((o) => o.sourceMessageId === 'msg-119')).toBe(true);
  });

  it('★ מחיקה לבקשת לקוחה מוחלת על התוצאה', () => {
    const target = byId('msg-101');
    const after = runOrderPipeline(orderMessages, {
      shipments: SEEDED_SHIPMENTS,
      manuallyPurgedIds: [target!.id],
      now: NOW,
    });
    const purged = after.orders.find((o) => o.id === target!.id);
    expect(purged?.recipientPurged).toBe(true);
    expect(JSON.stringify(after)).not.toContain('רונית שדה');
    // רשומת המכירה נשארה.
    expect(purged?.paidTotal).toBe(42);
  });
});

describe('המסך', () => {
  it('★ הכמות מוצגת בגודל שאי אפשר לפספס', () => {
    expect(html).toContain('text-4xl');
    expect(html).toContain('יחידות לארוז');
  });

  it('★ כפתור העתקה אחד לכתובת המלאה', () => {
    expect(html).toContain('העתקת הכתובת');
  });

  it('★ הכתובת המוצגת היא בדיוק זו שתועתק', () => {
    // בלוק אחד ולא ארבעה שדות: אחרת המסך והלוח יכולים להתפצל.
    const o = run.toShip[0];
    expect(html).toContain(formatAddressBlock(o.recipient));
  });

  it('★ צ׳קבוקס "נשלח", והביטול כתוב עליו', () => {
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('נשלח');
    // ★ וההבטחה שאפשר לבטל נאמרת גם כשרשימת מה שיצא סגורה.
    expect(html).toContain('הסימון הפיך תמיד');
  });

  it('★ שורת מחיר-0 מוצגת בנפרד, ומסומנת "לא לארוז"', () => {
    expect(html).toContain('לא לארוז');
    expect(html).toContain('הטבת משלוח חינם');
  });

  it('הפרדה גלויה בין מה שלא יצא למה שיצא', () => {
    expect(html).toContain('עוד לא יצא');
    expect(html).toContain('כבר יצא');
  });

  it('★ הזמנה שנמחקה מוסברת כמחיקה ולא ככשל קריאה', () => {
    const shippedHtml = renderToString(
      <OrdersView
        result={{ ...run, shipped: run.shipped, toShip: [], needsAttention: [] }}
        canEdit
        onToggleShipped={() => {}}
        onPurgeRequest={() => ''}
      />,
    );
    expect(shippedHtml).toContain('כבר יצא');
  });

  it('כפתורים בגובה מגע 44px', () => {
    expect(html).toContain('min-h-[44px]');
  });
});

// ---------------------------------------------------------------------------

describe('★★ מבחן השפה — מונחים פנימיים לא מגיעים למסך ההזמנות', () => {
  const BANNED = [
    'verdict',
    'needsHumanReview',
    'recipientPurged',
    'purgeAfter',
    'isPackable',
    'dkim',
    'DKIM',
    'localStorage',
    'undefined',
    'null',
    'המודל',
    'סיווג',
    'רעש',
    'סיגנל',
    'סטטוס',
    'רשומה',
  ];

  for (const word of BANNED) {
    it(`המילה "${word}" לא מופיעה`, () => {
      expect(html.includes(word)).toBe(false);
    });
  }

  it('אין הודעת שגיאה טכנית', () => {
    expect(html).not.toMatch(/Error|Exception|stack|at [A-Z]\w+\./);
  });
});
