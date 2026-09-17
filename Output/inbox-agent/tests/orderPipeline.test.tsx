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
import { selectReadablePart } from '../shared/lib/mimeBody';

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

  // ---------------------------------------------------------------------------
  // ★★ המבחן הזה נפל ב-16.9.2026 — **ולא בגלל דליפה.**
  //
  // msg-120 עברה מ"חסומה" ל"ברשימת האריזה", והכרטיס שלה התחיל להופיע במסך.
  // ב-fixtures, msg-104 (חסומה, מכפלה שלא מסתדרת) ו-msg-120 הן **אותה
  // לקוחה** — אותו שם ואותו מייל, בשתי הזמנות שונות. הגרסה הקודמת של המבחן
  // חיפשה כל ערך של כל הזמנה חסומה בתוך המסמך **כולו**, ולכן השם "נועה
  // גלעד" שהופיע בכרטיס הלגיטימי של msg-120 נספר כדליפה של msg-104.
  //
  // ★ זו אינה תקלת fixture אלא **תקלת ניסוח של הטענה**: "המחרוזת אינה
  // מופיעה במסמך" אינה שקולה ל"הפרטים של ההזמנה החסומה אינם מוצגים". לקוחה
  // חוזרת היא מצב רגיל לגמרי בחנות, ומבחן שנשבר ממנה היה נשבר גם בשטח.
  //
  // הניסוח המתוקן שואל את השאלה הנכונה בשתי שכבות:
  //   1. **בלוק הכתובת המלא** של הזמנה חסומה לא מופיע — לעולם. זה מה
  //      שמודבק בלחיצה אחת, וזה מה שאסור שיהיה זמין.
  //   2. ערך בודד נבדק רק אם הוא **אינו שייך גם להזמנה שכן מוצגת**. ערך
  //      משותף אינו ראיה לדליפה; ערך ייחודי — כן.
  it('★★ אף כתובת של הזמנה חסומה לא מגיעה ל-HTML', () => {
    // הטענה המרכזית של המסך: כרטיס חסום הוא הסבר, לא פעולה בלחיצה אחת.
    const shownValues = new Set<string>();
    for (const o of [...run.toShip, ...run.shipped]) {
      for (const v of Object.values(o.recipient)) if (v) shownValues.add(v);
    }

    let uniqueChecked = 0;
    for (const o of run.needsAttention) {
      // 1. בלוק הכתובת המלא — מה שנכנס ללוח בלחיצה אחת.
      const address = formatAddressBlock(o.recipient);
      if (address) expect(html).not.toContain(address);

      // 2. שדות שהם ייחודיים להזמנה החסומה.
      for (const v of Object.values(o.recipient)) {
        if (!v || shownValues.has(v)) continue;
        uniqueChecked++;
        expect(html).not.toContain(v);
      }
    }

    // ★ שומר על המבחן עצמו: אם יום אחד כל הערכים יהיו "משותפים", המבחן
    // היה עובר בלי לבדוק כלום. הוא חייב לבדוק משהו.
    expect(uniqueChecked).toBeGreaterThan(5);
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

// ===========================================================================
// ★★★ msg-120 — ההוכחה שכל השינוי של 16.9.2026 עומד עליה.
//
// ---------------------------------------------------------------------------
// מה נטען, ולמה זה חייב להיבדק על ה-HTML המרונדר
// ---------------------------------------------------------------------------
// msg-120 היא הודעה חתומה כדין של הספק, שמישהו הדביק בסופה **הזמנה שנייה
// שלמה** עם השם, הכתובת, העיר, המיקוד, הטלפון והמייל שלו. עד 16.9 היא
// נחסמה, ולכן "הפרטים שלו לא מוצגים" היה נכון מסיבה משעממת: שום דבר
// מההודעה לא הוצג. מהיום היא **מתקבלת ומוצגת** — וזו בדיוק הנקודה שבה
// הטענה מתחילה לעלות כסף.
//
// ★ ולכן הבדיקה כאן היא על `renderToString` ולא על האובייקט: `recipient`
// נקי הוא תנאי הכרחי ולא מספיק. מה שמגיע למסך עובר דרך הכרטיס, בלוק
// הכתובת, רשימת המוצרים ושורת ההערות — וכל אחד מהם הוא מקום שבו מחרוזת
// יכולה לצוץ.
//
// ★★ והשומר על המבחן עצמו: הוא **קודם מוודא שהמחרוזות באמת קיימות בהודעה
// המקורית**. בלי הבדיקה הזאת, יום שבו מישהו יערוך את ה-fixture ויוריד
// ממנה את התוקף ייראה בדיוק כמו מבחן שעובר. זה הלקח מ-`header.d=`:
// הצהרה שנבדקת מול מה שאנחנו כתבנו אינה נבדקת.
// ===========================================================================

describe('★★★ msg-120 — הזמנה שהודבקה לה הזמנה שנייה בסוף', () => {
  const ATTACKER = {
    name: 'דן התוקף',
    street: 'רחוב התוקף 9',
    city: 'קריית הזיוף',
    postalCode: '6100999',
    phone: '050-555-0999',
    email: 'dan@matchzeh.example',
  };

  const SIGNED = {
    name: 'נועה גלעד',
    street: 'רחוב הדוגמה 33',
    city: 'ניר הדוגמה',
    postalCode: '6100255',
    phone: '050-555-0120',
    email: 'noa.g@lakoach.example',
  };

  /** הגוף הגולמי של ההודעה, מפוענח מ-quoted-printable — כדי לבדוק אותו. */
  const rawDecoded = (() => {
    const src = orderMessages.find((m) => m.messageId === 'msg-120');
    const part = selectReadablePart(src!.bodyRaw!);
    // ★ החלק המפוענח **בלי** שום חיתוך: כך נראית ההודעה לפני ההגנה.
    return part.body;
  })();

  it('★★ שומר-המבחן: פרטי התוקף באמת קיימים בהודעה המקורית', () => {
    // בלי זה, כל מה שאחריו מוכיח שמחרוזת שלא קיימת אינה מופיעה.
    for (const v of Object.values(ATTACKER)) {
      expect(rawDecoded).toContain(v);
    }
    expect(rawDecoded).toContain(SIGNED.street);
  });

  it('★ ההזמנה התקבלה ומוצגת ברשימת האריזה', () => {
    const o = byId('msg-120');
    expect(o?.needsHumanReview).toBe(false);
    expect(run.toShip.map((x) => x.sourceMessageId)).toContain('msg-120');
  });

  it('★★★ אף פרט של התוקף אינו מופיע ב-HTML המרונדר', () => {
    for (const [field, value] of Object.entries(ATTACKER)) {
      expect(html, 'דלף השדה ' + field).not.toContain(value);
    }
  });

  it('★★ מה שמוצג הוא הנמענת מהחלק החתום — בלוק הכתובת המלא', () => {
    const o = byId('msg-120')!;
    expect(o.recipient).toMatchObject(SIGNED);

    // ★ בלוק הכתובת כפי שהוא נכנס ללוח בלחיצה — מופיע במסך, שורה-שורה.
    for (const line of formatAddressBlock(o.recipient).split(String.fromCharCode(10))) {
      expect(html).toContain(line);
    }
  });

  it('★★ הכמות שנספרת היא של ההזמנה החתומה, לא של זו שהודבקה', () => {
    const o = byId('msg-120')!;
    // ההזמנה שהודבקה ביקשה 2 יחידות נוספות של אותו מוצר.
    expect(o.items).toHaveLength(1);
    expect(o.items[0].quantity).toBe(1);
    expect(o.paidTotal).toBe(42);
  });

  it('★ ואין על הכרטיס שום הערה — הממצא נשמר בדרגה שאינה מוצגת', () => {
    const o = byId('msg-120')!;
    expect(o.issues.some((i) => i.severity === 'warn' || i.severity === 'block')).toBe(false);
    expect(o.issues.some((i) => i.code === 'unsignedBodyTail')).toBe(true);

    // ★★ ובמקום 60 הערות זהות — משפט אחד מצטבר מתחת למונה הקריאה.
    expect(run.stats.unsignedTail).toBeGreaterThan(0);
    expect(html).toContain('מכל הודעה נקרא רק החלק שחברת הסליקה חתמה עליו');
    expect(html).not.toContain('קראתי מההודעה הזאת רק את החלק');
  });
});
