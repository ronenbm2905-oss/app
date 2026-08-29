// ============================================================================
// check-gmail-fetch.mjs — ★★★ **הבדיקה שהכי קל לאבד, ואי אפשר לראות שאיבדנו.**
//
// ---------------------------------------------------------------------------
// מה היא מגנה עליו
// ---------------------------------------------------------------------------
// ה-README של פרוסה 0 סימן את זה כסעיף חוסם, והוא הסעיף היחיד שנוסח כאזהרה:
//
// > *"שכבת השליפה חייבת להביא גוף גולמי וכותרת `DKIM-Signature`. החיתוך
// > ל-`l=` הוא היום ההגנה מפני תוכן שנוסף להודעה חתומה. אם שכבת ה-Gmail
// > תביא רק חלק מפוענח בלי כותרת חתימה, **החיתוך פשוט לא יקרה** — כל
// > המבחנים יישארו ירוקים, וההגנה תיעלם בשקט."*
//
// ולכן שלוש שכבות, וזו השלישית:
//   1. `gmailContract.ts` — **זורק** על תשובה שאינה `raw` או בלי חתימה.
//   2. `tests/gmailContract.test.ts` — מריץ שולף מדומה שמחזיר גוף מפוענח,
//      ומוודא שההזמנה **לא** נכתבת ושהכתובת של התוקף לא מגיעה למסך.
//   3. **הקובץ הזה** — מפיל build אם אתר הקריאה חדל לבקש `raw`.
//
// שכבה 3 קיימת כי 1 ו-2 מגנות על **המסלול הקיים**. מי שיוסיף מסלול שליפה
// שני — מטמון, ייבוא, "בדיקה מהירה" — לא יעבור דרך אף אחת מהן. הבדיקה כאן
// הולכת על **כל** גרף ה-Functions ושואלת שאלה אחת: האם מישהו כאן מבקש
// מ-Gmail משהו שאינו `raw`.
//
// ---------------------------------------------------------------------------
// מה נבדק, ולמה כל אחד
// ---------------------------------------------------------------------------
//  1. **`format` שאינו `raw`** — `full` / `metadata` / `minimal` בכל צורה,
//     בכל קובץ. זה הכשל הישיר.
//  2. **`metadataHeaders`** — הפרמטר הזה קיים רק בפורמט `metadata`, ומי
//     שמשתמש בו מקבל כותרות בלי גוף. הוא סימן מובהק לכיוון הלא נכון.
//  3. **קריאה ל-`payload`** — הדרך היחידה לקרוא גוף מתשובה שאינה `raw`.
//     שדה שאיש לא ניגש אליו הוא שדה שאי אפשר להיסחף אליו.
//  4. **`GMAIL_MESSAGE_FORMAT` מיובא ולא מוקלד** באתר הקריאה, ו-`raw`
//     מוגדר במקום אחד בלבד.
//  5. **המחרוזת `DKIM-Signature` קיימת בשער.** בלעדיה אין מה לחלץ, וכל
//     הבדיקה חסרת נושא.
//  6. **`gmailContract.ts` בגרף ה-Functions.** מודול שנותק — כלומר שער
//     שאיש לא עובר בו — הוא בדיוק הצורה השקטה של הכשל.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { functionsGraph } from './functionsGraph.mjs';
import { codeOf } from './buildGraph.mjs';

/** ★ השער. הוא חייב להיות בגרף. */
export const CONTRACT = 'shared/lib/gmailContract.ts';
/** ★ אתר הקריאה מול Gmail. */
export const FETCH_SITE = 'functions/src/lib/gmailFetch.ts';

/** פורמטים אסורים, בכל צורת כתיבה. */
const BAD_FORMAT_RE = /format\s*[:=]\s*['"`](full|metadata|minimal)['"`]|format=(full|metadata|minimal)\b/;

/** פרמטר שקיים רק ב-`format=metadata`. */
const METADATA_HEADERS_RE = /\bmetadataHeaders\b/;

/**
 * ★ גישה ל-`payload` של Gmail.
 *
 * החריג היחיד הוא `gmailContract.ts` עצמו, שמגדיר את השדה בטיפוס **כדי
 * לזהות שהתקבל הפורמט הלא נכון** — ובודק `msg.payload !== undefined` ולא
 * קורא ממנו ערך. זה השימוש היחיד המותר, והוא מתועד שם.
 */
const PAYLOAD_ACCESS_RE = /\.\s*payload\b/;

/** `raw` כמחרוזת קבועה — מותר רק בקבוע המיוצא. */
const RAW_LITERAL_RE = /['"`]raw['"`]/;

export function findViolations() {
  const violations = [];
  const { files, unresolved } = functionsGraph();

  for (const { file, spec } of unresolved) {
    violations.push({ file, line: 0, text: `ייבוא שלא נפתר: ${spec}` });
  }

  // --- 6. השער בגרף. --------------------------------------------------------
  if (!files.includes(CONTRACT)) {
    violations.push({
      file: CONTRACT,
      line: 0,
      text: '★★ שער החוזה אינו בגרף ה-Functions — כלומר אף שליפה לא עוברת בו',
    });
  }
  if (!files.includes(FETCH_SITE)) {
    violations.push({ file: FETCH_SITE, line: 0, text: 'אתר השליפה אינו בגרף ה-Functions' });
  }

  for (const rel of files) {
    if (!/\.ts$/.test(rel)) continue;

    for (const { line, n } of codeOf(rel)) {
      // --- 1. פורמט אסור. ---------------------------------------------------
      if (BAD_FORMAT_RE.test(line)) {
        violations.push({
          file: rel,
          line: n,
          text: `★★ בקשה ל-Gmail בפורמט שאינו raw: ${line.trim()}`,
        });
      }
      // --- 2. כותרות בלבד. --------------------------------------------------
      if (METADATA_HEADERS_RE.test(line)) {
        violations.push({
          file: rel,
          line: n,
          text: `metadataHeaders — הפורמט הזה מחזיר כותרות בלי גוף: ${line.trim()}`,
        });
      }
      // --- 3. `payload`. ----------------------------------------------------
      if (PAYLOAD_ACCESS_RE.test(line) && rel !== CONTRACT) {
        violations.push({
          file: rel,
          line: n,
          text: `גישה ל-payload של Gmail (גוף מפוענח) מחוץ לשער: ${line.trim()}`,
        });
      }
      // --- 4. `'raw'` מוקלד מחוץ לקבוע. -------------------------------------
      if (RAW_LITERAL_RE.test(line) && rel !== CONTRACT) {
        violations.push({
          file: rel,
          line: n,
          text: `המחרוזת 'raw' מוקלדת במקום לייבא את GMAIL_MESSAGE_FORMAT: ${line.trim()}`,
        });
      }
    }
  }

  // --- 5. השער באמת קורא את כותרת החתימה. ----------------------------------
  const contractCode = files.includes(CONTRACT)
    ? codeOf(CONTRACT)
        .map((l) => l.line)
        .join('\n')
    : '';
  if (!contractCode.includes('DKIM-Signature')) {
    violations.push({
      file: CONTRACT,
      line: 0,
      text: "★★ השער אינו מזכיר 'DKIM-Signature' — בלי הכותרת הזאת אין l= ואין חיתוך",
    });
  }
  if (!contractCode.includes('Authentication-Results')) {
    violations.push({
      file: CONTRACT,
      line: 0,
      text: "השער אינו מזכיר 'Authentication-Results' — בלעדיה אין אימות מקור",
    });
  }
  if (!/GMAIL_MESSAGE_FORMAT\s*=\s*['"`]raw['"`]/.test(contractCode)) {
    violations.push({
      file: CONTRACT,
      line: 0,
      text: "★★ GMAIL_MESSAGE_FORMAT אינו 'raw'",
    });
  }

  // --- 4ב. אתר השליפה משתמש בקבוע. -----------------------------------------
  if (files.includes(FETCH_SITE)) {
    const fetchCode = codeOf(FETCH_SITE)
      .map((l) => l.line)
      .join('\n');
    if (!fetchCode.includes('GMAIL_MESSAGE_FORMAT')) {
      violations.push({
        file: FETCH_SITE,
        line: 0,
        text: '★★ אתר השליפה אינו משתמש ב-GMAIL_MESSAGE_FORMAT',
      });
    }
    if (!fetchCode.includes('gmailMessageToCandidate')) {
      violations.push({
        file: FETCH_SITE,
        line: 0,
        text: '★★ אתר השליפה אינו עובר דרך שער החוזה',
      });
    }
  }

  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ שכבת השליפה אינה מביאה גוף גולמי וכותרת חתימה.\n');
    console.error('  זו הבקרה שנעלמת בשקט: בלי הגוף הגולמי ובלי DKIM-Signature,');
    console.error('  החיתוך ל-l= פשוט לא מתבצע — כל המבחנים נשארים ירוקים,');
    console.error('  והזנב שמישהו הדביק אחרי החתימה נקרא כאילו הוא חלק מההזמנה.\n');
    for (const v of violations) console.error(`  ${v.file}${v.line ? ':' + v.line : ''}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log("✓ השליפה מבקשת format='raw' וקוראת DKIM-Signature, דרך שער אחד.");
}
