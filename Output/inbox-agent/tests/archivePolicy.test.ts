// ============================================================================
// archivePolicy.test.ts — ★ המבחנים שמוכיחים שהכללים **חוסמים**.
//
// ---------------------------------------------------------------------------
// מה נבדק כאן, ומה במפורש לא
// ---------------------------------------------------------------------------
// המבחנים בקובץ הזה כמעט כולם מהצורה "ניסינו לארכב X — ולא הצלחנו". זו לא
// הטיה: **הטענה של המודול הזאת בדיוק.** אין שום ערך בהוכחה שארכוב עובד —
// ארכוב שעובד יותר מדי הוא הכשל, לא הפיצ׳ר.
//
// כל אחד מהכללים מקבל מבחן ייעודי שמפיל אותו לבד, כדי שאם מישהו יסיר כלל
// אחד, ייפול מבחן אחד עם שם שאומר איזה. מבחן משולב היה מסתיר את זה.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  archiveDecision,
  ARCHIVE_LABEL,
  ALL_AGENT_LABELS,
  isInstitutionalDomain,
  labelsFor,
  NEVER_MARK_AS_READ,
  planArchiveRun,
  restoreArchived,
  weeklyArchiveReport,
  type ArchiveCandidate,
} from '../shared/lib/archivePolicy';

const NOW = '2026-08-25T06:00:00+03:00';
/** אתמול בבוקר — עבר את חלון ההשהיה. */
const YESTERDAY_BRIEF = '2026-08-24T05:30:00+03:00';
/** לפני שעה — **לא** עבר את החלון. */
const THIS_MORNING = '2026-08-25T05:30:00+03:00';

/** מועמד שעובר את כל הכללים. נקודת המוצא של כל מבחן. */
function eligible(over: Partial<ArchiveCandidate> = {}): ArchiveCandidate {
  return {
    itemId: 'm-001',
    fromDomain: 'dealim-hayom.example',
    filterVerdict: 'noise',
    filterReason: 'bulkHeaders',
    firstSeenInBriefAt: YESTERDAY_BRIEF,
    briefAppearances: 2,
    ...over,
  };
}

const decide = (c: ArchiveCandidate) => archiveDecision(c, { now: NOW });

// ---------------------------------------------------------------------------

describe('נקודת המוצא', () => {
  it('דיוור פרסומי שכבר הופיע בדוח בוקר — כן מאורכב', () => {
    // המבחן היחיד שמאשר ארכוב. הוא קיים כדי ששאר המבחנים יוכיחו חסימה ולא
    // סתם פונקציה שמחזירה תמיד `keep`.
    const d = decide(eligible());
    expect(d.action).toBe('archive');
    expect(d.rule).toBe('eligible');
  });
});

// ---------------------------------------------------------------------------
// ★ כלל 1 + 2 — פסיקת מודל לעולם לא מארכבת
// ---------------------------------------------------------------------------

describe('★ כלל 1+2: רק המסנן הדטרמיניסטי מארכב', () => {
  it('★ ניסיון מפורש לארכב פריט `signal` — נדחה', () => {
    // המבחן שדורית ביקשה במפורש, והוא הטענה המרכזית של המודול.
    const d = decide(eligible({ filterVerdict: 'signal', filterReason: 'correspondent' }));
    expect(d.action).toBe('keep');
    expect(d.label).toBeNull();
  });

  it('`unknown` לא מאורכב — "אני לא יודע" אינו אישור', () => {
    const d = decide(eligible({ filterVerdict: 'unknown', filterReason: 'default' }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('notNoise');
  });

  it('★ המודל מבקש לארכב `signal` — נדחה, והנימוק אומר את זה במפורש', () => {
    const d = decide(
      eligible({ filterVerdict: 'signal', filterReason: 'threadSignal', agentSuggestsArchive: true }),
    );
    expect(d.action).toBe('keep');
    // הנימוק מבחין בין "לא עומד בכללים" לבין "לא עומד בכללים והמודל חלק".
    expect(d.reasonHe).toContain('לא מארכב על סמך מה שנראה לי');
  });

  it('★ המודל מתנגד לארכוב של רעש כשיר — ולזה אין השפעה', () => {
    // הכיוון ההפוך, ומכוון: פונקציה שהתנהגותה תלויה בפלט מודל אינה ניתנת
    // לשחזור, וזה מבטל את כל היתרון של "המסנן ניתן להסבר".
    const d = decide(eligible({ agentSuggestsArchive: false }));
    expect(d.action).toBe('archive');
  });

  it('★ פסק פנקס ממקור שאינו כותרות/משתמשת — לא מארכב', () => {
    // הדליפה שסקירת עדי מצאה: המסנן קורא את הפנקס, ולכן כתיבה לפנקס על
    // סמך פלט מודל הופכת פסיקת מודל לפסיקת מסנן בריצה הבאה.
    const d = decide(
      eligible({ filterReason: 'senderLedger', ledgerVerdictTrusted: false }),
    );
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('ledgerNotTrusted');
  });
});

// ---------------------------------------------------------------------------
// ★ כלל 3 — מארכבים, לא מוחקים
// ---------------------------------------------------------------------------

describe('★ כלל 3: מארכבים ולא מוחקים', () => {
  it('כל ארכוב נושא תווית ומסומן כניתן לשחזור', () => {
    const d = decide(eligible());
    expect(d.label).toBe(ARCHIVE_LABEL);
    expect(d.restorable).toBe(true);
  });

  it('★ אין בכלל פעולה שמשמעותה מחיקה', () => {
    // הבדיקה החזקה: לא "מחיקה לא קורית" אלא **אין לה שם**. כל החלטה שהמודול
    // יכול להחזיר היא אחת משתיים.
    const cases: ArchiveCandidate[] = [
      eligible(),
      eligible({ filterVerdict: 'signal' }),
      eligible({ userPinned: true }),
      eligible({ firstSeenInBriefAt: null, briefAppearances: 0 }),
      eligible({ looksLikeInvoice: true }),
      eligible({ hasAttachment: true }),
    ];
    for (const c of cases) {
      expect(['archive', 'keep']).toContain(decide(c).action);
    }
  });

  it('★ אין סימון כנקרא — ההכרעה כתובה ולא רק חסרה', () => {
    // `UNREAD` היא העקבה היחידה שנשארת אם ארכוב שגוי קרה.
    expect(NEVER_MARK_AS_READ).toBe(true);
  });

  it('כל התוויות מגיעות מ-allowlist, ואף אחת לא נבנית מתוכן המייל', () => {
    const labels = labelsFor({ filterVerdict: 'signal', looksLikeInvoice: true, actionRequired: true });
    for (const l of labels) expect(ALL_AGENT_LABELS).toContain(l);
  });
});

// ---------------------------------------------------------------------------
// ★ כלל 4 — חלון ההשהיה
// ---------------------------------------------------------------------------

describe('★ כלל 4: חלון ההשהיה', () => {
  it('פריט שטרם הופיע בדוח בוקר — לא מאורכב', () => {
    const d = decide(eligible({ firstSeenInBriefAt: null, briefAppearances: 0 }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('deferralWindow');
  });

  it('הופיע רק הבוקר — עדיין לא, ומוחזר מתי כן', () => {
    const d = decide(eligible({ firstSeenInBriefAt: THIS_MORNING, briefAppearances: 1 }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('deferralWindow');
    expect(d.eligibleAt).not.toBeNull();
  });

  it('חותמת זמן פגומה נחשבת "לא הופיע", ולא עוברת בטעות', () => {
    // כשל בטוח: קלט שאי אפשר לפרסר לא הופך לאישור.
    const d = decide(eligible({ firstSeenInBriefAt: 'לא-תאריך', briefAppearances: 3 }));
    expect(d.action).toBe('keep');
  });

  it('מונה הופעות אפס גובר על חותמת זמן ישנה', () => {
    const d = decide(eligible({ firstSeenInBriefAt: YESTERDAY_BRIEF, briefAppearances: 0 }));
    expect(d.action).toBe('keep');
  });
});

// ---------------------------------------------------------------------------
// ★ כללים 5–9 — מה שסקירת עדי הוסיפה
// ---------------------------------------------------------------------------

describe('★ כלל 5: מועמד חשבונית', () => {
  it('כל מה שנוגע בכסף נשאר, גם כשהמסנן קבע רעש', () => {
    const d = decide(eligible({ looksLikeInvoice: true }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('invoiceCandidate');
  });
});

describe('★ כלל 6: קובץ מצורף', () => {
  it('מייל עם קובץ מצורף לא מאורכב לעולם', () => {
    // הקלט של המסנן נשלט בידי השולח — `List-Unsubscribe` היא שורת טקסט
    // שכל אחד יכול להוסיף. קובץ מצורף יקר בהרבה לזייף.
    const d = decide(eligible({ hasAttachment: true }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('hasAttachment');
  });

  it('★ מייל הונאה עם כותרות דיוור מזויפות וקובץ — נחסם', () => {
    const d = decide(
      eligible({
        fromDomain: 'tashlum-mehir.example',
        filterVerdict: 'noise',
        filterReason: 'bulkHeaders',
        hasAttachment: true,
      }),
    );
    expect(d.action).toBe('keep');
  });
});

describe('★ כלל 7: דומיין שהתכתבנו איתו', () => {
  it('חסין לארכוב גם כשההודעה עצמה נראית כמו דיוור', () => {
    const d = decide(eligible({ isCorrespondentDomain: true }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('correspondent');
  });
});

describe('★ כלל 8: החסינות היא ברמת השרשור', () => {
  it('תשובה אוטומטית בתוך שיחה פתוחה לא מאורכבת', () => {
    // `Auto-Submitted` מפיל אותה לרעש בצדק; ארכוב היה מעלים את השיחה
    // מהעין באמצע.
    const d = decide(eligible({ threadActive: true }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('threadActive');
  });
});

describe('★ כלל 9: רשויות, בנקים וגופים ממשלתיים', () => {
  it('מייל מרשות לא מאורכב — מועד שנשרף אי אפשר להחזיר', () => {
    const d = decide(eligible({ isInstitutional: true }));
    expect(d.action).toBe('keep');
    expect(d.rule).toBe('institutional');
  });

  it('זיהוי הדומיין דטרמיניסטי', () => {
    expect(isInstitutionalDomain('mail.gov.il')).toBe(true);
    expect(isInstitutionalDomain('btl.example')).toBe(true);
    expect(isInstitutionalDomain('leumi-bank.example')).toBe(true);
    expect(isInstitutionalDomain('dealim-hayom.example')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ★★ מפסק הזרם
// ---------------------------------------------------------------------------

describe('★★ מפסק זרם — הבקרה שאף כלל פרטני לא נותן', () => {
  const many = (n: number): ArchiveCandidate[] =>
    Array.from({ length: n }, (_, i) => eligible({ itemId: `m-${i}` }));

  it('ריצה רגילה עוברת', () => {
    const plan = planArchiveRun(many(10), { now: NOW, maxArchiveRatio: 1 });
    expect(plan.tripped).toBe(false);
    expect(plan.toArchive).toHaveLength(10);
  });

  it('★ חריגה מהתקרה עוצרת את **כל** הריצה, לא רק את העודף', () => {
    // ארכוב חלקי הוא הגרוע משני העולמות: לא מונע את הנזק, ומקשה לאתר אותו.
    const plan = planArchiveRun(many(60), { now: NOW, maxArchivesPerRun: 40, maxArchiveRatio: 1 });
    expect(plan.tripped).toBe(true);
    expect(plan.toArchive).toHaveLength(0);
    expect(plan.heldForApproval).toHaveLength(60);
  });

  it('★ אחוז חריג יורה גם כשהמספר המוחלט קטן', () => {
    // 40 מתוך 4,000 הוא מספר תקין בריצה חריגה; 9 מתוך 10 הוא ההפך.
    const plan = planArchiveRun(many(9), { now: NOW, maxArchivesPerRun: 40, maxArchiveRatio: 0.75 });
    expect(plan.tripped).toBe(true);
    expect(plan.toArchive).toHaveLength(0);
  });

  it('כשהמפסק יורה, ההחלטה על כל פריט מוחלפת ומסבירה למה', () => {
    const plan = planArchiveRun(many(60), { now: NOW, maxArchivesPerRun: 40, maxArchiveRatio: 1 });
    const d = plan.decisions.get('m-0');
    expect(d?.action).toBe('keep');
    expect(d?.rule).toBe('runCapExceeded');
    expect(d?.reasonHe).toContain('לא נגעתי בכלום');
  });
});

// ---------------------------------------------------------------------------
// ★ החזרה — הבקרה החשובה ביותר
// ---------------------------------------------------------------------------

describe('★ החזרה בלחיצה אחת', () => {
  it('פריט שאורכב וסומן "להשאיר" — לא יאורכב שוב, גם בריצות הבאות', () => {
    const before = eligible();
    expect(decide(before).action).toBe('archive');

    const after = restoreArchived(before);
    expect(decide(after).action).toBe('keep');
    expect(decide(after).rule).toBe('userPinned');
  });

  it('★ ההחזרה עומדת גם כשכל שאר הראיות אומרות "רעש"', () => {
    // זה מה שהופך אותה לאמינה: לחיצה אחת, ולא "החזרתי ומחר זה ירד שוב".
    const pinned = restoreArchived(
      eligible({ filterVerdict: 'noise', filterReason: 'senderLedger', briefAppearances: 99 }),
    );
    expect(decide(pinned).action).toBe('keep');
  });
});

// ---------------------------------------------------------------------------
// דוח שבועי
// ---------------------------------------------------------------------------

describe('דוח שבועי — לראות גם אחרי, לא רק לפני', () => {
  const records = [
    { itemId: 'a', fromDomain: 'dealim-hayom.example', archivedAt: '2026-08-24T05:30:00+03:00', reasonHe: '' },
    { itemId: 'b', fromDomain: 'dealim-hayom.example', archivedAt: '2026-08-23T05:30:00+03:00', reasonHe: '' },
    { itemId: 'c', fromDomain: 'tech-weekly.example', archivedAt: '2026-08-22T05:30:00+03:00', reasonHe: '' },
    { itemId: 'old', fromDomain: 'tech-weekly.example', archivedAt: '2026-07-01T05:30:00+03:00', reasonHe: '' },
  ];

  it('סופר רק את החלון, ומקבץ לפי דומיין', () => {
    const r = weeklyArchiveReport(records, { now: NOW });
    expect(r.total).toBe(3);
    expect(r.byDomain[0]).toEqual({ domain: 'dealim-hayom.example', count: 2 });
  });

  it('הניסוח בגוף ראשון ומבטיח את ההחזרה במפורש', () => {
    const r = weeklyArchiveReport(records, { now: NOW });
    expect(r.summaryHe).toContain('להחזיר');
  });

  it('שבוע ריק אומר את זה בעברית, ולא מציג אפס', () => {
    expect(weeklyArchiveReport([], { now: NOW }).summaryHe).toContain('לא הוצאתי');
  });
});
