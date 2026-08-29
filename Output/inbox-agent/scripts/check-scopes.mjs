// ============================================================================
// check-scopes.mjs — ★★ בדיקת ה-scopes. מפילה build אם נוסף אחד.
//
// ---------------------------------------------------------------------------
// למה זו בדיקת CI ולא code review
// ---------------------------------------------------------------------------
// ההתחייבות שנאמרה לדורית, ושכתובה במסך ההסבר במילים האלה:
//
// > *"אם הכלי יתחיל להסתכל על משהו מעבר להודעות ההזמנות — מדברים איתך קודם.
// > **כל הרחבה = שיחה חדשה.**"*
//
// והבעיה עם ההתחייבות הזאת היא שאין לה תסמין. scope שנוסף לרשימה **לא מייצר
// מסך הסכמה חדש** אם המשתמשת כבר אישרה את ה-client, לא משנה שום דבר במסך,
// ולא מפיל שום מבחן. הוא פשוט מרחיב את מה שהכלי יכול לעשות, בשקט.
//
// זו בדיוק צורת הכשל שהסקירה חוזרת אליה: הצהרה בלי מנגנון. הבדיקה הזאת היא
// המנגנון — היא לא מונעת הרחבה, היא **מכריחה אותה להיות מודעת**: מי שמוסיף
// scope חייב לערוך גם את הקובץ שכתוב בראשו למה אסור.
//
// ---------------------------------------------------------------------------
// מה נבדק
// ---------------------------------------------------------------------------
//  1. `GMAIL_SCOPES` מכיל **בדיוק** את `gmail.readonly`, ותו לא.
//  2. אף scope מהרשימה השחורה (`gmail.modify`, `calendar`, `drive`…) אינו
//     מופיע בשום קובץ בשני הגרפים — כולל בהערות. הערה שמזכירה
//     `gmail.modify` כאפשרות היא הצעד הראשון להוספתה. ⇄ החריג היחיד:
//     `googleScopes.ts` עצמו, שם הרשימה השחורה **מוגדרת** ומתועד למה כל
//     אחד ירד.
//  3. אין מחרוזת `googleapis.com/auth/` בשום מקום מלבד `googleScopes.ts`.
//     scope שמוקלד במקום השימוש הוא scope שאף בדיקה לא רואה.
// ============================================================================

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codeOf, ROOT } from './buildGraph.mjs';
import { functionsGraph } from './functionsGraph.mjs';
import { buildFiles } from './check-no-model.mjs';

/** ★ הקובץ היחיד שמותר לו להכיל URL של scope. */
export const SCOPES_FILE = 'shared/lib/googleScopes.ts';

/** ★★ מה שמותר. אחד. */
export const ALLOWED_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/**
 * הרשימה השחורה. **מקור אחד** — נקראת מ-`googleScopes.ts` עצמו, כדי שלא
 * יהיו שתי רשימות שסוטות זו מזו.
 */
function forbiddenMarkers() {
  const src = readFileSync(join(ROOT, SCOPES_FILE), 'utf8');
  const block = src.match(
    /FORBIDDEN_SCOPE_MARKERS[^=]*=\s*\[([\s\S]*?)\]/,
  );
  if (!block) return [];
  return Array.from(block[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

const SCOPE_URL_RE = /googleapis\.com\/auth\//;

export function findViolations() {
  const violations = [];
  const forbidden = forbiddenMarkers();

  if (forbidden.length === 0) {
    violations.push({
      file: SCOPES_FILE,
      line: 0,
      text: 'לא הצלחתי לקרוא את FORBIDDEN_SCOPE_MARKERS — הבדיקה חסרת נושא',
    });
  }

  // --- 1. הרשימה עצמה. ------------------------------------------------------
  const scopesSrc = readFileSync(join(ROOT, SCOPES_FILE), 'utf8');
  const declared = Array.from(
    (scopesSrc.match(/GMAIL_SCOPES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g),
  ).map((m) => m[1]);

  if (declared.length !== ALLOWED_SCOPES.length || declared.some((s, i) => s !== ALLOWED_SCOPES[i])) {
    violations.push({
      file: SCOPES_FILE,
      line: 0,
      text: `★★ רשימת ה-scopes השתנתה. נמצא: [${declared.join(', ')}] · מותר: [${ALLOWED_SCOPES.join(', ')}]`,
    });
  }

  // --- 2 + 3. סריקה על שני הגרפים. -----------------------------------------
  const files = Array.from(new Set([...buildFiles(), ...functionsGraph().files]));

  for (const rel of files) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;

    // ★ הקובץ שמגדיר את הרשימה השחורה פטור — שם היא **מוגדרת**.
    const isScopesFile = rel === SCOPES_FILE;

    // ⚠️ כאן, בניגוד לשאר הבדיקות, נסרקות **גם שורות ההערה**.
    // `codeOf` מסנן אותן, ולכן קוראים את הקובץ ישירות: scope שהוזכר בהערה
    // ("אולי בעתיד נוסיף gmail.modify") הוא הצעד הראשון להוספתו, וזה הרגע
    // שבו כדאי שהשיחה תקרה.
    const raw = readFileSync(join(ROOT, rel), 'utf8').split('\n');

    raw.forEach((line, i) => {
      if (!isScopesFile) {
        for (const marker of forbidden) {
          if (line.includes(marker)) {
            violations.push({
              file: rel,
              line: i + 1,
              text: `★★ scope אסור: ${marker} — ${line.trim()}`,
            });
          }
        }
        if (SCOPE_URL_RE.test(line)) {
          violations.push({
            file: rel,
            line: i + 1,
            text: `URL של scope מחוץ ל-${SCOPES_FILE}: ${line.trim()}`,
          });
        }
      }
    });
  }

  // --- ★ והרשימה חייבת להיות בשימוש בפועל. ---------------------------------
  const fnFiles = functionsGraph().files;
  if (!fnFiles.includes(SCOPES_FILE)) {
    violations.push({
      file: SCOPES_FILE,
      line: 0,
      text: 'קובץ ה-scopes אינו בגרף ה-Functions — כלומר מישהו מבקש הרשאות ממקום אחר',
    });
  }
  const oauthFile = 'functions/src/lib/oauthFlow.ts';
  if (fnFiles.includes(oauthFile)) {
    const src = codeOf(oauthFile)
      .map((l) => l.line)
      .join('\n');
    if (!src.includes('SCOPE_PARAM')) {
      violations.push({
        file: oauthFile,
        line: 0,
        text: '★★ זרימת ההרשאה אינה משתמשת ב-SCOPE_PARAM',
      });
    }
    if (src.includes('include_granted_scopes')) {
      violations.push({
        file: oauthFile,
        line: 0,
        text: 'include_granted_scopes מצרף לאסימון כל הרשאה שניתנה אי-פעם — הרחבה שקטה',
      });
    }
  }

  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ רשימת ההרשאות אינה מה שהובטח.\n');
    console.error('  נאמר לדורית: "אם הכלי יתחיל להסתכל על משהו מעבר להודעות');
    console.error('  ההזמנות — מדברים איתך קודם." scope שנוסף לא מייצר מסך הסכמה');
    console.error('  חדש ולא משנה שום דבר במסך — ולכן הוא נעצר כאן.\n');
    for (const v of violations) console.error(`  ${v.file}${v.line ? ':' + v.line : ''}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log('✓ scope אחד בלבד: gmail.readonly. אין modify, אין compose, אין calendar.');
}
