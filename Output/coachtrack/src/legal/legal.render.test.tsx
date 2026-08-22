/**
 * טסטים לתשתית המסמכים המשפטיים.
 *
 * מה שנבדק כאן הוא **נאמנות**, לא עיצוב: המסמך שעדי כותבת חייב להגיע למסך
 * כפי שנוסח — כולל `[[placeholders]]` שטרם מולאו וכולל ⚖️. מסמך שנראה מוגמר
 * בזמן שהוא לא, או ניסוח שהרנדרר "ניקה" בדרך, הם בדיוק סוג הכשל שהשער המשפטי
 * נועד למנוע.
 *
 * בנוסף נבדק שהרנדרר אינו פותח וקטור הזרקה: אין `dangerouslySetInnerHTML`,
 * ולכן HTML בתוך מסמך מוצג כטקסט.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown';
import { LegalModal } from './LegalModal';
import { LEGAL_DOCS } from './docs';
import { he } from '../i18n/he';

describe('רנדרר ה-Markdown — נאמנות לניסוח', () => {
  it('כותרות, פסקאות ורשימות הופכות לתגים הנכונים', () => {
    const html = renderToStaticMarkup(
      <Markdown source={'# כותרת\n\nפסקה ראשונה.\n\n## סעיף\n\n- פריט אחד\n- פריט שני\n'} />,
    );
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<ul');
    expect(html.match(/<li/g) ?? []).toHaveLength(2);
    expect(html).toContain('פסקה ראשונה.');
  });

  it('מציין מקום שלא מולא נשאר גלוי — מסמך חלקי לא ייראה מוגמר', () => {
    const html = renderToStaticMarkup(<Markdown source={'פנייה: [[דוא"ל]]. נענה בתוך [[מספר]] ימים.'} />);
    expect(html).toContain('[[דוא&quot;ל]]');
    expect(html).toContain('[[מספר]]');
  });

  it('סימון ⚖️ של עדי עובר כמו שהוא', () => {
    const html = renderToStaticMarkup(<Markdown source={'⚖️ סעיף שדורש בדיקת עורך דין.'} />);
    expect(html).toContain('⚖️');
  });

  it('HTML בתוך מסמך מוצג כטקסט ולא רץ', () => {
    const html = renderToStaticMarkup(<Markdown source={'<script>alert(1)</script>'} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('שורות רצופות של ציטוט מתאחדות לבלוק אחד', () => {
    const html = renderToStaticMarkup(<Markdown source={'> שורה ראשונה\n> שורה שנייה\n'} />);
    expect(html.match(/<blockquote/g) ?? []).toHaveLength(1);
  });
});

describe('מדיניות הפרטיות — המסמך שנטען', () => {
  it('נטען מקובץ ה-md, אינו ריק, ומתחיל בכותרת', () => {
    // ⚠️ בכוונה **לא** נועלים את נוסח הכותרת. עדי היא הבעלים של הניסוח, וטסט
    // שמקבע מילים שלה יישבר בכל סבב עריכה משפטית ויידחוף מישהו "לתקן" את
    // המסמך כדי לרצות את הטסט. מה שכן חייב להישמר: שהקובץ נטען ושיש בו מבנה.
    expect(LEGAL_DOCS.privacy.source.trim().length).toBeGreaterThan(0);
    expect(LEGAL_DOCS.privacy.source.trimStart()).toMatch(/^# .+/);
  });

  it('המסמך מרונדר במלואו ובזמן סביר — שומר מפני לולאה אינסופית', () => {
    // הרנדרר נתקע בפועל על כותרת '### ' והפיל worker עם 4GB heap. המסמך
    // האמיתי מכיל כותרות כאלה; ה-placeholder לא הכיל, ולכן הבאג היה נסתר
    // עד שהוחלף התוכן. הטסט מרנדר את המסמך **האמיתי** ולא דוגמה מומצאת.
    const started = Date.now();
    const html = renderToStaticMarkup(<Markdown source={LEGAL_DOCS.privacy.source} />);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(html.length).toBeGreaterThan(1000);
  });

  it('המודאל מציג את תוכן המסמך, עם כותרת ותפקיד dialog', () => {
    const html = renderToStaticMarkup(<LegalModal docId="privacy" onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(he.auth.signIn.privacyLink);
    expect(html).toContain(he.common.close);
    expect(html).toContain('מדיניות פרטיות');
  });

  it('המסמך זמין בלי משתמש מחובר — הוא נצרב ל-build ולא נשלף מהמסד', () => {
    // זו הסיבה שאפשר לפתוח אותו ממסך ההתחברות: `?raw` בזמן build, לא Firestore.
    expect(typeof LEGAL_DOCS.privacy.source).toBe('string');
  });
});
