// ============================================================================
// buildGraph.mjs — הליכה על גרף הייבוא מנקודת הכניסה של האפליקציה.
//
// ---------------------------------------------------------------------------
// למה גרף ולא רשימת קבצים
// ---------------------------------------------------------------------------
// כל שלוש הבדיקות בתיקייה הזאת שואלות אותה שאלה: **מה בדיוק נכנס למה
// שנבנה?** רשימת קבצים ידנית עונה על "מה שזכרנו לרשום", והיא מזדקנת בשקט
// בדיוק כשמישהו מוסיף קובץ. הליכה על הייבואים עונה על השאלה עצמה.
//
// זו הליכה **סטטית**: מ-`src/main.tsx`, לפי כל `import` / `export ... from` /
// `import(...)` שמופיע בקוד. זה בדיוק מה ש-Rollup עושה כשהוא בונה את החבילה,
// ולכן זה בדיוק מה שנכנס אליה.
//
// ★ ומה שהיא **לא** יודעת לתפוס, כדי שלא נטעה לחשוב שהיא סוגרת הכול:
// `require` דינמי עם מחרוזת מורכבת, ו-`import()` עם משתנה. שניהם לא קיימים
// בפרויקט הזה — וזו בדיוק הסיבה שהם נאסרים ב-`check-no-model.mjs`.
// ============================================================================

import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** נקודת הכניסה של האפליקציה. מה שלא מגיעים אליו מכאן — לא נבנה. */
export const ENTRY = 'src/main.tsx';

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.json'];

/** מייבאים שאינם קבצים בפרויקט (react, react-dom/client...). */
function isBare(spec) {
  return !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('@shared') && !spec.startsWith('@/');
}

function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('@shared/')) base = join(ROOT, 'shared', spec.slice('@shared/'.length));
  else if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice('@/'.length));
  else base = resolve(dirname(fromFile), spec);

  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTENSIONS.slice(1)) {
    const candidate = join(base, 'index' + ext);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * כל המפרטים שמיובאים מקובץ אחד.
 *
 * שורות הערה מסוננות **לפני** החיפוש: התיעוד בפרויקט הזה מזכיר שמות מודולים
 * בתוך גרשיים אחוריים לרוב, ובלי הסינון כל הערה הייתה נראית כמו ייבוא.
 */
export function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const code = src
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');

  const specs = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g, // import ... from '...' / export ... from '...'
    /\bimport\s+['"]([^'"]+)['"]/g, // import '...' (side effect)
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('...')
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) specs.push(m[1]);
  }
  return specs;
}

/**
 * כל הקבצים שנכנסים לחבילה, כנתיבים יחסיים לשורש הפרויקט.
 * `unresolved` הם מייבאים יחסיים שלא נמצאו — כשל בפני עצמו.
 */
export function buildGraph(entry = ENTRY) {
  const entryFile = join(ROOT, entry);
  const seen = new Set();
  const unresolved = [];
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop();
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (/\.(json|css|svg|png)$/.test(file)) continue;

    for (const spec of importsOf(file)) {
      if (isBare(spec)) continue;
      const target = resolveSpec(spec, file);
      if (!target) {
        unresolved.push({ file: rel, spec });
        continue;
      }
      stack.push(target);
    }
  }

  return { files: Array.from(seen).sort(), unresolved };
}

/** קריאת קובץ מהגרף, בלי שורות הערה — לבדיקות תוכן. */
export function codeOf(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    });
}
