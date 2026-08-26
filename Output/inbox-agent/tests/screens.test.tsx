// ============================================================================
// screens.test.tsx — שני המסכים החדשים, ו★ מבחן השפה.
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
import { InvoicesView } from '../src/components/InvoicesView';
import { MorningBriefView } from '../src/components/MorningBriefView';
import { runPipeline, type InboxFixture } from '../src/utils/pipeline';
import { PlannedActionsView } from '../src/components/PlannedActionsView';
import { runInvoicePipeline } from '../src/utils/invoicePipeline';
import { buildPlan } from '../src/utils/plannedActions';
import { hydrateLedger } from '../src/utils/pipeline';
import { mergedInbox, SEEDED_BRIEF_HISTORY } from '../src/fixtures';

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

const briefResult = runPipeline(merged as unknown as InboxFixture);
const briefHtml = renderToString(
  <MorningBriefView
    items={briefResult.items}
    bodies={briefResult.bodies}
    stats={briefResult.stats}
    canEdit
    onCreateTask={() => {}}
    onToggleHandled={() => {}}
  />,
);

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
    // ★ דוח הבוקר נוסף כאן אחרי שנמצאו בו שלוש דליפות: 'נשלח לסיווג',
    // 'סווג כרעש', ו'רעש' ככותרת קבוצה. כולן נראו תמימות בקוד.
    ['דוח הבוקר', briefHtml],
  ] as const) {
    it(`מסך ${name} נקי ממונחים פנימיים`, () => {
      for (const word of BANNED) {
        expect(html.includes(word), `המילה "${word}" הופיעה במסך ${name}`).toBe(false);
      }
    });
  }

  it('★ אין הודעת שגיאה טכנית באף אחד משני המסכים', () => {
    for (const html of [invoicesHtml, plannedHtml, briefHtml]) {
      expect(html).not.toMatch(/Error|Exception|stack|at [A-Z]\w+\./);
    }
  });
});
