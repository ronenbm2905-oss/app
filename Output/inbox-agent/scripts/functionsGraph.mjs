// ============================================================================
// functionsGraph.mjs — הליכה על גרף הייבוא של ה-Cloud Functions.
//
// ---------------------------------------------------------------------------
// למה גרף שני, ולא הרחבה של `buildGraph.mjs`
// ---------------------------------------------------------------------------
// כי שתי נקודות הכניסה שונות במהות: `src/main.tsx` הוא מה שרץ **בדפדפן של
// דורית**, ו-`functions/src/index.ts` הוא מה שרץ **בשרת עם גישה לתיבה
// שלה**. חלק מהבדיקות חלות על שניהם (אתר קריאה יחיד, איסור `console.`),
// וחלק על אחד בלבד: קריאת רשת אסורה בקליינט ו**נדרשת** בשרת.
//
// גרף אחד מאוחד היה מחייב חריגים לפי תיקייה, וחריג שנכתב פעם אחת מתרחב.
//
// ---------------------------------------------------------------------------
// ★★ ההפניה: `functions/src/shared/**` → `shared/**`
// ---------------------------------------------------------------------------
// `functions/src/shared/` הוא **עותק** ש-`sync-shared.mjs` מייצר לפני build.
// הבדיקות רצות על **מקור האמת** בשורש, ולא על העותק, משתי סיבות:
//
//  1. הבדיקה חייבת לעבוד גם לפני שהריצו סנכרון — אחרת `npm run build` ידווח
//     "אין קבצים" במקום "עברתי", וזו התוצאה הכי גרועה: בדיקה שנראית ירוקה
//     כי היא לא בדקה כלום.
//  2. אם מישהו יערוך את העותק ידנית, ההודעה שהוא צריך לקבל היא "זה תוצר" —
//     ולא ממצא על שורה שהוא רשאי לשנות במקור.
// ============================================================================

import { existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { importsOf, ROOT } from './buildGraph.mjs';

/** נקודת הכניסה של ה-Functions. */
export const FUNCTIONS_ENTRY = 'functions/src/index.ts';

const EXTENSIONS = ['', '.ts', '.js', '.json'];

function isBare(spec) {
  return !spec.startsWith('.') && !spec.startsWith('/');
}

function resolveSpec(spec, fromFile) {
  let base = resolve(dirname(fromFile), spec);

  // ★★ ההפניה. ראה ההערה בראש הקובץ.
  const sharedCopy = join(ROOT, 'functions', 'src', 'shared');
  if (base.startsWith(sharedCopy)) {
    base = join(ROOT, 'shared', base.slice(sharedCopy.length));
  }

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

/** כל הקבצים שנכנסים לחבילת ה-Functions, כנתיבים יחסיים לשורש. */
export function functionsGraph(entry = FUNCTIONS_ENTRY) {
  const entryFile = join(ROOT, entry);
  const seen = new Set();
  const unresolved = [];
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop();
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (/\.json$/.test(file)) continue;

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

export function functionsFiles() {
  return functionsGraph().files;
}
