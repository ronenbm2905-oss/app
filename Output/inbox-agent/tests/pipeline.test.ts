// ============================================================================
// pipeline.test.ts — הצינור מקצה לקצה, על ה-fixture האמיתי שהאפליקציה טוענת.
//
// המבחנים בשני הקבצים האחרים בודקים כל מודול בבידוד. כאן נבדקת הטענה שהמסך
// עצמו מציג: שהסדר מייצר את החלוקה הנכונה, ושהפריטים שנועדו להדגים כל ענף
// אכן נוחתים איפה שתוכנן. מבחן כזה תופס בדיוק את הכשל שבדיקת יחידה מפספסת —
// שני מודולים נכונים שחוברו בסדר הלא נכון.
// ============================================================================

import { describe, expect, it } from 'vitest';
import fixture from '../src/fixtures/inbox.sample.json';
import { levelOf, quickActionsBlocked, runPipeline, type InboxFixture } from '../src/utils/pipeline';
import {
  SENSITIVE_SUBJECT_PLACEHOLDER,
  SENSITIVE_SUMMARY_PLACEHOLDER,
} from '../shared/lib/redactSensitive';
import { isClassified, type ClassifiedItem, type TriageItem } from '../shared/types';

const result = runPipeline(fixture as unknown as InboxFixture);

const byId = (id: string): TriageItem => {
  const item = result.items.find((x) => x.id === id);
  if (!item) throw new Error(`אין פריט ${id} ב-fixture`);
  return item;
};

/** גישה לפריט מסווג. זורק אם הפריט הוא רעש — כלומר גם זה מבחן. */
const classified = (id: string): ClassifiedItem => {
  const item = byId(id);
  if (!isClassified(item)) throw new Error(`${id} סווג כרעש, ולכן אין לו כותרת או סוכן`);
  return item;
};

describe('ה-fixture עצמו', () => {
  it('כל הכתובות הן .example — אין דומיין שאפשר לשלוח אליו דואר', () => {
    // הריפו ציבורי. `.example` שמור ב-RFC 2606 ולעולם לא יירשם, ולכן גם
    // העתקה שגויה של הקובץ לא יכולה להגיע לאדם אמיתי.
    for (const m of (fixture as unknown as InboxFixture).messages) {
      expect(m.fromAddress).toMatch(/\.example$/);
    }
  });

  it('כל פריט קיבל פסק דין, ואף אחד לא נשאר בלי סיבה', () => {
    expect(result.items).toHaveLength(42);
    for (const item of result.items) {
      expect(['signal', 'unknown', 'noise']).toContain(item.verdict);
      expect(item.reasonHe.length).toBeGreaterThan(0);
    }
  });
});

describe('הסינון עובד — וזה כל הרווח', () => {
  it('רוב מוחלט של התיבה נעצר לפני המודל', () => {
    expect(result.stats.fetched).toBe(42);
    expect(result.stats.filterRate).toBeGreaterThan(0.65);
    expect(result.stats.filteredOut + result.stats.llmCalls).toBe(result.stats.fetched);
  });

  it('פריט שסונן לא נשלח למודל ולא נשמר לו גוף', () => {
    // הטענה התפעולית במלואה: אפס טוקנים, ואפילו לא ניקוי.
    for (const item of result.items.filter((x) => !isClassified(x))) {
      expect(result.bodies.has(item.id)).toBe(false);
    }
  });

  it('מספר קריאות המודל שווה למספר הפריטים עם גוף מנוקה', () => {
    expect(result.bodies.size).toBe(result.stats.llmCalls);
  });
});

// ===========================================================================
describe('★ מזעור — פריט רעש לא נושא כותרת ולא כתובת', () => {
  // התיקון שעלה בסקירת עדי. זה הטיעון המשפטי החזק ביותר שיש למוצר והוא עולה
  // אפס: ~90% מהכותרות בתיבה פשוט לא נכתבות לשום מקום, לעולם.
  const noiseItems = result.items.filter((x) => !isClassified(x));

  it('יש בכלל פריטי רעש לבדוק', () => {
    expect(noiseItems.length).toBeGreaterThan(20);
  });

  it('אין להם subject, fromAddress, fromName, agent או summaryHe', () => {
    for (const item of noiseItems) {
      const keys = Object.keys(item);
      expect(keys).not.toContain('subject');
      expect(keys).not.toContain('fromAddress');
      expect(keys).not.toContain('fromName');
      expect(keys).not.toContain('agent');
      expect(keys).not.toContain('summaryHe');
      expect(keys).not.toContain('handled');
    }
  });

  it('הם כן נושאים fromDomain — הפנקס חייב אותו, ודומיין אינו אדם', () => {
    for (const item of noiseItems) {
      expect(item.fromDomain).toBeTruthy();
      expect(item.fromDomain).not.toContain('@');
    }
  });

  it('גם ה-reasonHe שלהם לא מדליף כתובת או כותרת', () => {
    // דלת אחורית קלאסית: הסבר ידידותי בנוסח "סוננה ההודעה ׳מבצע סוף עונה׳
    // מ-x@y" היה מחזיר בדיוק את מה שהמבנה מונע.
    for (const item of noiseItems) {
      expect(item.reasonHe).not.toContain('@');
      const subjects = (fixture as unknown as InboxFixture).messages.map((m) => m.subject);
      for (const s of subjects) expect(item.reasonHe).not.toContain(s);
    }
  });

  it('הסכימה של פריט רעש היא בדיוק השדות שאושרו', () => {
    // רשימה סגורה. שדה חדש שיתווסף — גם אם הוא נראה תמים — יפיל את המבחן
    // וידרוש החלטה מפורשת, ולא יחליק פנימה בעדכון של פיצ'ר אחר.
    const expected = [
      'userId',
      'id',
      'threadId',
      'receivedAt',
      'fromDomain',
      'reason',
      'reasonHe',
      'purgeAfter',
      'createdAt',
      'updatedAt',
      'verdict',
    ].sort();
    for (const item of noiseItems) {
      expect(Object.keys(item).sort()).toEqual(expected);
    }
  });
});

describe('שום פריט לא נושא תוכן מייל', () => {
  it('גם לפריט מסווג אין body/snippet/נמענים', () => {
    // העיקרון "מצביעים ונגזרות, לא תוכן", נבדק ולא מוצהר. אם מישהו יוסיף
    // `snippet` לנוחות התצוגה, המבחן ייפול לפני שהשדה יגיע לענן.
    for (const item of result.items) {
      const keys = Object.keys(item);
      expect(keys).not.toContain('bodyHtml');
      expect(keys).not.toContain('body');
      expect(keys).not.toContain('snippet');
      expect(keys).not.toContain('to');
      expect(keys).not.toContain('cc');
    }
  });

  it('לכל פריט יש purgeAfter — מדיניות המחיקה קיימת כשדה, לא כהצהרה', () => {
    for (const item of result.items) {
      expect(new Date(item.purgeAfter).getTime()).toBeGreaterThan(
        new Date(item.receivedAt).getTime(),
      );
    }
  });
});

describe('★ הענפים שה-fixture נועד להדגים', () => {
  it('(א) לקוחה בדומיין שמסומן רעש — סיגנל, בזכות ההתכתבות הקודמת', () => {
    // `nadlan-plus.example` הוא דומיין הרעש הגדול ביותר בתיבה (214 הודעות),
    // ובכל זאת נועה נמצאת ב"נשלחו" ולכן היא לא נעלמת.
    const noa = classified('m-006');
    expect(noa.fromDomain).toBe('nadlan-plus.example');
    expect(noa.verdict).toBe('signal');
    expect(noa.reason).toBe('correspondent');

    // ובאותה נשימה: דיוור מאותו דומיין בדיוק כן נקבר.
    expect(byId('m-013').verdict).toBe('noise');
    expect(byId('m-013').fromDomain).toContain('nadlan-plus.example');
  });

  it('(ב) דיוור עם "הצעת מחיר" בנושא עולה ל-unknown — ולא ל-signal', () => {
    const promo = classified('m-010');
    expect(promo.reason).toBe('keywordPromoted');
    expect(promo.verdict).toBe('unknown');
    expect(levelOf(promo)).toBe('review');
  });

  it('התראת כלי שיתוף שורדת את הסינון בזכות neverAutoNoise', () => {
    const share = classified('m-004');
    expect(share.reason).toBe('neverAutoNoise');
    expect(share.agent).not.toBeNull();
  });

  it('הוראת משתמש מפורשת קוברת גם נושא שנשמע רלוונטי', () => {
    const webinar = byId('m-012');
    expect(webinar.reason).toBe('userRule');
    expect(webinar.verdict).toBe('noise');
  });

  it('Reply-To לכתובת מוכרת מציל מייל עם כותרות דיוור', () => {
    expect(byId('m-041').reason).toBe('correspondent');
  });
});

describe('★ שדות הבטיחות מגיעים עד המסך', () => {
  it('הזרקה מוסתרת מדליקה needsHumanReview — למרות שהטקסט עצמו נמחק', () => {
    // הנקודה העדינה: הסניטייזר הסיר את ההוראה, ולכן המודל לא ראה אותה
    // מעולם. הדגל נדלק מהעובדה שהיה שם בלוק מוסתר, לא מהתוכן שלו.
    const injected = classified('m-008');
    expect(injected.agent?.needsHumanReview).toBe(true);
    expect(result.bodies.get('m-008')).not.toContain('התעלם');
    expect(quickActionsBlocked(injected)).toBe(true);
  });

  it('פישינג — תשלום + פרטי גישה → פעולות מהירות מושבתות', () => {
    const phish = classified('m-009');
    expect(phish.agent?.mentionsPayment).toBe(true);
    expect(phish.agent?.requestsCredentials).toBe(true);
    expect(quickActionsBlocked(phish)).toBe(true);
    // הקישור לא שרד את הניקוי, ולכן אין ממנו ערוץ החוצה.
    expect(result.bodies.get('m-009')).not.toContain('secure-pay-notice.example');
  });

  it('★ מידע רגיש — נדרסים גם הסיכום וגם הכותרת', () => {
    // החור שסקירת עדי מצאה: הגרסה הראשונה דרסה את הסיכום בלבד, בעוד שכותרת
    // המייל היא המקום שבו מידע רגיש מנוסח הכי מפורש — והיא יושבת לצד
    // `fromAddress` שאומר על מי מדובר.
    const sensitive = classified('m-011');
    expect(sensitive.agent?.containsSensitive).toBe(true);
    expect(sensitive.agent?.summaryHe).toBe(SENSITIVE_SUMMARY_PLACEHOLDER);
    expect(sensitive.subject).toBe(SENSITIVE_SUBJECT_PLACEHOLDER);

    // הכותרת המקורית לא שרדה בשום שדה של הפריט הנשמר.
    const original = (fixture as unknown as InboxFixture).messages.find(
      (m) => m.messageId === 'm-011',
    )!.subject;
    expect(JSON.stringify(sensitive)).not.toContain(original);

    // ...ובלי משימה מוצעת: כותרת משימה היא ניסוח חופשי של אותו תוכן, והיא
    // הייתה מדליפה אותו הלאה גם ללוח המשימות וגם ליומן.
    expect(sensitive.agent?.suggestedTaskTitle).toBeNull();
  });

  it('פריט חשוד לא מקבל 🔴 — הוא מקבל 🟡 עם תג אדום', () => {
    // 🔴 שמור לעניין אמיתי שממתין לתשובה. אם נמלא אותו בהתראות פישינג הוא
    // יאבד את המשמעות שלו, והמשמעות הזאת היא כל המוצר.
    expect(levelOf(byId('m-009'))).toBe('review');
    expect(levelOf(byId('m-008'))).toBe('review');
  });
});

describe('חלוקה לשלוש הרמות', () => {
  it('כל רמה מאוכלסת, ורעש הוא תמיד ⚪', () => {
    const counts = { action: 0, review: 0, noise: 0, order: 0 };
    for (const item of result.items) counts[levelOf(item)]++;

    expect(counts.action).toBeGreaterThan(0);
    expect(counts.review).toBeGreaterThan(0);
    expect(counts.noise).toBeGreaterThan(0);
    expect(counts.action + counts.review + counts.noise).toBe(42);

    for (const item of result.items.filter((x) => x.verdict === 'noise')) {
      expect(levelOf(item)).toBe('noise');
    }
  });

  it('הפניות שממתינות לתשובה נוחתות ב-🔴', () => {
    expect(levelOf(byId('m-003'))).toBe('action'); // רו״ח, חסרות חשבוניות היום
    expect(levelOf(byId('m-005'))).toBe('action'); // תזכורת שנייה, לא קיבלה מענה
  });
});

describe('דטרמיניזם', () => {
  it('שתי ריצות על אותו קלט מייצרות אותה תוצאה', () => {
    // מוק אקראי היה הופך כל מבחן כאן ל"רץ בדרך כלל", וזה גרוע מאין מבחן.
    const a = runPipeline(fixture as unknown as InboxFixture);
    const b = runPipeline(fixture as unknown as InboxFixture);
    const strip = (r: typeof a) =>
      r.items.map((i) => ({
        id: i.id,
        verdict: i.verdict,
        reason: i.reason,
        agent: isClassified(i) ? i.agent : null,
      }));
    expect(strip(a)).toEqual(strip(b));
    expect(a.stats).toEqual(b.stats);
  });
});
