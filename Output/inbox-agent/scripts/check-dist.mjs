// ============================================================================
// check-dist.mjs — ★★ הבדיקה על **התוצר**, אחרי ה-build.
//
// ---------------------------------------------------------------------------
// למה גם על התוצר, כשיש כבר בדיקה על המקור
// ---------------------------------------------------------------------------
// `check-no-model.mjs` הולך על גרף הייבוא **במקור**. זו בדיקה חזקה, אבל היא
// בדיקה על מה שכתבנו. הקובץ הזה בודק את מה ש**נשלח בפועל** — הבייטים שירוצו
// בדפדפן של דורית, אחרי כלי הבנייה, אחרי התוספים ואחרי ה-minify.
//
// ההבדל אינו תיאורטי: ה-polyfill של `modulePreload` ב-Vite הוסיף לחבילה
// `fetch(` שלא הופיע בשום קובץ מקור. הוא היה תמים לחלוטין (הוא מושך את קובצי
// ה-JS שלנו עצמם), אבל הוא היה הופך את המשפט "אין קריאת רשת בתוצר" למשפט
// שצריך להסביר אותו. במקום להסביר — כיבינו אותו ב-`vite.config.ts`.
//
// **בקרה שיש לה חריג אחד מוסבר היא בקרה שאף אחד לא קורא בפעם השנייה.**
// ============================================================================

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** סימנים שאסור שיופיעו בבייטים שנשלחים. */
const BANNED = [
  'anthropic',
  'openai',
  'api.anthropic',
  'ANTHROPIC',
  'fetch(',
  'XMLHttpRequest',
  'sendBeacon',
  'WebSocket(',
  'EventSource',
  // שרידי מסכים שהוקפאו או נמחקו. אם אחד מהם צץ בתוצר — משהו חזר לגרף.
  'mockAgent',
  'needsLlm',
  'llmCalls',
  'דוח הבוקר',
  'החשבוניות שלך',
];

/** ומה שחייב להיות שם — כדי ש"נקי" לא יהיה "ריק". */
// ★ מחרוזות ולא ביטויים: השאילתה נבנית בזמן ריצה מהשולח ומהנושא, ולכן
// `from:pay@...` המלא אינו קיים כמחרוזת אחת בתוצר. מחפשים את החלקים שכן.
const REQUIRED = ['ההזמנות של היום', 'התוכנה ורונן', 'pay@tranzila.com', 'newer_than:'];

export function findViolations() {
  if (!existsSync(dist)) return [{ file: 'dist', text: 'התיקייה לא קיימת — לא נבנה כלום' }];

  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (/\.(js|css|html)$/.test(name.name)) files.push(p);
    }
  };
  walk(dist);

  const violations = [];
  const all = files.map((f) => ({ f, s: readFileSync(f, 'utf8') }));

  for (const { f, s } of all) {
    for (const marker of BANNED) {
      if (s.includes(marker)) {
        violations.push({ file: f.replace(root, '').replace(/\\/g, '/'), text: `נמצא: ${marker}` });
      }
    }
  }

  const joined = all.map((x) => x.s).join('\n');
  for (const marker of REQUIRED) {
    if (!joined.includes(marker)) {
      violations.push({ file: 'dist', text: `חסר בתוצר: ${marker}` });
    }
  }

  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ התוצר שנבנה אינו מה שהתכוונו לשלוח.\n');
    for (const v of violations) console.error(`  ${v.file}  ${v.text}`);
    console.error('');
    process.exit(1);
  }
  console.log('✓ התוצר נקי: אין קריאת רשת, אין סימני מודל, ויש בו את מה שצריך.');
}
