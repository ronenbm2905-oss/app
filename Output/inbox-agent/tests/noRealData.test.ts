// ============================================================================
// noRealData.test.ts — ★★ אין בריפו נתון מהקובץ האמיתי, **וההוכחה שהשער תופס**.
//
// ---------------------------------------------------------------------------
// למה השער הזה נולד
// ---------------------------------------------------------------------------
// כשנבנו האדפטרים, מספרי השידור והסכומים מהקובץ האמיתי הודבקו ל-fixtures.
// ת.ז ומספרי כרטיס **כן** סוננו — כי הם סומנו כרגיש; מספרי אצווה לא סומנו,
// ולכן עברו. כלומר ההגנה עבדה בדיוק עד גבול מה שמישהו זכר לסמן, וזה הכשל
// שחוזר כאן שוב ושוב.
//
// הריפו ציבורי והוא מזהה את העסק בשמו. מספר אצווה + סכום = מחזור אמיתי.
//
// ---------------------------------------------------------------------------
// ★★ ושתי הטענות, כמו בכל שער בפרויקט
// ---------------------------------------------------------------------------
//  1. **חיובית:** בקבצים של הפיצ׳ר אין רצף ספרות שאינו רשום כמומצא.
//  2. **★★ שלילית:** כשמדביקים מספר כזה — השער **נכשל**. בלי השנייה,
//     הראשונה חסרת ערך.
//
// ★ ושימו לב לצורה: `ALLOWED_DIGITS` היא **רשימה מותרת**, לא אסורה. רשימה
// אסורה הייתה מפרסמת בריפו ציבורי בדיוק את מה שהיא מגנה עליו, והייתה מכסה
// רק את הערכים שכבר ראינו. ההיפוך מגן גם על הקובץ הבא — ראו את ההסבר המלא
// בראש `scripts/check-no-real-data.mjs`.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ALLOWED_DIGITS,
  WATCHED_FILES,
  findRealDataViolations,
} from '../scripts/check-no-real-data.mjs';

const CANARY = ['tests/fixtures/realDataCanary/canary.ts'];

// ---------------------------------------------------------------------------

describe('★★ אין בקוד ההשוואה נתון מהקובץ האמיתי', () => {
  it('כל הקבצים נקיים', () => {
    expect(findRealDataViolations()).toEqual([]);
  });

  it('★ והשער סורק את ה-fixtures — שם נמצא הסיכון האמיתי', () => {
    // הפרסרים אינם מחזיקים נתונים; ה-fixtures כן. קובץ בדיקה שנשמט
    // מהרשימה הוא בדיוק המקום שאליו ידביקו את המספר הבא.
    expect(WATCHED_FILES).toContain('tests/fixtures/xlsxBuilder.ts');
    expect(WATCHED_FILES).toContain('tests/settlementAdapters.test.ts');
    expect(WATCHED_FILES).toContain('tests/settlementGroup.test.ts');
    expect(WATCHED_FILES).toContain('tests/reconcileUpload.test.tsx');
    expect(WATCHED_FILES).toContain('shared/lib/adapters/tranzila.ts');
    expect(WATCHED_FILES).toContain('shared/lib/adapters/gamma.ts');
  });

  it('★★ וקובץ שנעלם מהרשימה הוא כשל, ולא "פחות לסרוק"', () => {
    const violations = findRealDataViolations(['tests/fixtures/notAFile.ts']);
    expect(violations).toHaveLength(1);
    expect(violations[0].why).toContain('אינו קיים');
  });
});

// ---------------------------------------------------------------------------

describe('★★ המבחן השלילי — השער נכשל כשצריך', () => {
  const violations = findRealDataViolations(CANARY);

  it('קובץ הפיתיון מפיל אותו', () => {
    expect(violations.length).toBeGreaterThan(0);
  });

  it('★ תופס הצבה ישירה, ערך בתוך מבנה, **וגם הערה**', () => {
    // הדבקה לתוך הערה מדליפה בדיוק כמו הדבקה לתוך קוד, ולכן הסריקה היא על
    // הטקסט ולא על מחרוזות בלבד.
    const caught = violations.map((v) => v.value);
    expect(caught).toContain('48217903');
    expect(caught).toContain('31905524');
    expect(caught).toContain('77410286');
    expect(caught).toContain('62108847');
  });

  it('★★ ומספר שרשום כמומצא **אינו** נתפס — אחרת השער היה רעש', () => {
    // שער שנדלק על כל דבר הוא שער שמישהו יכבה. הדיוק שלו הוא מה שמשאיר
    // אותו בחיים.
    for (const allowed of ALLOWED_DIGITS.keys()) {
      expect(violations.map((v) => v.value)).not.toContain(allowed);
    }
  });
});

// ---------------------------------------------------------------------------

describe('★ הרשימה המותרת עצמה', () => {
  it('כל ערך בה נושא הסבר — ולא "כי צריך"', () => {
    for (const [value, why] of ALLOWED_DIGITS) {
      expect(why.length, `${value} בלי הסבר`).toBeGreaterThan(10);
    }
  });

  it('★★ ומספרי השידור המומצאים ניכרים כמומצאים', () => {
    // 9000xxxx רצוף. מי שיפתח את ה-fixture יראה מיד שאלה לא מספרים מקובץ,
    // ולא יצטרך לסמוך על כך שמישהו בדק.
    const settlements = [...ALLOWED_DIGITS.keys()].filter((v) => /^0?9000\d{4}$/.test(v));
    expect(settlements.length).toBeGreaterThanOrEqual(4);
  });
});
