// ============================================================================
// render.test.tsx — smoke test של עץ הרכיבים.
//
// `renderToString` ולא דפדפן: הוא לא דורש DOM ולא jsdom, ובכל זאת מריץ את
// כל הרכיבים באמת — כולל הצינור, הדירוג לשלוש הרמות והתרגום. הוא תופס את
// הכשלים שמפילים מסך לבן (חריגה ברינדור, `undefined` שנקרא כאובייקט,
// טיפוס שהשתנה ורכיב שלא עודכן), וזה רוב מה שמפיל מסך.
//
// מה שהוא **לא** בודק: פריסה, RTL בפועל, ולחיצות. אלה נבדקים בדפדפן.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MorningBriefView } from '../src/components/MorningBriefView';
import { runPipeline, type InboxFixture } from '../src/utils/pipeline';
import fixture from '../src/fixtures/inbox.sample.json';

const result = runPipeline(fixture as unknown as InboxFixture);

const html = renderToString(
  <MorningBriefView
    items={result.items}
    bodies={result.bodies}
    stats={result.stats}
    canEdit
    onCreateTask={() => {}}
    onToggleHandled={() => {}}
  />,
);

describe('דוח הבוקר מתרנדר', () => {
  it('שלוש הרמות מופיעות על המסך', () => {
    expect(html).toContain('מחכה לך');
    expect(html).toContain('שווה שתציצי');
    // ★ 'פרסומות ועדכונים' ולא 'רעש': 'רעש' הוא המונח שלנו. היא לא חושבת
    // על התיבה שלה במונחי אות ורעש — היא חושבת 'פרסומות'.
    expect(html).toContain('פרסומות ועדכונים');
  });

  it('הספירות מוצגות — בשפה שלה, לא בשפה שלנו', () => {
    // הניסוח נכתב מחדש בפרוסה 0.5. 'סוננו לפני המודל' ו'נשלחו לסיווג' היו
    // כתובים לנו: המשתמשת לא צריכה לדעת מה זה מודל, ולא אכפת לה מטוקנים.
    expect(html).toContain('כמה מהתיבה זה פרסומות');
    expect(html).toContain('כדאי שתראי');
    expect(html).toContain(String(result.stats.filteredOut));
  });

  it('התג האדום של "דורש בדיקה אנושית" מגיע למסך', () => {
    expect(html).toContain('כדאי שתפתחי את המייל');
  });

  it('ההסבר על פעולות מושבתות מוצג ליד פריט חסום', () => {
    expect(html).toContain('כדאי לפתוח את המייל עצמו');
    // וגם הכפתור עצמו מסומן `disabled` ולא מוסתר.
    expect(html).toContain('disabled');
  });

  it('★ קבוצת הרעש מקופלת — הפריטים לא ברשומון הראשוני', () => {
    // המספר גלוי (אמון), הפריטים לא (רעש). זו ההכרעה שבבסיס המסך.
    expect(html).toContain('להראות מה יש שם');
  });

  it('★ שום כותרת של פריט רעש לא מגיעה ל-HTML', () => {
    // הבדיקה החזקה: לא "לא מוצג" אלא **לא קיים**. הכותרות האלה לא נשמרו
    // בפריט מלכתחילה, ולכן אין דרך שהן יופיעו — גם אם מישהו יפתח את הקבוצה.
    const noiseSubjects = (fixture as unknown as InboxFixture).messages
      .filter((m) => result.items.some((i) => i.id === m.messageId && i.verdict === 'noise'))
      .map((m) => m.subject);

    expect(noiseSubjects.length).toBeGreaterThan(20);
    for (const subject of noiseSubjects) {
      expect(html).not.toContain(subject);
    }
  });

  it('כותרת של פריט מסווג כן מוצגת', () => {
    expect(html).toContain('מקדמות מע');
  });
});
