// ============================================================================
// noModelPath.test.ts — ★★ המבחן שמוכיח שאין בבנייה נתיב שמייצר קריאת מודל.
//
// ---------------------------------------------------------------------------
// למה מבחן, כשיש כבר בדיקת build
// ---------------------------------------------------------------------------
// אותה בקרה יושבת בשני צינורות בכוונה: מי שמריץ רק `npm run build` יראה
// אותה, ומי שמריץ רק `npm test` יראה אותה. בקרה שקיימת רק בצינור אחד היא
// בקרה שאפשר לעקוף בטעות — וזו בדיוק הצורה שבה כלל הארכוב "שלא אמור לרוץ"
// כן היה יכול לרוץ.
//
// ---------------------------------------------------------------------------
// ★ מה נטען כאן, ומה **לא**
// ---------------------------------------------------------------------------
// **נטען:** מה שנבנה — הקוד שרץ אצל דורית בדפדפן — לא מכיל מודול שמדבר עם
// מודל, ולא מכיל שום קריאת רשת. גרף הייבוא מ-`src/main.tsx` נסרק במלואו.
//
// **לא נטען:** שהמוקים נמחקו מהעולם. הם קיימים ב-`frozen/`, מחוץ לבנייה,
// כי מודול החשבוניות הוקפא לבקשת רונן ולא נמחק. המבחן האחרון בקובץ הזה
// **מוודא שהם שם** — כדי שההבחנה בין "הוקפא" ל"נמחק" תהיה כתובה בקוד ולא
// רק בסיכום.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildFiles, findViolations } from '../scripts/check-no-model.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('★★ אין נתיב למודל במה שנבנה', () => {
  it('גרף הבנייה נקי — אין סימן מודל, אין רשת, אין ייבוא דינמי', () => {
    expect(findViolations()).toEqual([]);
  });

  it('★ אף קובץ מ-frozen/ אינו נכנס לחבילה', () => {
    // זה ההבדל בין "הסרנו מהמסך" לבין "הסרנו מהבנייה". `frozen/` מלא בקוד
    // חי ומקומפל — הוא פשוט לא מגיע לשום מקום מ-`main.tsx`.
    const frozen = buildFiles().filter((f) => f.startsWith('frozen/'));
    expect(frozen).toEqual([]);
  });

  it('★ הגרף מכיל את מודול ההזמנות ואת מסך ההסבר, ולא הרבה יותר', () => {
    const files = buildFiles();
    for (const f of [
      'src/main.tsx',
      'src/App.tsx',
      'src/components/OrdersView.tsx',
      'src/components/ExplainerScreen.tsx',
      'src/hooks/useOrders.ts',
      'src/utils/orderPipeline.ts',
      'shared/lib/orderParse.ts',
      'shared/lib/orderSource.ts',
      // ★ `sanitize` בבנייה **בכוונה**. ראה את המבחן הייעודי בהמשך.
      'shared/lib/sanitize.ts',
      // ⇄ פרוסה 1 — שכבת הענן בצד הלקוח.
      'src/firebase.ts',
      'src/hooks/useAuth.ts',
      'src/hooks/useCloudOrders.ts',
      'src/utils/cloudView.ts',
      'src/components/ConnectionBanner.tsx',
      'src/components/SupportModePanel.tsx',
      'shared/lib/googleConnection.ts',
      'shared/lib/supportMode.ts',
      'shared/lib/firestorePaths.ts',
    ]) {
      expect(files, `${f} חסר מגרף הבנייה`).toContain(f);
    }

    // ---------------------------------------------------------------------
    // ★ תקרת גודל הגרף — ⇄ **עלתה מ-30 ל-40 בפרוסה 1, במודע**
    // ---------------------------------------------------------------------
    // גודל הגרף אינו יעד לעצמו; הוא **קנרית**. מה שכדאי להסתכל עליו הוא
    // קפיצה — כי המוצר הזה הוא מסך אחד, וגידול פירושו שמשהו נכנס לבנייה.
    //
    // הגידול כאן (25 → 34) הוא שכבת הענן, והוא מפורט ברשימה למעלה: כל תשעת
    // הקבצים החדשים נדרשים **בשמם**. זה מה ששומר על הקנרית משמעותית — בלי
    // הרשימה, העלאת התקרה הייתה הופכת אותה למספר שמתאימים אותו כל פעם
    // מחדש, וזו הצורה שבה בקרה הופכת לטקס.
    expect(files.length).toBeLessThan(40);
  });

  it('★★ המודולים של המודל קיימים — ב-frozen/, כלומר הוקפאו ולא נמחקו', () => {
    // ההבחנה הזאת מכוונת: החשבוניות הוקפאו כי רונן ביקש אותן במפורש,
    // ולכן גם המוקים שהן נשענות עליהם נשארו — מחוץ לבנייה.
    for (const f of [
      'frozen/utils/mockAgent.ts',
      'frozen/utils/mockInvoiceExtract.ts',
      'frozen/utils/invoicePipeline.ts',
      'frozen/lib/triageFilter.ts',
    ]) {
      expect(existsSync(join(root, f)), `${f} נעלם — הוקפא, לא נמחק`).toBe(true);
    }
  });

  it('★★ מה שנמחק — נמחק', () => {
    // אוסף `items` ומסלול הכתיבה אליו (סקירת עדי, B13). כאן ההבחנה הפוכה:
    // "לא בשימוש" לא הספיק, כי אוסף ששורד מחזיר את ממצא הכותרות שלם.
    for (const f of [
      'frozen/utils/pipeline.ts',
      'frozen/lib/redactSensitive.ts',
      'frozen/hooks/useTriage.ts',
      'frozen/components/MorningBriefView.tsx',
      'frozen/components/TriageItemCard.tsx',
      'src/utils/pipeline.ts',
      'shared/lib/redactSensitive.ts',
    ]) {
      expect(existsSync(join(root, f)), `${f} עדיין קיים`).toBe(false);
    }
  });
});
