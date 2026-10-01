// ============================================================================
// reconcileScreen.test.tsx — מסך השוואת הדוחות: **מה כתוב, ובאיזה סדר.**
//
// ---------------------------------------------------------------------------
// למה סדר הקבוצות הוא מבחן ולא עניין של טעם
// ---------------------------------------------------------------------------
// היא לא פותחת את המסך הזה כדי לראות ש-200 עסקאות תקינות. היא פותחת אותו
// כדי למצוא את השלוש שלא. הסדר — קודם מה שלא הצליח להתאים, אחר כך פערים
// חריגים, ורק בסוף התקין ומקופל — הוא כל ההבדל בין מסך שעונה לשאלה שלה
// לבין מסך שדורש ממנה לגלול כדי להגיע אליה.
//
// סדר נשחק בשקט: מישהו יוסיף סעיף למעלה כי "ככה נוח לקרוא את הקוד", ואף
// אחד לא יפתח את המסך בעברית כדי לבדוק. מבחן על מיקום בטקסט המרונדר הוא
// הדבר היחיד שתופס את זה.
//
// ★ וגם מבחן השפה, באותה רוח כמו `tests/screens.test.tsx`: מונח פנימי
// שדולף למסך הוא לא אי-נוחות אלא כשל — הוא גורם לה להפסיק לקרוא ולנחש.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ReconcileResultView, ReconcileView } from '../src/components/ReconcileView';
import { reconcile } from '../shared/lib/reconcile';
import { buildReconcileCsv } from '../shared/lib/reconcileCsv';
import {
  SOURCE_HE,
  SOURCE_HE_BARE,
  toAgorot,
  type SettlementReport,
  type SettlementRow,
} from '../shared/lib/settlement';
import { t } from '../src/i18n';

// --- נתונים מסונתזים בלבד. אין כאן שם, אין כרטיס, ואין ח.פ. ------------------

function row(rowIndex: number, date: string, shekels: number, reference: string | null = null): SettlementRow {
  return { rowIndex, date, amount: toAgorot(shekels), reference, label: null };
}

const tranzila: SettlementReport = {
  source: 'tranzila',
  rows: [
    row(1, '2026-08-02', 1000, 'REF-1'),
    row(2, '2026-08-05', 1200),
    row(3, '2026-08-09', 800),
    row(4, '2026-08-13', 1500),
    row(5, '2026-08-17', 2000),
    row(6, '2026-08-21', 950),
    // ★ זו השורה שחורגת מהדפוס — פער של ארבעה אחוזים במקום אחוז וחצי.
    row(7, '2026-08-25', 1000),
    // ★ וזו קיימת רק בצד אחד.
    row(8, '2026-08-28', 640),
  ],
  unreadableRows: [],
};

const gamma: SettlementReport = {
  source: 'gamma',
  rows: [
    row(1, '2026-08-03', 985, 'REF-1'),
    row(2, '2026-08-06', 1182),
    row(3, '2026-08-10', 788),
    row(4, '2026-08-14', 1477.5),
    row(5, '2026-08-18', 1970),
    row(6, '2026-08-22', 935.75),
    row(7, '2026-08-26', 960),
    row(9, '2026-09-04', 410),
  ],
  unreadableRows: [{ rowIndex: 12, reasonHe: 'לא הצלחתי לקרוא את הסכום בשורה הזאת' }],
};

const result = reconcile(tranzila, gamma);
const resultHtml = renderToString(
  <ReconcileResultView result={result} periodLabelHe="אוגוסט 2026" />,
);
const screenHtml = renderToString(<ReconcileView today="2026-09-29" />);

// ---------------------------------------------------------------------------

describe('★★ הבאנר — ההבטחה שעליה הפיצ׳ר עומד', () => {
  it('קיים על המסך, מילה במילה', () => {
    expect(screenHtml).toContain('הקבצים נשארים במחשב שלך. שום דבר מהם לא נשלח לשום מקום ולא נשמר בכלי — כשסוגרים את החלון, זה נעלם.');
  });

  it('★ והוא אותו משפט שיושב במילון — כדי שלא ישתנה בשני מקומות בנפרד', () => {
    expect(t('reconcilePrivacyBanner')).toBe(
      'הקבצים נשארים במחשב שלך. שום דבר מהם לא נשלח לשום מקום ולא נשמר בכלי — כשסוגרים את החלון, זה נעלם.',
    );
  });
});

describe('★★ סדר שלוש הקבוצות', () => {
  const unmatchedAt = resultHtml.indexOf(t('reconcileGroupUnmatched'));
  const unusualAt = resultHtml.indexOf(t('reconcileGroupUnusual'));
  const matchedAt = resultHtml.indexOf(t('reconcileGroupMatched'));

  it('שלושתן מופיעות', () => {
    expect(unmatchedAt).toBeGreaterThan(-1);
    expect(unusualAt).toBeGreaterThan(-1);
    expect(matchedAt).toBeGreaterThan(-1);
  });

  it('★★ מה שלא התאים → פער חריג → מה שהתאים. בדיוק בסדר הזה.', () => {
    expect(unmatchedAt).toBeLessThan(unusualAt);
    expect(unusualAt).toBeLessThan(matchedAt);
  });

  it('★ "מה שהתאים" מקופל כברירת מחדל', () => {
    // `<details>` בלי `open`. הקיפול הוא מה שמשאיר את מה שדורש פעולה גלוי
    // בלי גלילה — ולכן הוא נבדק, ולא נסמך על זה שאיש לא יוסיף `open`.
    expect(resultHtml).toContain('<details');
    expect(resultHtml).not.toContain('<details open');
  });

  it('שורת הסיכום מופיעה מעל שלוש הקבוצות', () => {
    // ⚠️ המחרוזת חייבת להיות כזו שבאמת קיימת בפלט. `indexOf` של מחרוזת
    //    חסרה מחזיר ‎-1‎, שקטן מכל דבר — כלומר המבחן היה "עובר" לנצח בלי
    //    לבדוק כלום. זה קרה כאן בפועל כשהניסוח תוקן ל"בדוח טרנזילה".
    const summaryAt = resultHtml.indexOf('דוח טרנזילה');
    expect(summaryAt).toBeGreaterThan(-1);
    expect(summaryAt).toBeLessThan(unmatchedAt);
  });
});

describe('שורת הסיכום', () => {
  it('כמה עסקאות בכל דוח, וכמה כסף', () => {
    expect(resultHtml).toContain('8 עסקאות');
    expect(resultHtml).toContain('סך הכול');
  });

  it('ההפרש בין שני הסכומים נאמר במפורש', () => {
    expect(resultHtml).toContain('ההפרש בין שני הסכומים');
  });

  it('★ שמות הדוחות הם השמות שהיא מכירה', () => {
    // ⇄ בתוצאה השם מופיע **אחרי תחילית** ("בדוח טרנזילה"), ולכן בצורה
    //    הנטולה. הצורה המלאה ("הדוח מטרנזילה") נשארת באזורי ההעלאה, שם היא
    //    עומדת לבדה — ונבדקת ב"מצב ההמתנה" למטה.
    expect(resultHtml).toContain('דוח טרנזילה');
    expect(resultHtml).toContain('דוח גמא');
  });
});

describe('הממצאים על המסך', () => {
  it('★ פער העמלה מוצג כעמלה, ולא כשגיאה', () => {
    expect(result.feePattern).not.toBeNull();
    expect(resultHtml).toContain('עמלת סליקה');
  });

  it('שורה שלא הצלחנו לקרוא — נאמר, ונאמר שהסכום לא כולל אותה', () => {
    expect(resultHtml).toContain('לא הצלחתי לקרוא');
    expect(resultHtml).toContain('לא כוללים אותן');
  });

  it('העסקאות החד-צדדיות מופיעות עם הדוח שבו הן נמצאות', () => {
    expect(result.onlyInA).toHaveLength(1);
    expect(result.onlyInB).toHaveLength(1);
    expect(resultHtml).toContain('מופיע רק ב');
  });
});

describe('מצב ההמתנה', () => {
  it('לפני שני קבצים — נאמר מה חסר, ולא מסך ריק', () => {
    expect(screenHtml).toContain('צריך את שני הדוחות');
  });

  it('שני אזורי העלאה מסומנים מי מה', () => {
    expect(screenHtml).toContain('הדוח מטרנזילה');
    expect(screenHtml).toContain('הדוח מגמא');
  });

  it('★ ברירת המחדל היא החודש שעבר, והיא מסומנת', () => {
    expect(screenHtml).toContain('החודש שעבר');
    expect(screenHtml).toContain('אוגוסט 2026');
    // הכפתור הפעיל מסומן גם לקורא מסך, ולא רק בצבע.
    expect(screenHtml).toContain('aria-pressed="true"');
  });

  it('גם גרירה וגם בחירת קובץ', () => {
    expect(screenHtml).toContain('אפשר לגרור לכאן את הקובץ');
    expect(screenHtml).toContain('בחירת קובץ');
    expect(screenHtml).toContain('type="file"');
  });
});

describe('★ נגישות ו-RTL', () => {
  it('המסך בעברית ומימין לשמאל', () => {
    expect(screenHtml).toContain('dir="rtl"');
    expect(screenHtml).toContain('lang="he"');
  });

  it('★ כל פקד בגובה מגע — כמו בשאר המסכים', () => {
    const controls = screenHtml.split('min-h-[44px]').length - 1;
    // שני אזורי העלאה + שלושה כפתורי תקופה.
    expect(controls).toBeGreaterThanOrEqual(5);
  });

  it('לשדות יש תווית אמיתית', () => {
    expect(screenHtml).toContain('<label');
    expect(screenHtml).toContain('for=');
  });
});

describe('★ מבחן השפה — מונחי מערכת לא מגיעים למסך', () => {
  const html = `${screenHtml}\n${resultHtml}`;

  it('אין מונח באנגלית טכנית בטקסט שהיא קוראת', () => {
    for (const term of [
      'reconcile',
      'parse',
      'adapter',
      'settlement',
      'agorot',
      'localStorage',
      'undefined',
      'NaN',
      '[object',
    ]) {
      expect(html, `"${term}" הופיע במסך`).not.toContain(term);
    }
  });

  it('★ ולא מונחים פנימיים בעברית', () => {
    for (const term of ['פרסור', 'ניתוח', 'מזהה', 'שדה', 'אובייקט']) {
      expect(html, `"${term}" הופיע במסך`).not.toContain(term);
    }
  });
});

// ---------------------------------------------------------------------------
// ★★ דקדוק: תחילית + ה"א הידיעה
// ---------------------------------------------------------------------------
// "הדוח מטרנזילה" הוא שם תקין כשהוא עומד לבדו. אבל `'ב' + 'הדוח מטרנזילה'`
// נותן **"בהדוח מטרנזילה"**, וזה אינו עברית: התחילית והה"א לא יכולות לשבת
// זו על זו. זה הופיע על המסך בשורת הסיכום וב"מופיע רק ב…", והתיקון היה
// שתי צורות במקור (`SOURCE_HE` ו-`SOURCE_HE_BARE`) — ולא תיקון של המחרוזת
// המורכבת בדרך החוצה.
//
// ★ והמבחן הזה קיים כי התיקון לבדו לא מחזיק: המשפט הבא שמישהו יוסיף
// ישרשר שוב. סורק על **הטקסט המרונדר**, ולא על המילון, כי שם נוצר הצירוף.

/** תחיליות שאחריהן ה"א הידיעה של "דוח" היא שגיאה. */
const PREFIX_THEN_DEFINITE = /[בלכמושה]הדוח/g;

/** HTML → הטקסט שהיא באמת קוראת. הערות של React מוסרות — בלעדיהן היינו
 *  מפספסים בדיוק את המקרה הזה, שבו התחילית והשם הם שני צמתים נפרדים. */
function plainText(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

describe('★★ תחילית לא נדבקת לה"א הידיעה', () => {
  it('★ הסורק עצמו עובד — בקרה חיובית', () => {
    // בלי זה, המבחן היה "עובר" גם אילו הביטוי לא היה תופס כלום לעולם.
    expect(plainText('<p>ב<!-- -->הדוח מגמא</p>').match(PREFIX_THEN_DEFINITE)).toHaveLength(1);
  });

  it('★★ אין "בהדוח" בשום מקום בתוצאה שהיא רואה', () => {
    const found = plainText(resultHtml).match(PREFIX_THEN_DEFINITE);
    expect(found, `נמצא צירוף שגוי: ${found?.join(', ')}`).toBeNull();
  });

  it('★★ וגם לא במסך ההמתנה', () => {
    const found = plainText(screenHtml).match(PREFIX_THEN_DEFINITE);
    expect(found, `נמצא צירוף שגוי: ${found?.join(', ')}`).toBeNull();
  });

  it('★★ ולא באף אחת מהודעות הממצאים', () => {
    // הממצאים נבנים במנוע ולא במסך, ולכן הם מסלול נפרד שאפשר לשבור לבד.
    for (const finding of result.findings) {
      expect(finding.messageHe, finding.code).not.toMatch(PREFIX_THEN_DEFINITE);
    }
  });

  it('★ ולא בקובץ שמורידים', () => {
    expect(buildReconcileCsv(result)).not.toMatch(PREFIX_THEN_DEFINITE);
  });

  it('★★ שתי הצורות קיימות במקור, ולא אחת שמתוקנת בדרך', () => {
    // מי שיסיר את `SOURCE_HE_BARE` וינסה לחזור ל-`replace('בה','ב')` ייתקל
    // בזה: הצורה הנטולה חייבת להיות **מוגדרת**, ולא נגזרת.
    expect(SOURCE_HE_BARE.tranzila).toBe('דוח טרנזילה');
    expect(SOURCE_HE_BARE.gamma).toBe('דוח גמא');
    expect(SOURCE_HE.tranzila).toBe('הדוח מטרנזילה');
  });
});
