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
import { functionsGraph } from './functionsGraph.mjs';

/** ★ אתר הקריאה. אחד. */
export const READ_SITE = 'shared/lib/orderSource.ts';

/** מקבל את הגוף כפרמטר ומפענח — לא ניגש להודעה. */
export const PARSER = 'shared/lib/orderParse.ts';

/**
 * ★★ **היצרן.** `gmailContract.ts` — הוא בונה את `bodyRaw` מהתשובה של Gmail.
 *
 * ---------------------------------------------------------------------------
 * למה קובץ שלישי מותר, ולמה זה לא מרכך את B12
 * ---------------------------------------------------------------------------
 * שלושת הקבצים הם שלושה תפקידים שונים ולא שלוש הרשאות:
 *   `gmailContract`  — **מייצר** את הגוף מהחוט. בודק שולח לפני שהוא נוגע בו.
 *   `orderSource`    — **קורא** ממנו. בודק שולח לפני שהוא ניגש לשדה.
 *   `orderParse`     — **מקבל** אותו כפרמטר. לא רואה הודעה שלא עברה בשניים.
 *
 * שלושתם עוברים באותה שרשרת אחת, ואין ביניהם מסלול עוקף. כל קובץ **רביעי**
 * שייגע ב-`.bodyRaw` הוא מסלול שני — וזה מה שהבדיקה עוצרת.
 *
 * ⚠️ `gmailContract` נוסף לרשימה **יחד** עם שער השולח שבתוכו. בלי אותו שער
 * הוא היה נשאר מחוץ לרשימה, כי אז הוא באמת היה מייצר גוף להודעה שאיש לא
 * בדק את שולחה.
 */
export const CONTRACT = 'shared/lib/gmailContract.ts';

/** הקבצים שמותר להם לגעת בגוף הודעה. שלושה, וכל אחד מסיבה אחרת. */
const BODY_ALLOWED = new Set([READ_SITE, PARSER, CONTRACT]);

// ★ `bodyRaw` נוסף כאן ביום שבו הוא נוסף לטיפוס. הגוף הגולמי הוא **הכי**
// רגיש מבין השלושה: הוא מכיל את שני החלקים ואת כל מה שמעבר לגבול החתימה,
// כלומר גם את מה שנחתך ולא נקרא. שדה שנוסף בלי לעדכן את הבדיקה הזאת הוא
// פרצה בדיוק בגודל של השדה החדש.
const BODY_ACCESS_RE = /\.\s*(bodyHtml|bodyText|bodyRaw)\b/;
const CONFIGURABLE_RE = /(import\.meta\.env|process\.env)/;
const QUERY_ASSIGN_RE = /ORDER_SOURCE_QUERY\s*=/;

/**
 * ★★ קובץ הקונפיג היחיד שמותר לו לקרוא משתני סביבה — **ורק שמות מהרשימה.**
 *
 * ---------------------------------------------------------------------------
 * למה החריג הזה נכתב כך, ולא כ"פטור לקובץ"
 * ---------------------------------------------------------------------------
 * הכלל המקורי היה "אין `import.meta.env` בשום קובץ בבנייה", והוא היה נכון
 * כשלא היה ענן: אז לא הייתה שום סיבה לגיטימית לקרוא קונפיג, ולכן איסור גורף
 * לא עלה כלום. עם Firebase יש סיבה אחת — אתחול ה-SDK — ופטור-לקובץ היה
 * פותח את הדלת לכל דבר אחר שייכתב באותו קובץ.
 *
 * ולכן הפטור הוא **על שמות המשתנים**, לא על הקובץ: `firebase.ts` רשאי לקרוא
 * את ששת מפתחות ה-Web ואת האזור, ותו לא. משתנה בשם `VITE_ORDER_QUERY`,
 * `VITE_ORDER_SENDER` או כל דבר אחר — **מפיל build**, גם בתוך הקובץ הזה.
 *
 * זה בדיוק מה שההבטחה אומרת: היקף הקריאה קבוע בקוד ולא ניתן לעריכה
 * מהקונפיג. מפתח Firebase אינו היקף קריאה; שאילתה היא.
 */
export const CONFIG_FILE = 'src/firebase.ts';

export const ALLOWED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FUNCTIONS_REGION',
];

/** `import.meta.env.X` / `process.env.X` — שם המשתנה. */
const ENV_VAR_RE = /(?:import\.meta\.env|process\.env)\s*\.\s*([A-Z0-9_]+)/g;

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

  // ★★ **שני הגרפים.** הבדיקה נכתבה כשהיה רק הדפדפן; מרגע שיש Cloud
  // Functions, הקוד שבאמת ניגש לתיבה רץ שם. בדיקה שמכסה רק את הקליינט
  // הייתה נשארת ירוקה בזמן שהמסלול היחיד שקורא מיילים אינו נבדק כלל —
  // כלומר בדיוק צורת הכשל שהיא נועדה למנוע.
  const clientFiles = buildFiles();
  const serverFiles = functionsGraph().files;
  const files = Array.from(new Set([...clientFiles, ...serverFiles]));

  if (!clientFiles.includes(READ_SITE)) {
    violations.push({
      file: READ_SITE,
      line: 0,
      text: 'אתר הקריאה היחיד אינו בגרף הבנייה של הקליינט',
    });
  }
  if (!serverFiles.includes(READ_SITE)) {
    violations.push({
      file: READ_SITE,
      line: 0,
      text: '★★ אתר הקריאה היחיד אינו בגרף ה-Functions — כלומר הענן קורא הודעות בדרך אחרת',
    });
  }

  for (const rel of files) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;

    for (const { line, n } of codeOf(rel)) {
      if (BODY_ACCESS_RE.test(line) && !BODY_ALLOWED.has(rel)) {
        violations.push({
          file: rel,
          line: n,
          text: `גישה לגוף הודעה מחוץ ל-${READ_SITE}: ${line.trim()}`,
        });
      }
      if (CONFIGURABLE_RE.test(line)) {
        if (rel !== CONFIG_FILE) {
          violations.push({
            file: rel,
            line: n,
            text: `קונפיג חיצוני בקוד שמגדיר את היקף הקריאה: ${line.trim()}`,
          });
        } else {
          // ★ בתוך קובץ הקונפיג — הפטור הוא על **שמות** מהרשימה בלבד.
          for (const m of line.matchAll(ENV_VAR_RE)) {
            if (!ALLOWED_ENV_VARS.includes(m[1])) {
              violations.push({
                file: rel,
                line: n,
                text: `★★ משתנה סביבה שאינו ברשימה המותרת (${m[1]}): ${line.trim()}`,
              });
            }
          }
        }
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
