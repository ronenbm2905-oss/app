// ============================================================================
// ExplainerScreen.tsx — ★ מה שהיא קוראת לפני שהיא מחברת את הכלי לתיבה.
//
// ---------------------------------------------------------------------------
// ★★ הנוסח כאן מאושר, ולא נכתב על ידי
// ---------------------------------------------------------------------------
// כל מילה במסך הזה מגיעה מסעיף **8ב.4** בסקירה של עדי
// (`adi/Outputs/2026-08-25-inbox-agent-privacy-by-design.md`). המחרוזות יושבות
// ב-`src/i18n.ts` תחת `explainer*`, ושם גם רשומות שלוש החלטות הניסוח שסומנו
// "לא ישופרו בחזרה". **שינוי נוסח כאן = לחזור לעדי**, לא לשפר בדרך.
//
// ---------------------------------------------------------------------------
// למה המסך הזה קיים לפני שיש בכלל חיבור
// ---------------------------------------------------------------------------
// מסך הסבר שנכתב **אחרי** שהחיבור עובד נכתב תמיד כדי לעבור את המסך — הוא
// מרגיע, הוא קצר, והוא מנוסח כך שילחצו "המשך". כשכותבים אותו לפני, אפשר עוד
// לומר בו דברים לא נוחים.
//
// ---------------------------------------------------------------------------
// ★ שלושת החלקים, ולמה הסדר הזה
// ---------------------------------------------------------------------------
//  1. **מה הכלי עושה** — בלי זה אין לה על מה להסתמך כשתשווה בין מה שהובטח
//     לבין מה שקורה.
//
//  2. **מה שחשוב שתדעי לפני שאת מאשרת** — ההרשאה היא לכל התיבה, Google לא
//     מציעה צרה מזו, ו**מה שמצמצם את זה בפועל הוא התוכנה ורונן, לא Google**.
//     המשפט השלישי הוא זה שמשמיטים, וזה המשפט שההסכמה עומדת עליו: בלעדיו
//     היא תניח ש-Google אוכפת את הצמצום ותסכים על סמך הנחה שגויה. הוא גם מה
//     שמצדיק את מונה הקריאה שבמסך ההזמנות.
//
//  3. **אזהרת ה"אפליקציה לא מאומתת" — ומיד אחריה החיסון.** אנחנו עומדים
//     לומר לה "תלחצי מתקדם והמשך", וזה בדיוק ההרגל שדיוג מנצל. לכן החלק
//     האחרון אינו מרגיע אלא **מלמד הבחנה שהיא יכולה לבצע**: לא "איך מזהים
//     אתר מזויף" (היא לא תזהה), אלא "רונן לא ביקש ממני עכשיו".
//
// ---------------------------------------------------------------------------
// ★ הכפתור אומר את האמת על עצמו
// ---------------------------------------------------------------------------
// אין כאן חיבור לגוגל, ולכן אין כאן כפתור "התחברות עם Google" — גם לא מושבת
// ולא "בקרוב". כפתור חיבור שלא מחבר מלמד בדיוק את ההרגל ההפוך ממה שהמסך
// הזה מנסה ללמד: שכפתור התחברות הוא עוד שלב שעוברים.
// ============================================================================

import type { ReactNode } from 'react';
import { t } from '../i18n';

export interface ExplainerScreenProps {
  /** ממשיכה הלאה. במצב ההדגמה זה כל מה שקורה — אין מה לאשר. */
  onContinue: () => void;
  /**
   * המסך נפתח מחדש מתוך הרשימה, ולא כמסך ראשון.
   * משנה רק את תווית הכפתור: "חזרה לרשימה" ולא "הבנתי".
   */
  reopened?: boolean;
}

export function ExplainerScreen({ onContinue, reopened = false }: ExplainerScreenProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">{t('explainerTitle')}</h2>

      <Section title={t('explainerWhatTitle')}>
        <P>{t('explainerWhatBody')}</P>
      </Section>

      {/* ★★ ההרשאה. מסגרת בולטת ולא פסקה בתוך רצף — הפער בין היקף ההרשאה
          להיקף השימוש הוא הדבר שאסור שייבלע. */}
      <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
        <h3 className="text-base font-bold text-amber-950">{t('explainerScopeTitle')}</h3>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-amber-950">
          <P>{t('explainerScopeBody1')}</P>
          <P>{t('explainerScopeBody2')}</P>
          <P>{t('explainerScopeBody3')}</P>
          <P>{t('explainerScopeBody4')}</P>
        </div>
      </section>

      <Section title={t('explainerWarningTitle')}>
        <P>{t('explainerWarningBody1')}</P>
        <P className="mt-2">{t('explainerWarningBody2')}</P>
      </Section>

      {/* ★★ החיסון. מסגרת כהה, כדי שזה יהיה הדבר שנשאר בעין. */}
      <section className="rounded-xl border-2 border-slate-900 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">{t('explainerRuleTitle')}</h3>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-900">
          <P>{t('explainerRuleBody1')}</P>
          <P>{t('explainerRuleBody2')}</P>
          <P>{t('explainerRuleBody3')}</P>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">{t('explainerNoConnectionNote')}</p>

      <button
        type="button"
        onClick={onContinue}
        className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
      >
        {reopened ? t('explainerClose') : t('explainerContinue')}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

/**
 * ★ פסקה שמכבדת את ההדגשות של הנוסח המאושר.
 *
 * הנוסח של עדי מסמן חלקים ב-`**...**`, וההדגשות שם אינן קישוט: "ההרשאה
 * שתינתן היא לכל התיבה שלך" ו"אם התוכנה תשתנה — היא תוכל לקרוא הכול" הם
 * בדיוק המשפטים שנבלעים כשהכול נראה אותו דבר. הרינדור כאן שומר עליהן בלי
 * להכניס Markdown שלם לאפליקציה.
 *
 * מספר אי-זוגי של מפרידים פירושו הדגשה לא סגורה — במקרה כזה הטקסט מוצג
 * כמות שהוא, כדי שתקלת ניסוח לא תבלע חצי משפט.
 */
function P({ children, className }: { children: string; className?: string }) {
  const parts = children.split('**');
  const balanced = parts.length % 2 === 1;

  return (
    <p className={className}>
      {balanced
        ? parts.map((part, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-bold">
                {part}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            ),
          )
        : children}
    </p>
  );
}
