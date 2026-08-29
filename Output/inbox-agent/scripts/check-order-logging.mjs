// ============================================================================
// check-order-logging.mjs — ★★ בדיקת CI שמפילה build. **בקרה מרכזית.**
//
// ---------------------------------------------------------------------------
// למה זו לא היגיינה, ולמה היא **עלתה** בחשיבות אחרי הצמצום
// ---------------------------------------------------------------------------
// מודול ההזמנות הוא **פענוח דטרמיניסטי של טקסט**, כלומר בדיוק סוג הקוד
// שמדבגים בו עם `console.log(parsed)`. זה מה שכל אחד עושה, זה עובד, וזה
// נמחק אחר כך — חוץ מהפעם שבה זה לא נמחק.
//
// והאובייקט שמודפס אינו "מבנה נתונים": הוא **שם, טלפון וכתובת המגורים של
// לקוחה**.
//
// ★★ מה שהשתנה בסבב הזה, מסקירת עדי (M4, מסעיף 8ב.1):
//
// > *"עם Anthropic מחוץ לתמונה, **Cloud Logging הוא הדרך היחידה שנשארה שבה
// > כתובת מגורים יוצאת מהמערכת.** שורת `console.log(parsed)` אחת בפרסר
// > דטרמיניסטי מעתיקה כתובת ליומן שאף מנגנון שלכם לא מוחק."*
//
// כלומר: כשהמודל ירד, הבדיקה הזאת לא הפכה לפחות חשובה — היא הפכה ל**בקרת
// הדליפה היחידה שנשארה**. בפרוסה 1 ההדפסה נוחתת ביומני Cloud Functions, ושם
// היא נשמרת, נסרקת ומגובה. דליפה שקטה, מתמשכת, ובלי שום תסמין.
//
// ---------------------------------------------------------------------------
// ★ מה התרחב: מרשימת קבצים לכל מה שנבנה
// ---------------------------------------------------------------------------
// עד עכשיו הבדיקה כיסתה שישה קבצים שנרשמו ידנית. עכשיו היא רצה על **כל
// הקבצים בגרף הבנייה** (`scripts/buildGraph.mjs`), כלומר על כל מה שמגיעים
// אליו מ-`src/main.tsx`.
//
// הסיבה שהחלפתי את הרשימה הידנית: היא ענתה על "מה שזכרנו לרשום". קובץ חדש
// שנוגע בהזמנה — וכל קובץ בבנייה הזאת נוגע בהזמנה, כי זה כל מה שיש — היה
// נכנס בלי כיסוי עד שמישהו יזכור. `GUARDED_FILES` נשמר כ**רצפה**: רשימת
// הקבצים שחייבים להיות בגרף, כדי שגם "הקובץ נעלם" ייתפס.
//
// ★ נאסר **כל** `console.`, ולא רק `console.log`. `console.warn` ו-
// `console.error` מדפיסים בדיוק את אותם אובייקטים, ומי שיחפש עקיפה ימצא
// אותה בשנייה. הודעת שגיאה למשתמשת עוברת דרך `reasonHe`/`messageHe`, שהם
// ממילא המקום היחיד שבו נכתב טקסט שמיועד לעיניים.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { buildFiles } from './check-no-model.mjs';
import { codeOf } from './buildGraph.mjs';
import { functionsGraph } from './functionsGraph.mjs';

/**
 * ★★ הקבצים שחייבים להיות בגרף ה-**Functions**.
 *
 * ---------------------------------------------------------------------------
 * למה הבדיקה הזאת התרחבה לענן, ולמה דווקא היא
 * ---------------------------------------------------------------------------
 * עד עכשיו `console.log(parsed)` היה נוחת בקונסולת הדפדפן של דורית — לא נעים,
 * מקומי, ונעלם ברענון. **בענן הוא נוחת ב-Cloud Logging**, ושם הוא נשמר,
 * נסרק, מגובה, ו**אף מנגנון מחיקה שכתבנו לא נוגע בו**. `purgeOrders` מוחקת
 * מ-Firestore; היא לא יודעת על יומנים.
 *
 * מסקירת עדי (M4, אחרי שהמודל ירד):
 *
 * > *"עם Anthropic מחוץ לתמונה, **Cloud Logging הוא הדרך היחידה שנשארה שבה
 * > כתובת מגורים יוצאת מהמערכת.**"*
 *
 * כלומר: בפרוסה 0 זו הייתה בקרה חשובה; בפרוסה 1 היא **הבקרה** על הדליפה
 * היחידה שנשארה. ולכן אין חריג — גם לא לסיכומי ריצה, גם לא ל-`console.error`
 * בבלוק `catch`. מה שצריך להישמר נכתב ל-`syncRuns` כספירות וקודים, וזה גם
 * הופך אותו לדבר שדורית רואה ולא רק רונן.
 */
export const GUARDED_FUNCTION_FILES = [
  'functions/src/index.ts',
  'functions/src/lib/orderSync.ts',
  'functions/src/lib/gmailFetch.ts',
  'functions/src/lib/tokenStore.ts',
  'functions/src/lib/accessLog.ts',
  'shared/lib/gmailContract.ts',
  'shared/lib/purgePolicy.ts',
];

/**
 * ★ רצפת הכיסוי: קבצים שחייבים להיות בגרף הבנייה.
 *
 * הרשימה כבר אינה **היקף** הבדיקה (ההיקף הוא כל הגרף), אלא טענה שהמודול
 * עדיין שם. קובץ שיוסר מהגרף — כי מישהו ניתק אותו, או שינה לו שם — ייתפס
 * כאן ולא ייעלם בשקט.
 */
export const GUARDED_FILES = [
  'shared/lib/orderParse.ts',
  'shared/lib/orderRetention.ts',
  'shared/lib/orderSource.ts',
  'shared/lib/sanitize.ts',
  'shared/types/order.ts',
  'src/utils/orderPipeline.ts',
  'src/hooks/useOrders.ts',
  'src/components/OrdersView.tsx',
];

/** `console.` בכל צורה. שורות הערה מסוננות, כדי שאפשר יהיה לכתוב על זה. */
const CONSOLE_RE = /(^|[^\w.])console\s*\./;

export function findViolations() {
  const violations = [];
  const clientFiles = buildFiles();
  const serverFiles = functionsGraph().files;
  const files = Array.from(new Set([...clientFiles, ...serverFiles]));

  for (const rel of GUARDED_FILES) {
    if (!clientFiles.includes(rel)) {
      violations.push({
        file: rel,
        line: 0,
        text: 'הקובץ אינו בגרף הבנייה — או שנמחק, או שאף אחד לא מייבא אותו',
      });
    }
  }

  for (const rel of GUARDED_FUNCTION_FILES) {
    if (!serverFiles.includes(rel)) {
      violations.push({
        file: rel,
        line: 0,
        text: 'הקובץ אינו בגרף ה-Functions — או שנמחק, או שאף אחד לא מייבא אותו',
      });
    }
  }

  for (const rel of files) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    for (const { line, n } of codeOf(rel)) {
      if (CONSOLE_RE.test(line)) {
        violations.push({ file: rel, line: n, text: line.trim() });
      }
    }
  }

  return violations;
}

// הרצה ישירה מה-CLI (בתוך `npm run build`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ נמצאה כתיבה ללוג במה שנבנה.\n');
    console.error('  האובייקט שנכתב שם מכיל שם, טלפון וכתובת מגורים של לקוחה.');
    console.error('  אחרי שהמודל ירד, זו דרך הדליפה היחידה שנשארה: בפרוסה 1');
    console.error('  ההדפסה נוחתת ביומני Cloud Functions, ושם היא נשמרת ומגובה.');
    console.error('  אם צריך לדבג — להשתמש במבחן, לא בהדפסה.\n');
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log('✓ אין כתיבה ללוג באף קובץ בגרף הבנייה.');
}
