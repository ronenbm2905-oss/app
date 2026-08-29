// ============================================================================
// check-order-source.mjs — ★★ אתר קריאה יחיד לגוף הודעה (B12).
//
// ---------------------------------------------------------------------------
// מה זה אוכף, ולמה זו לא קפדנות
// ---------------------------------------------------------------------------
// מסך ההסבר אומר למשתמשת שהכלי מסתכל **רק על ההודעות של חברת התשלומים**,
// ובאותה נשימה אומר לה שההרשאה שהיא נותנת היא לכל התיבה. הפער הזה מוחזק
// בדיוק בדבר אחד: הקוד. הסקירה (B12) קבעה שלכן הוא חייב להיות **מנגנון**:
//
// > *"הצהרה בלי מנגנון היא מצג שווא — אותה צורת כשל בדיוק כמו 'קבצים אחרים
// > אינם נשמרים'. פעם שלישית באותו פרויקט."*
//
// שלוש הדרישות היו: שאילתה קבועה בקוד · קריאת גוף רק למה שחזר ממנה · **אתר
// קריאה יחיד + grep CI + מבחן**. זה ה-grep.
//
// ---------------------------------------------------------------------------
// מה נבדק
// ---------------------------------------------------------------------------
//  1. **גישה ל-`.bodyHtml` / `.bodyText` מותרת בקובץ אחד בלבד** בכל גרף
//     הבנייה: `shared/lib/orderSource.ts`. הגדרת שדה בטיפוס אינה גישה, ולכן
//     הבדיקה מכוונת ל**גישה לנקודה** (`msg.bodyHtml`).
//     החריג היחיד הוא `orderParse.ts`, שמקבל את הגוף כפרמטר ומפענח אותו —
//     הוא הצרכן, לא הקורא, והוא לא רואה אף הודעה שלא עברה קודם דרך
//     `orderSource`.
//  2. **השאילתה קבועה**: אין `import.meta.env`, אין `process.env` ואין
//     השמה ל-`ORDER_SOURCE_QUERY` בשום מקום בבנייה. שאילתה שאפשר להזין
//     מבחוץ היא בדיוק ההבטחה שמתפוגגת בקונפיג.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { buildFiles } from './check-no-model.mjs';
import { codeOf } from './buildGraph.mjs';

/** ★ אתר הקריאה. אחד. */
export const READ_SITE = 'shared/lib/orderSource.ts';

/** מקבל את הגוף כפרמטר ומפענח — לא ניגש להודעה. */
export const PARSER = 'shared/lib/orderParse.ts';

// ★ `bodyRaw` נוסף כאן ביום שבו הוא נוסף לטיפוס. הגוף הגולמי הוא **הכי**
// רגיש מבין השלושה: הוא מכיל את שני החלקים ואת כל מה שמעבר לגבול החתימה,
// כלומר גם את מה שנחתך ולא נקרא. שדה שנוסף בלי לעדכן את הבדיקה הזאת הוא
// פרצה בדיוק בגודל של השדה החדש.
const BODY_ACCESS_RE = /\.\s*(bodyHtml|bodyText|bodyRaw)\b/;
const CONFIGURABLE_RE = /(import\.meta\.env|process\.env)/;
const QUERY_ASSIGN_RE = /ORDER_SOURCE_QUERY\s*=/;

/**
 * ★★ כותרות שאינן חתומות. **אסור לקרוא מהן.**
 *
 * תג ה-`h=` בחתימה של ספק הסליקה מכסה `Received:From:To:Subject` בלבד.
 * `Date` ו-`Message-ID` **אינם בפנים**, כלומר אפשר לשנות אותם בהודעה אמיתית
 * וחתומה בלי שהחתימה תישבר.
 *
 * ומה זה שווה בפועל: מי שיקרא את `Date` ייתן לזר לקבוע מה "הישן ביותר"
 * ברשימת האריזה ומתי הזמנה נמחקת לפי מדיניות השמירה; ומי שיזהה כפילות לפי
 * `Message-ID` יאפשר לשלוח את אותה הזמנה פעמיים ולראות שתיים. במקומם:
 * `receivedAt` (זמן הקליטה, שהשרת קובע) ומפתח תוכן (`fingerprint.ts`).
 *
 * הבדיקה כאן היא ה**מנגנון** מאחורי המשפט הזה, כדי שהוא לא יישאר הערה
 * שמישהו יקרא בעוד חצי שנה אחרי שכבר כתב את השורה.
 */
const UNSIGNED_HEADER_RE =
  /(headers?\s*\[\s*['"`](date|message-id)['"`]\s*\]|['"`]Message-ID['"`]|\bdateHeader\b)/i;

export function findViolations() {
  const violations = [];
  const files = buildFiles();

  if (!files.includes(READ_SITE)) {
    violations.push({
      file: READ_SITE,
      line: 0,
      text: 'אתר הקריאה היחיד אינו בגרף הבנייה',
    });
  }

  for (const rel of files) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;

    for (const { line, n } of codeOf(rel)) {
      if (BODY_ACCESS_RE.test(line) && rel !== READ_SITE && rel !== PARSER) {
        violations.push({
          file: rel,
          line: n,
          text: `גישה לגוף הודעה מחוץ ל-${READ_SITE}: ${line.trim()}`,
        });
      }
      if (CONFIGURABLE_RE.test(line)) {
        violations.push({
          file: rel,
          line: n,
          text: `קונפיג חיצוני בקוד שמגדיר את היקף הקריאה: ${line.trim()}`,
        });
      }
      if (UNSIGNED_HEADER_RE.test(line)) {
        violations.push({
          file: rel,
          line: n,
          text: `קריאה מכותרת שאינה חתומה (Date / Message-ID): ${line.trim()}`,
        });
      }
      if (QUERY_ASSIGN_RE.test(line) && rel !== READ_SITE) {
        violations.push({
          file: rel,
          line: n,
          text: `השמה לשאילתת המקור מחוץ ל-${READ_SITE}: ${line.trim()}`,
        });
      }
    }
  }

  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ נמצאה קריאת גוף הודעה מחוץ לאתר הקריאה היחיד.\n');
    console.error('  המסך מבטיח למשתמשת שהכלי קורא רק את הודעות חברת התשלומים,');
    console.error('  וההרשאה שהיא נותנת היא לכל התיבה. מה שמחזיק את ההבטחה הזאת');
    console.error('  הוא הקוד — ולכן הקריאה חייבת להישאר במקום אחד שאפשר לקרוא.\n');
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log(`✓ גוף הודעה נקרא רק ב-${READ_SITE}, והשאילתה קבועה בקוד.`);
}
