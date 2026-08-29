// ============================================================================
// check-no-model.mjs — ★★ הבדיקה שמוכיחה שאין בבנייה נתיב למודל.
//
// ---------------------------------------------------------------------------
// למה זו בדיקה ולא הצהרה ב-README
// ---------------------------------------------------------------------------
// פעמיים בפרויקט הזה נתפסנו על "זה לא אמור לרוץ" שכן היה יכול לרוץ: כלל
// הארכוב, ואז מסלול ההזמנות. שתי הפעמים ההגנה הייתה **הכוונה שלנו**, ושתי
// הפעמים הקוד לא הסכים.
//
// הסקירה (B13) קבעה את הרף: *"'הסרנו את הקוד' היא טענה על מה שנעשה"* — ולכן
// נדרשת בדיקה שמפילה build. זו היא.
//
// ---------------------------------------------------------------------------
// מה נבדק, וכל אחד למה
// ---------------------------------------------------------------------------
//  1. **`frozen/` אינו בגרף הבנייה.** לא "לא אמור להיות" — לא מגיעים אליו
//     מ-`src/main.tsx` בשום מסלול. שם יושבים המוקים של המודל, מסנן הטריאז׳
//     ומודול החשבוניות שהוקפא.
//  2. **אין סימני מודל בקוד שנבנה** — `anthropic`, `mockAgent`, `needsLlm`
//     וחבריהם. הרשימה כוללת גם את מה שנמחק לגמרי, כדי שחזרה שלו תיתפס.
//  3. **אין קריאת רשת בכלל** בקוד שנבנה. אין מודל, אין ענן, ואין לאן לפנות:
//     `fetch` בקובץ שנבנה הוא כשל בהגדרה. זו גם הבדיקה שסוגרת את המקרה
//     ש"מישהו יקרא ל-API ישירות בלי SDK".
//  4. **אין ייבוא דינמי** (`import(` עם משתנה). זה הדבר היחיד שהליכה סטטית
//     על הגרף לא יכולה לעקוב אחריו — ולכן הוא נאסר, כדי שהגרף יהיה שלם.
//  5. **`@anthropic-ai/sdk` אינו ב-`package.json` ולא בקובץ הנעילה.**
//  6. **אין `ANTHROPIC_API_KEY`** בשום קובץ קונפיג.
//
// ★ מה שהבדיקה **לא** אומרת: שאין מודל בשום מקום בעולם. היא אומרת שמה
// שנבנה — מה שרץ אצל דורית בדפדפן — לא יכול לייצר קריאה. זו הטענה שאפשר
// לעמוד מאחוריה.
// ============================================================================

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildGraph, codeOf, ROOT } from './buildGraph.mjs';

/**
 * סימנים שאסור שיופיעו בקוד שנבנה.
 *
 * הרשימה מכוונת ל**שמות מזוהים**, לא למילים כלליות: `model` לבדה הייתה
 * נדלקת על "מודל הנתונים" ומאבדת את כל האמון בבדיקה.
 */
const MODEL_MARKERS = [
  'anthropic',
  'api.anthropic.com',
  'ANTHROPIC_API_KEY',
  'claude-',
  'openai',
  'mockAgent',
  'mockAgentClassify',
  'mockInvoiceExtract',
  'redactSensitive',
  'needsLlm',
  'llmCalls',
  'AgentOutput',
  'MOCK_MODEL_ID',
  'modelId',
];

/** קריאות רשת. בקוד שנבנה אין להן שום שימוש לגיטימי. */
const NETWORK_MARKERS = [
  'fetch(',
  'XMLHttpRequest',
  'sendBeacon',
  'WebSocket',
  'EventSource',
  'axios',
  'navigator.geolocation',
];

/** ייבוא דינמי עם ביטוי — מה שהופך גרף סטטי לחלקי. */
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*[^'")]/;

export function findViolations() {
  const violations = [];
  const { files, unresolved } = buildGraph();

  for (const { file, spec } of unresolved) {
    violations.push({ file, line: 0, text: `ייבוא שלא נפתר: ${spec}`, why: 'graph' });
  }

  for (const rel of files) {
    if (rel.startsWith('frozen/')) {
      violations.push({
        file: rel,
        line: 0,
        text: 'קובץ מוקפא שנכנס לגרף הבנייה',
        why: 'frozen',
      });
      continue;
    }
    if (/\.(json|css|svg|png)$/.test(rel)) continue;

    for (const { line, n } of codeOf(rel)) {
      for (const marker of MODEL_MARKERS) {
        if (line.includes(marker)) {
          violations.push({ file: rel, line: n, text: line.trim(), why: `סימן מודל: ${marker}` });
        }
      }
      for (const marker of NETWORK_MARKERS) {
        if (line.includes(marker)) {
          violations.push({ file: rel, line: n, text: line.trim(), why: `קריאת רשת: ${marker}` });
        }
      }
      if (DYNAMIC_IMPORT_RE.test(line)) {
        violations.push({ file: rel, line: n, text: line.trim(), why: 'ייבוא דינמי' });
      }
    }
  }

  // --- מחוץ לגרף: התלויות והסודות ------------------------------------------
  const pkgPath = join(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const name of Object.keys(deps)) {
    if (/anthropic|openai|googleapis|google-auth/i.test(name)) {
      violations.push({ file: 'package.json', line: 0, text: name, why: 'תלות אסורה' });
    }
  }

  const lockPath = join(ROOT, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lock = readFileSync(lockPath, 'utf8');
    for (const name of ['@anthropic-ai/sdk', 'openai', 'googleapis']) {
      if (lock.includes(`"${name}"`)) {
        violations.push({ file: 'package-lock.json', line: 0, text: name, why: 'תלות בקובץ הנעילה' });
      }
    }
  }

  for (const rel of ['.env', '.env.example', '.env.local']) {
    const p = join(ROOT, rel);
    if (existsSync(p) && /ANTHROPIC|OPENAI/i.test(readFileSync(p, 'utf8'))) {
      violations.push({ file: rel, line: 0, text: 'מפתח API', why: 'סוד של ספק מודל' });
    }
  }

  return violations;
}

/** הקבצים שנבנים — מיוצא כדי שבדיקות אחרות ירוצו על אותה רשימה בדיוק. */
export function buildFiles() {
  return buildGraph().files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ נמצא נתיב למודל (או קריאת רשת) במה שנבנה.\n');
    console.error('  המוצר הזה קורא הזמנות דטרמיניסטית, על המחשב של המשתמשת.');
    console.error('  אין מודל, ואין לאן לשלוח. כל ממצא כאן הוא חזרה של משהו שהוסר.\n');
    for (const v of violations) {
      console.error(`  ${v.file}${v.line ? ':' + v.line : ''}  [${v.why}]  ${v.text}`);
    }
    console.error('');
    process.exit(1);
  }
  const files = buildFiles();
  console.log(`✓ אין נתיב למודל בבנייה (${files.length} קבצים בגרף, אף אחד מהם לא מ-frozen/).`);
}
