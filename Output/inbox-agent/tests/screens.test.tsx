// ============================================================================
// screens.test.tsx — המסכים, ו★ מבחן השפה.
//
// ---------------------------------------------------------------------------
// ★ מה השתנה בסבב הצמצום
// ---------------------------------------------------------------------------
// דוח הבוקר ירד מכאן: הוא נמחק יחד עם אוסף `items` (סקירת עדי, B13). במקומו
// נכנסו למבחן השפה **המסכים שהמשתמשת באמת רואה** — רשימת ההזמנות ומסך
// ההסבר שלפני החיבור. זה גם הסדר הנכון: המסך שירד היה זה שדלף ממנו הכי
// הרבה מונחים פנימיים, ושני אלה מעולם לא נבדקו.
//
// ---------------------------------------------------------------------------
// למה יש כאן מבחן על **מילים**
// ---------------------------------------------------------------------------
// המשתמשת היחידה של הכלי הזה לא מבינה במחשוב. מונח פנימי שדולף למסך —
// `verdict`, `noise`, `needsHumanReview`, "המודל", "סיווג" — הוא לא אי-נוחות
// אלא כשל: הוא גורם לה להפסיק לקרוא ולהתחיל לנחש.
//
// ניסוח נכון נשחק בשקט. מישהו יוסיף מחרוזת אחת בלחץ, היא תיראה סבירה בקוד,
// ואף אחד לא יפתח את המסך בעברית כדי לבדוק. מבחן שסורק את ה-HTML המרונדר
// הוא הדבר היחיד שתופס את זה — הוא לא בודק טעם, הוא בודק שהמילים שהוחלט
// שלא יופיעו, לא מופיעות.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { InvoicesView } from '../frozen/components/InvoicesView';
import { PlannedActionsView } from '../frozen/components/PlannedActionsView';
import { runInvoicePipeline } from '../frozen/utils/invoicePipeline';
import { buildPlan } from '../frozen/utils/plannedActions';
import { hydrateLedger } from '../frozen/utils/inboxFixture';
import { mergedInbox, SEEDED_BRIEF_HISTORY, orderMessages } from '../frozen/fixtures';
import { OrdersView } from '../src/components/OrdersView';
import { App } from '../src/App';
import { ExplainerScreen } from '../src/components/ExplainerScreen';
import { runOrderPipeline } from '../src/utils/orderPipeline';

const NOW = '2026-08-26T09:00:00+03:00';
const merged = mergedInbox();
const senders = hydrateLedger(merged.senders);

const invoiceResult = runInvoicePipeline(merged.messages, {
  triage: {
    senders,
    sentAddresses: merged.sentAddresses ?? [],
    signalThreadIds: merged.signalThreadIds ?? [],
    userRules: merged.userRules ?? [],
  },
  senders,
  now: NOW,
});

const plan = buildPlan(
  {
    messages: merged.messages,
    senders,
    sentAddresses: merged.sentAddresses,
    signalThreadIds: merged.signalThreadIds,
    briefHistory: SEEDED_BRIEF_HISTORY,
  },
  { now: NOW },
);

const invoicesHtml = renderToString(
  <InvoicesView
    result={invoiceResult}
    invoices={invoiceResult.invoices}
    canEdit
    onToggleReviewed={() => {}}
  />,
);

// ★ שני המסכים שהמוצר מורכב מהם.
const ordersHtml = renderToString(
  <OrdersView
    result={runOrderPipeline(orderMessages, { now: NOW })}
    canEdit
    onToggleShipped={() => {}}
    onPurgeRequest={() => ''}
  />,
);

const explainerHtml = renderToString(<ExplainerScreen onContinue={() => {}} />);

const plannedHtml = renderToString(
  <PlannedActionsView
    plan={plan}
    pinned={new Set<string>()}
    canEdit
    onKeep={() => {}}
    onRelease={() => {}}
  />,
);

// ---------------------------------------------------------------------------

describe('מסך החשבוניות', () => {
  it('מרונדר עם טבלה אמיתית וכותרות עמודה', () => {
    // `<table>` ולא רשת `div`-ים: קורא מסך צריך לדעת מה כותרת העמודה של כל
    // תא, וזה גם מה שמאפשר זום של 200% בלי שהמבנה יתפרק.
    expect(invoicesHtml).toContain('<table');
    expect(invoicesHtml).toContain('scope="col"');
    expect(invoicesHtml).toContain('ספק');
    expect(invoicesHtml).toContain('סה״כ');
  });

  it('★ כפתור אחד לרו״ח, ובלי המילה CSV', () => {
    expect(invoicesHtml).toContain('הורדת קובץ לרו״ח');
    expect(invoicesHtml).not.toContain('CSV');
    expect(invoicesHtml).not.toContain('ייצוא');
  });

  it('★ חשבונית שלא נקראה מוצגת בלי מספר, עם משפט במקומו', () => {
    expect(invoicesHtml).toContain('לא הצלחתי לקרוא');
    expect(invoicesHtml).toContain('תסתכלי עליה');
  });

  it('★ נאמר במפורש שהסכום אינו התמונה המלאה', () => {
    expect(invoicesHtml).toContain('לא כולל');
  });

  it('מיילים שנראו כמו חשבונית ולא נכנסו — מוצגים עם הסבר', () => {
    expect(invoicesHtml).toContain('לא נגעתי בהם');
  });
});

// ---------------------------------------------------------------------------

describe('מסך "מה עומד לקרות"', () => {
  it('★ ההבטחה בגוף ראשון, ראשונה על המסך', () => {
    expect(plannedHtml).toContain('אארכב');
    expect(plannedHtml).toContain('חוזר בלחיצה');
  });

  it('★ "לא מוחק" כתוב, ולא רק נכון', () => {
    expect(plannedHtml).toContain('לא מוחק');
  });

  it('★ כפתור ההחזרה יושב על כל שורה, ולא בתפריט', () => {
    const buttons = plannedHtml.split('להשאיר בתיבה').length - 1;
    // אחד לכל פריט שעומד להיארכב (הכותרת מכילה את הביטוי פעם נוספת).
    expect(buttons).toBeGreaterThanOrEqual(plan.willArchive.length);
  });

  it('★ שום כותרת של מייל שיאורכב לא מגיעה ל-HTML', () => {
    // לא "לא מוצגת" — **לא קיימת**. הכותרת לא נשמרה בפריט רעש מלכתחילה.
    for (const a of plan.willArchive) expect(a.subject).toBeNull();
  });

  it('לכל פריט יש נימוק על המסך', () => {
    for (const a of plan.willArchive.slice(0, 5)) {
      expect(plannedHtml).toContain(a.decision.reasonHe);
    }
  });
});

// ---------------------------------------------------------------------------

/**
 * ★★ מסך ההסבר — שלושת הדברים שחייבים להיאמר.
 *
 * הנוסח מאושר בסעיף 8ב.4 של הסקירה, והמבחנים כאן נועדו לדבר אחד: שאף אחד
 * לא "יקצר" אותו. שלוש הדחיסות הצפויות הן בדיוק שלושת המשפטים שנבדקים —
 * היקף ההרשאה, מי מצמצם אותו בפועל, ומשפט החיסון.
 */
describe('★★ מסך ההסבר שלפני החיבור', () => {
  it('אומר שההרשאה היא לכל התיבה', () => {
    expect(explainerHtml).toContain('ההרשאה שתינתן היא לכל התיבה שלך');
  });

  it('אומר ש-Google לא מציעה הרשאה צרה יותר — כלומר שזו לא בחירה של מישהו', () => {
    expect(explainerHtml).toContain('Google פשוט לא מציעה הרשאה צרה יותר');
  });

  it('★ אומר שמה שמצמצם הוא התוכנה ורונן, ולא Google', () => {
    // המשפט שמשמיטים. בלעדיו היא מניחה ש-Google אוכפת את הצמצום, ומסכימה
    // על סמך הנחה שגויה.
    expect(explainerHtml).toContain('התוכנה ורונן');
    expect(explainerHtml).toContain('היא תוכל לקרוא הכול');
  });

  it('★★ משפט החיסון מדבר על "מקום שרונן לא ביקש", ולא על אתר מזויף', () => {
    // היא לא תזהה אתר מזויף. היא כן תזהה "רונן לא ביקש ממני עכשיו".
    expect(explainerHtml).toContain('אם תראי את המסך הזה במקום שרונן לא ביקש');
    expect(explainerHtml).not.toContain('מזויף');
  });

  it('אין בו כפתור התחברות לגוגל — כי אין חיבור', () => {
    expect(explainerHtml).not.toContain('התחברות עם Google');
    expect(explainerHtml).toContain('עוד אין חיבור לגוגל');
  });

  it('ההדגשות של הנוסח המאושר שורדות את הרינדור', () => {
    // `**...**` בנוסח אינו קישוט: הוא מסמן בדיוק את המשפטים שנבלעים.
    expect(explainerHtml).toContain('<strong');
    expect(explainerHtml).not.toContain('**');
  });
});

// ---------------------------------------------------------------------------

/**
 * ★ מונה הקריאה (M18) — "הבטחה שאפשר להסתכל עליה".
 */
describe('★ מונה הקריאה במסך ההזמנות', () => {
  it('אומר כמה הודעות נקראו, ומאיפה', () => {
    expect(ordersHtml).toContain('הכלי קרא');
    expect(ordersHtml).toContain('כולן מחברת התשלומים');
  });

  it('מציג את השאילתה הקבועה כמות שהיא', () => {
    expect(ordersHtml).toContain('from:pay@tranzila.com');
  });
});

// ---------------------------------------------------------------------------

describe('★★ מבחן השפה — מונחים פנימיים לא מגיעים למסך', () => {
  /**
   * המילים שהוחלט שלא יופיעו. שתי קבוצות:
   *  - מונחים פנימיים באנגלית, שהיא לא אמורה לפגוש בכלל.
   *  - תרגומים מילוליים שלהם לעברית — שגרועים יותר, כי הם **נראים** כמו
   *    עברית ולכן אף אחד לא חושד בהם.
   */
  const BANNED = [
    'verdict',
    'needsHumanReview',
    'containsSensitive',
    'proposal',
    'triage',
    'localStorage',
    'undefined',
    'null',
    'המודל',
    'סיווג',
    'טוקנים',
    'רעש',
    'סיגנל',
  ];

  for (const [name, html] of [
    ['חשבוניות', invoicesHtml],
    ['מה עומד לקרות', plannedHtml],
    // ★ שני אלה הם מה שדורית פותחת בפועל, ולכן הם הראשונים בחשיבות.
    ['ההזמנות של היום', ordersHtml],
    ['ההסבר לפני החיבור', explainerHtml],
  ] as const) {
    it(`מסך ${name} נקי ממונחים פנימיים`, () => {
      for (const word of BANNED) {
        expect(html.includes(word), `המילה "${word}" הופיעה במסך ${name}`).toBe(false);
      }
    });
  }

  it('★ אין הודעת שגיאה טכנית באף אחד משני המסכים', () => {
    for (const html of [invoicesHtml, plannedHtml, ordersHtml, explainerHtml]) {
      expect(html).not.toMatch(/Error|Exception|stack|at [A-Z]\w+\./);
    }
  });
});

// ---------------------------------------------------------------------------

/**
 * ★ האפליקציה עצמה — smoke.
 *
 * לא בודק פיצ'ר אלא את מה ששום מבחן אחר לא נוגע בו: ש-`App` נטענת, שכל
 * שרשרת הייבוא שלה תקינה, ושהיא לא זורקת ברינדור. אחרי סבב שבו זזו עשרים
 * קבצים, זה בדיוק הכשל שמתגלה רק בדפדפן.
 */
describe('★ האפליקציה נטענת', () => {
  it('מרונדרת בלי לזרוק, עם הכותרת והבאנר', () => {
    const html = renderToString(<App />);
    expect(html).toContain('ההזמנות של היום');
    expect(html).toContain('מצב הדגמה');
    // באנר ההדגמה קבוע ולא ניתן לסגירה — משתמשת שתשכח שאלה נתוני דוגמה
    // עלולה להסיק מהמסך מסקנות על התיבה האמיתית שלה.
    expect(html).toContain('שום מייל אמיתי לא נקרא');
  });
});
