// ============================================================================
// check-token-access.mjs — ★★ B3′.1. **החוסם.**
//
// ---------------------------------------------------------------------------
// הניסוח המחייב, מסעיף 5.1 בסקירה
// ---------------------------------------------------------------------------
// > *"**מודול גישה יחיד** — כל קוד Admin שקורא נתוני משתמשת או מפענח טוקן
// > עובר דרכו. **+ בדיקת CI שקריאה ישירה ל-`oauthTokens` מחוץ למודול מפילה
// > build. זה החוסם. בלעדיו לכל שאר הסעיף אין משמעות.**"*
//
// "בלעדיו לכל שאר הסעיף אין משמעות" — כלומר: המתג, הבאנר והיומן הם מנגנון
// אחד, והוא עומד על ההנחה שיש **מקום אחד** שדרכו עוברת גישה. אם קוד אחר
// יכול לקרוא את הטוקן ולפנות ל-Gmail, היומן פשוט לא יראה את זה: הוא יישאר
// ריק, המסך יגיד לדורית "אף אחד לא נגע", וזה יהיה לא נכון.
//
// ---------------------------------------------------------------------------
// ★ ולמה זה מכסה גם את `AccessLog`
// ---------------------------------------------------------------------------
// אותה לוגיקה בדיוק: קריאת תוכן הזמנה בידי המחזיק חייבת לעבור ב-
// `logThenRead`, כי שם הרישום קודם לקריאה. פונקציה שקוראת `orders` ישירות
// ומחזירה תוכן ל-`onCall` היא נתיב שהיומן עיוור אליו.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { functionsGraph } from './functionsGraph.mjs';
import { codeOf } from './buildGraph.mjs';

/** ★★ מודול הגישה היחיד. */
export const TOKEN_MODULE = 'functions/src/lib/tokenStore.ts';
/** ★ מודול הגישה לתוכן. */
export const ACCESS_MODULE = 'functions/src/lib/accessLog.ts';
/** הקובץ שמגדיר את שמות האוספים — המחרוזת חיה שם, וזה תפקידו. */
export const PATHS_MODULE = 'shared/lib/firestorePaths.ts';
/** הפרימיטיבים הקריפטוגרפיים. הם מוגדרים שם ונקראים רק מ-`tokenStore`. */
export const CRYPTO_MODULE = 'shared/lib/tokenCrypto.ts';

const TOKEN_COLLECTION_RE = /\boauthTokens\b/;
const DECRYPT_RE = /\bdecryptToken\b/;
/** ה-endpoint שמחליף refresh token ל-access token. */
const TOKEN_ENDPOINT_RE = /oauth2\.googleapis\.com\/token/;

export function findViolations() {
  const violations = [];
  const { files } = functionsGraph();

  if (!files.includes(TOKEN_MODULE)) {
    violations.push({
      file: TOKEN_MODULE,
      line: 0,
      text: '★★ מודול הגישה אינו בגרף ה-Functions',
    });
  }
  if (!files.includes(ACCESS_MODULE)) {
    violations.push({ file: ACCESS_MODULE, line: 0, text: '★ מודול יומן הגישה אינו בגרף' });
  }

  for (const rel of files) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;

    for (const { line, n } of codeOf(rel)) {
      // --- ⛔ שם האוסף. ------------------------------------------------------
      if (TOKEN_COLLECTION_RE.test(line) && rel !== TOKEN_MODULE && rel !== PATHS_MODULE) {
        violations.push({
          file: rel,
          line: n,
          text: `★★ גישה ל-oauthTokens מחוץ ל-${TOKEN_MODULE}: ${line.trim()}`,
        });
      }
      // --- ⛔ הפענוח. --------------------------------------------------------
      if (DECRYPT_RE.test(line) && rel !== TOKEN_MODULE && rel !== CRYPTO_MODULE) {
        violations.push({
          file: rel,
          line: n,
          text: `★★ פענוח טוקן מחוץ ל-${TOKEN_MODULE}: ${line.trim()}`,
        });
      }
      // --- ⛔ חידוש טוקן בעצמו. ---------------------------------------------
      //
      // `oauthFlow.ts` מותר: הוא פודה `code` בזרימת ההרשאה, ואינו נוגע
      // ב-refresh token שמור. הוא מעביר את התוצאה ל-`tokenStore.replaceTokens`.
      if (
        TOKEN_ENDPOINT_RE.test(line) &&
        rel !== TOKEN_MODULE &&
        rel !== 'functions/src/lib/oauthFlow.ts'
      ) {
        violations.push({
          file: rel,
          line: n,
          text: `פנייה ל-endpoint הטוקנים מחוץ למודול הגישה: ${line.trim()}`,
        });
      }
    }
  }

  // --- ★ ומודול הגישה לא מחזיר את הטוקן החוצה. -----------------------------
  //
  // מודול שמחזיר את הערך הרגיש הוא "מודול גישה יחיד" בשמו בלבד. הבדיקה
  // גסה במכוון — היא מחפשת החזרה של `refreshToken` — ותפקידה לעצור את
  // ה-refactor התמים ("רק נחזיר אותו, הקורא יודע מה לעשות").
  if (files.includes(TOKEN_MODULE)) {
    for (const { line, n } of codeOf(TOKEN_MODULE)) {
      if (/return\s+refreshToken\b|return\s+stored\.refreshToken\b/.test(line)) {
        violations.push({
          file: TOKEN_MODULE,
          line: n,
          text: `★★ מודול הגישה מחזיר את ה-refresh token עצמו: ${line.trim()}`,
        });
      }
    }
  }

  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ יש גישה לטוקן מחוץ למודול הגישה היחיד.\n');
    console.error('  זה החוסם של B3′: המתג, הבאנר והיומן הם מנגנון אחד שעומד על');
    console.error('  ההנחה שיש מקום אחד שדרכו עוברת גישה. נתיב שני פירושו יומן');
    console.error('  שנשאר ריק ומסך שאומר לדורית "אף אחד לא נגע" — ולא נכון.\n');
    for (const v of violations) console.error(`  ${v.file}${v.line ? ':' + v.line : ''}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log(`✓ oauthTokens נקרא רק ב-${TOKEN_MODULE}, והטוקן עצמו לא יוצא ממנו.`);
}
