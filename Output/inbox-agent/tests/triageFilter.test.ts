// ============================================================================
// triageFilter.test.ts
//
// המבחנים כאן אינם "כיסוי" אלא **תיעוד מבוצע של הסדר**. אם מישהו יסדר מחדש
// את הבדיקות ב-`triageFilter`, שני המבחנים המסומנים ★ ייפלו — וזה כל תפקידם.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  domainCandidates,
  normalizeAddress,
  triageBatch,
  triageFilter,
  type TriageContext,
} from '../shared/lib/triageFilter';
import type { MessageMeta, SenderLedgerEntry } from '../shared/types';

// --- עזרי בנייה ------------------------------------------------------------

function msg(over: Partial<MessageMeta> = {}): MessageMeta {
  return {
    messageId: 'm1',
    threadId: 't1',
    fromAddress: 'someone@neutral.example',
    fromName: 'מישהו',
    subject: 'נושא רגיל',
    receivedAt: '2026-08-25T08:00:00+03:00',
    ...over,
  };
}

function ledger(
  domainKey: string,
  over: Partial<SenderLedgerEntry> = {},
): Record<string, SenderLedgerEntry> {
  return {
    [domainKey]: {
      userId: 'u1',
      domainKey,
      defaultVerdict: 'noise',
      // ★ נוסף בפרוסה 0.5: מקור הפסק. 'header' = נלמד מכותרות RFC,
      // כלומר מקור שמותר לו להוביל לארכוב. ראה `shared/lib/senderLedger.ts`.
      verdictSource: 'header',
      neverAutoNoise: false,
      invoiceSource: false,
      messageCount: 100,
      repliedCount: 0,
      lastSeenAt: '2026-08-20T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
      ...over,
    },
  };
}

// ===========================================================================
describe('נרמול כתובות ודומיינים', () => {
  it('מחלץ כתובת מתוך "שם <כתובת>" ומוריד לאותיות קטנות', () => {
    expect(normalizeAddress('"דנה כהן" <Dana@Example.CO.IL>')).toBe('dana@example.co.il');
  });

  it('כתובת חשופה עוברת כמות שהיא', () => {
    expect(normalizeAddress('  Foo@Bar.example ')).toBe('foo@bar.example');
  });

  it('מייצר מועמדי דומיין מהספציפי לכללי, בלי להתאים על TLD בלבד', () => {
    // הרעש שנמדד מגיע מפלטפורמה אחת שמפזרת אותו על עשרות תת-דומיינים.
    expect(domainCandidates('market-updates.zilo.example')).toEqual([
      'market-updates.zilo.example',
      'zilo.example',
    ]);
    // שתי תוויות בלבד — אין ירידה ל-`example` לבדו, אחרת רשומת פנקס אחת
    // הייתה בולעת TLD שלם.
    expect(domainCandidates('zilo.example')).toEqual(['zilo.example']);
  });
});

// ===========================================================================
describe('סדר הבדיקות', () => {
  it('הוראת משתמש גוברת על הכול, כולל על כותרות דיוור', () => {
    const ctx: TriageContext = {
      userRules: [{ scope: 'domain', value: 'partner.example', verdict: 'signal' }],
    };
    const d = triageFilter(
      msg({ fromAddress: 'noreply@partner.example', listUnsubscribe: '<https://x.example/u>' }),
      ctx,
    );
    expect(d.verdict).toBe('signal');
    expect(d.reason).toBe('userRule');
  });

  it('כלל על כתובת גובר על כלל על דומיין — הספציפי מנצח', () => {
    const ctx: TriageContext = {
      userRules: [
        { scope: 'domain', value: 'firm.example', verdict: 'noise' },
        { scope: 'address', value: 'dana@firm.example', verdict: 'signal' },
      ],
    };
    expect(triageFilter(msg({ fromAddress: 'dana@firm.example' }), ctx).verdict).toBe('signal');
    expect(triageFilter(msg({ fromAddress: 'other@firm.example' }), ctx).verdict).toBe('noise');
  });

  it('שרשור שכבר סומן סיגנל — כל הודעה בו היא סיגנל', () => {
    const d = triageFilter(msg({ threadId: 't-open', subject: 'תודה!' }), {
      signalThreadIds: ['t-open'],
    });
    expect(d.verdict).toBe('signal');
    expect(d.reason).toBe('threadSignal');
  });
});

// ===========================================================================
describe('★ נקודה (א): כתובת מ"נשלחו" גוברת על דומיין שמסומן רעש', () => {
  // התובנה הראשונה של מאיה: `in:sent` הוא חלק מהטריאז', לא תוספת. אם המבחן
  // הזה נופל, פירוש הדבר שבדיקת הדומיין עברה לפני בדיקת ההתכתבות — ואז לקוחה
  // שכותבת מדומיין גדול נעלמת בשקט. זה הכשל שהמוצר כולו נועד למנוע.

  const ctx: TriageContext = {
    senders: ledger('bigmail.example', { defaultVerdict: 'noise', messageCount: 500 }),
    sentAddresses: ['noa.p@bigmail.example'],
  };

  it('הכתובת שהתכתבנו איתה מסווגת signal למרות שהדומיין שלה רעש', () => {
    const d = triageFilter(msg({ fromAddress: 'noa.p@bigmail.example' }), ctx);
    expect(d.verdict).toBe('signal');
    expect(d.reason).toBe('correspondent');
  });

  it('כתובת אחרת מאותו דומיין בדיוק — כן נופלת לרעש', () => {
    // הבדיקה המשלימה. בלעדיה "signal" עלול לנבוע מכך שהפנקס לא נקרא כלל,
    // והמבחן הראשון היה עובר מהסיבה הלא נכונה.
    const d = triageFilter(msg({ fromAddress: 'promo@bigmail.example' }), ctx);
    expect(d.verdict).toBe('noise');
    expect(d.reason).toBe('senderLedger');
  });

  it('גם כשיש כותרות דיוור על ההודעה, ההתכתבות הקודמת מנצחת', () => {
    const d = triageFilter(
      msg({ fromAddress: 'noa.p@bigmail.example', listUnsubscribe: '<https://x.example/u>' }),
      ctx,
    );
    expect(d.verdict).toBe('signal');
  });

  it('גם `Reply-To` שמצביע לכתובת שהתכתבנו איתה נחשב', () => {
    const d = triageFilter(
      msg({
        fromAddress: 'events@bigmail.example',
        replyTo: 'noa.p@bigmail.example',
        listUnsubscribe: '<https://x.example/u>',
      }),
      ctx,
    );
    expect(d.verdict).toBe('signal');
    expect(d.reason).toBe('correspondent');
  });
});

// ===========================================================================
describe('★ נקודה (ב): מילות מפתח רק מקדמות, לעולם לא מורידות', () => {
  it('מילת מפתח מעלה noise ל-unknown — ולא ל-signal', () => {
    // התקרה חשובה כמו הרצפה: "הצעת מחיר" בנושא היא בדיוק מה ששיווק אגרסיבי
    // מזייף, ולכן היא קונה מבט שני ולא מעמד של פנייה אמיתית.
    const d = triageFilter(
      msg({
        fromAddress: 'campaign@blast.example',
        subject: 'הצעת מחיר מיוחדת רק היום!',
        listUnsubscribe: '<https://blast.example/u>',
      }),
    );
    expect(d.verdict).toBe('unknown');
    expect(d.verdict).not.toBe('signal');
    expect(d.reason).toBe('keywordPromoted');
    expect(d.needsLlm).toBe(true);
  });

  it('היעדר מילת מפתח משאיר את הפריט ברעש', () => {
    const d = triageFilter(
      msg({
        fromAddress: 'campaign@blast.example',
        subject: 'מבצע סוף עונה',
        listUnsubscribe: '<https://blast.example/u>',
      }),
    );
    expect(d.verdict).toBe('noise');
    expect(d.reason).toBe('bulkHeaders');
  });

  it('מילת מפתח לא מורידה פריט שכבר unknown', () => {
    // אין לה שום מסלול להפוך משהו לרעש. `unknown` נשאר `unknown`.
    const d = triageFilter(msg({ subject: 'שאלה קצרה', fromAddress: 'ruth@neutral.example' }));
    expect(d.verdict).toBe('unknown');
    expect(d.needsLlm).toBe(true);
  });

  it('מילת מפתח לא מורידה פריט שהוא signal', () => {
    const d = triageFilter(msg({ subject: 'הצעת מחיר', fromAddress: 'ruth@neutral.example' }), {
      sentAddresses: ['ruth@neutral.example'],
    });
    expect(d.verdict).toBe('signal');
  });

  it('הוראת משתמש מפורשת גוברת גם על קידום לפי מילת מפתח', () => {
    // המשתמשת אמרה "לא מעניין אותי הדומיין הזה". מילת מפתח בנושא לא הופכת
    // את ההחלטה שלה — היא נעצרת בשלב 1 ולא מגיעה לשלב 8 בכלל.
    const d = triageFilter(
      msg({ fromAddress: 'info@webinars.example', subject: 'פגישה אחרונה לפני ההרצאה' }),
      { userRules: [{ scope: 'domain', value: 'webinars.example', verdict: 'noise' }] },
    );
    expect(d.verdict).toBe('noise');
    expect(d.reason).toBe('userRule');
  });
});

// ===========================================================================
describe('neverAutoNoise — התראה אוטומטית שמאחוריה אדם', () => {
  const ctx: TriageContext = {
    senders: ledger('filedrop.example', { defaultVerdict: 'noise', neverAutoNoise: true }),
  };

  it('התראת כלי שיתוף לא נופלת לרעש למרות noreply + כותרות דיוור', () => {
    const d = triageFilter(
      msg({
        fromAddress: 'no-reply@filedrop.example',
        subject: 'יונתן ערך קובץ',
        listUnsubscribe: '<https://filedrop.example/u>',
        precedence: 'bulk',
      }),
      ctx,
    );
    expect(d.verdict).toBe('unknown');
    expect(d.reason).toBe('neverAutoNoise');
  });

  it('...אבל גם לא מקודמת לסיגנל — ההכרעה נשארת למודל', () => {
    const d = triageFilter(msg({ fromAddress: 'no-reply@filedrop.example' }), ctx);
    expect(d.verdict).not.toBe('signal');
  });

  it('הדגל חל גם על תת-דומיין', () => {
    const d = triageFilter(msg({ fromAddress: 'alerts@eu.filedrop.example' }), ctx);
    expect(d.reason).toBe('neverAutoNoise');
  });
});

// ===========================================================================
describe('זיהוי רעש', () => {
  it('List-Unsubscribe מספיק לבדו', () => {
    expect(triageFilter(msg({ listUnsubscribe: '<https://x.example/u>' })).verdict).toBe('noise');
  });

  it('Precedence: bulk מספיק לבדו', () => {
    expect(triageFilter(msg({ precedence: 'Bulk' })).verdict).toBe('noise');
  });

  it('Auto-Submitted: no פירושו מפורשות "נכתב בידי אדם" — ולכן לא רעש', () => {
    // RFC 3834. פספוס הניואנס הזה היה קובר כל מייל שנשלח מלקוח דואר שמציין
    // את הכותרת במפורש.
    expect(triageFilter(msg({ autoSubmitted: 'no' })).verdict).toBe('unknown');
    expect(triageFilter(msg({ autoSubmitted: 'auto-generated' })).verdict).toBe('noise');
  });

  it('תיבות noreply לצורותיהן', () => {
    for (const local of ['noreply', 'no-reply', 'donotreply', 'newsletter', 'bounce-4471']) {
      expect(triageFilter(msg({ fromAddress: `${local}@x.example` })).verdict).toBe('noise');
    }
  });

  it('כתובת רגילה שמכילה מילה דומה אינה רעש', () => {
    // `noreplyable@` הוא לא `noreply@`. ההתאמה על תחילית + מפריד ולא על
    // `includes`, אחרת כל `bouncer@` או `marketingteam@` היה נקבר.
    expect(triageFilter(msg({ fromAddress: 'marketingteam@x.example' })).verdict).toBe('unknown');
  });

  it('ברירת המחדל היא unknown, לא noise', () => {
    // חשוב: פריט לא מזוהה **נשלח לסיווג**. ברירת מחדל של רעש הייתה קוברת כל
    // שולח חדש, כלומר כל לקוחה חדשה.
    const d = triageFilter(msg());
    expect(d.verdict).toBe('unknown');
    expect(d.reason).toBe('default');
    expect(d.needsLlm).toBe(true);
  });
});

// ===========================================================================
describe('needsLlm וספירות', () => {
  it('רק רעש מסומן כלא-דורש-מודל', () => {
    expect(triageFilter(msg({ precedence: 'bulk' })).needsLlm).toBe(false);
    expect(triageFilter(msg()).needsLlm).toBe(true);
  });

  it('triageBatch מחזיר שיעור סינון נכון', () => {
    const messages = [
      msg({ messageId: 'a', precedence: 'bulk' }),
      msg({ messageId: 'b', listUnsubscribe: '<https://x.example/u>' }),
      msg({ messageId: 'c', fromAddress: 'noreply@y.example' }),
      msg({ messageId: 'd', fromAddress: 'human@y.example' }),
    ];
    const r = triageBatch(messages);
    expect(r.fetched).toBe(4);
    expect(r.filteredOut).toBe(3);
    expect(r.needsLlm).toBe(1);
    expect(r.filterRate).toBeCloseTo(0.75);
  });

  it('אצווה ריקה לא מחלקת באפס', () => {
    expect(triageBatch([]).filterRate).toBe(0);
  });
});
