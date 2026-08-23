/**
 * נכשל אם פרט פנימי הגיע ל-`dist/`.
 *
 * הרקע: משה ביקש מפורשות שמספר הרישיון לא יופיע בשום מקום בדף. הוא אכן
 * לא מוצג — אבל "לא מוצג" ו"לא נשלח לדפדפן" הם שני דברים שונים, ועד
 * שהוצא ל-`internal.ts` מה שהחזיק אותו בחוץ היה tree-shaking בלבד.
 * שורת `import` אחת בקומפוננטה עתידית הייתה מחזירה אותו בשקט.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// ⚠️ תיבת הדוא"ל **אינה** ברשימה בכוונה. היא כתובת מימוש הזכויות
// ש-privacy.html חייב להציג לגולש — כלומר פרסום מכוון, לא דליפה.
// ההוראה של משה נגעה למספר הרישיון בלבד.
const FORBIDDEN = [
  { value: '46180', why: 'מספר רישיון — משה ביקש שלא יוצג בשום מקום בדף' },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const hits = [];
for await (const file of walk(dist)) {
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const { value, why } of FORBIDDEN) {
    if (text.includes(value)) {
      hits.push(`  ${file.replace(dist, 'dist')} → "${value}" (${why})`);
    }
  }
}

if (hits.length) {
  console.error(['', '✗ פרט פנימי דלף ל-bundle:', ...hits, ''].join('\n'));
  process.exit(1);
}

console.log('✓ verify-bundle: אין פרטים פנימיים ב-dist/');
