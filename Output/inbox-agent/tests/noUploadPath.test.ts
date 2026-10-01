// ============================================================================
// noUploadPath.test.ts — ★★ השער שמוכיח את הבאנר, ו**ההוכחה שהשער תופס**.
//
// ---------------------------------------------------------------------------
// שתי טענות, ורק אחת מהן מספיקה לבד
// ---------------------------------------------------------------------------
//  1. **חיובית:** בגרף של השוואת הדוחות אין נתיב ששולח או שומר. זו הטענה
//     שהבאנר על המסך עומד עליה.
//  2. **★★ שלילית:** כשמכניסים ייבוא אסור — השער **נכשל**. בלי השנייה,
//     הראשונה חסרת ערך: `return []` היה עובר אותה בהצלחה מושלמת.
//
// שער שלא הוכח שהוא תופס אינו שער, והצורה השכיחה שבה בקרה מתה כאן אינה
// מחיקה שלה אלא שינוי שהופך אותה לבדיקה שעוברת תמיד. זה כבר קרה בפרויקט
// הזה שלוש פעמים, וכל שלוש הפעמים "ההגנה" הייתה הכוונה שלנו בלבד.
//
// ---------------------------------------------------------------------------
// ולמה גם מבחן וגם `npm run build`
// ---------------------------------------------------------------------------
// אותו נימוק שכתוב על `check-no-model`: *"בקרה שקיימת בצינור אחד בלבד היא
// בקרה שאפשר לעקוף בטעות."* `npm run build` מריץ את הסקריפט, `npm test`
// מריץ את זה, ומי שירוץ רק אחד מהשניים עדיין ייתפס.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_MARKERS,
  WATCHED_ENTRIES,
  findUploadViolations,
  uploadGraphFiles,
} from '../scripts/check-no-upload.mjs';
import { HE } from '../src/i18n';

const CANARY = [
  'tests/fixtures/uploadGateCanary/canary.ts',
  'tests/fixtures/uploadGateCanary/canaryDynamic.ts',
];

// ---------------------------------------------------------------------------

describe('★★ אין נתיב לשליחה או לשמירה בהשוואת הדוחות', () => {
  it('הגרף נקי — אין ענן, אין רשת, ואין אחסון בדפדפן', () => {
    expect(findUploadViolations()).toEqual([]);
  });

  it('★ והשער באמת עבר על המסך ועל שלושת המודולים', () => {
    const files = uploadGraphFiles();
    for (const entry of WATCHED_ENTRIES) {
      expect(files, `${entry} לא נסרק`).toContain(entry);
    }
    expect(files).toContain('shared/lib/reconcileCsv.ts');
    expect(files).toContain('src/i18n.ts');
  });

  it('★★ ומודול ה-Firebase של האפליקציה אינו בגרף כלל', () => {
    // לא "לא משתמשים בו" — **לא מגיעים אליו**. זו ההבחנה שכל השער עומד
    // עליה, והיא גם מה שמבדיל את המסך הזה משאר המסכים באפליקציה.
    expect(uploadGraphFiles()).not.toContain('src/firebase.ts');
  });

  it('הבאנר שעל המסך הוא בדיוק ההבטחה שהשער מוכיח', () => {
    expect(HE.reconcilePrivacyBanner).toBe(
      'הקבצים נשארים במחשב שלך. שום דבר מהם לא נשלח לשום מקום ולא נשמר בכלי — כשסוגרים את החלון, זה נעלם.',
    );
  });
});

// ---------------------------------------------------------------------------

describe('★★ המבחן השלילי — השער נכשל כשצריך', () => {
  const violations = findUploadViolations(CANARY);

  it('קובץ הפיתיון מפיל אותו', () => {
    expect(violations.length).toBeGreaterThan(0);
  });

  it('★★ כל אחד מהסימנים האסורים נתפס — ולא רק "משהו נתפס"', () => {
    const caught = violations.map((v) => v.why).join(' | ');
    for (const { marker } of FORBIDDEN_MARKERS) {
      expect(caught, `הסימן ${marker} לא נתפס`).toContain(marker);
    }
  });

  it('★ גם ייבוא דינמי נתפס — בלעדיו הגרף אינו הוכחה', () => {
    expect(violations.some((v) => v.why === 'ייבוא דינמי')).toBe(true);
  });

  it('★★ וגם סימן שיושב **בקובץ מיובא** ולא בנקודת הכניסה', () => {
    // זו הטענה שהשער הולך על הגרף. ייבוא אסור שמוסתר קובץ אחד פנימה הוא
    // בדיוק הצורה שבה הוא היה נכנס בפועל.
    const deep = violations.filter((v) => v.file.endsWith('canaryDeep.ts'));
    expect(deep.length).toBeGreaterThan(0);
    expect(deep.map((v) => v.why).join(' | ')).toContain('localStorage');
  });

  it('★ נקודת כניסה שנעלמה היא כשל — ולא שער שעובר בשקט', () => {
    const missing = findUploadViolations(['src/components/DeletedByAccident.tsx']);
    expect(missing).toHaveLength(1);
    expect(missing[0].why).toContain('נמחק');
  });

  it('הפיתיון אינו חלק מהאפליקציה — הוא לא מגיע לשום גרף אמיתי', () => {
    const real = uploadGraphFiles();
    for (const file of CANARY) expect(real).not.toContain(file);
  });
});
