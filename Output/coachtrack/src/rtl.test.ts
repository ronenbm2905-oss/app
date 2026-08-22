/**
 * בדיקת RTL וכיסוי מצבים — מקצה לקצה, מכנית (TASKS שלב 6, סעיפים ה׳ ו-ו׳).
 *
 * ## מה זו הבדיקה הזו, ומה היא אינה
 *
 * אין לי דפדפן. "בדקתי RTL בעיניים" הוא משפט שאסור לי לכתוב. מה שכן אפשר
 * לעשות בלי דפדפן הוא לאכוף את הכללים ש**גורמים** ל-RTL להישבר, על כל קובץ
 * בפרויקט בבת אחת:
 *
 * 1. **אין מחלקות כיווניות קשיחות.** כלל 1 ב-CLAUDE.md אוסר `ml-*`/`mr-*`,
 *    `text-left`/`text-right`, `left-*`/`right-*` וחבריהם. המקבילות הלוגיות
 *    (`ms-*`, `me-*`, `text-start`, `start-*`) מתהפכות מעצמן. הסריקה עוברת
 *    על כל ה-`.tsx`, ה-`.css` וה-`.html` — כולל `offline.html`, שנכתב מחוץ
 *    ל-React ולכן קל לשכוח אותו.
 *
 * 2. **כל מסך אומר משהו בכל מצב.** מסך שמקבל `LoadStatus` חייב לטפל
 *    במפורש ב-`loading` וב-`error`. מסך לבן הוא לא מצב לגיטימי — וזו בדיוק
 *    הדרישה בסעיף ה׳ של שלב 6.
 *
 * 3. **המסמך עצמו מוגדר עברית-RTL** — ב-`index.html`, ב-`offline.html`
 *    וב-manifest של ה-PWA. אנדרואיד קורא את `dir` ו-`lang` מה-manifest
 *    כשהוא מציג את שם האפליקציה, ולא מ-`index.html`.
 *
 * מה שנשאר לעין אנושית: שהטבלה באמת נגללת נכון בטלפון, ושכיווני החיצים
 * והריווח נראים טוב. זה רשום בדיווח כפריט לבדיקה בעיניים.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string, extensions: string[]): string[] {
  const found: string[] = [];

  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const path = join(dir, name);

    if (statSync(path).isDirectory()) found.push(...walk(path, extensions));
    else if (extensions.some((extension) => name.endsWith(extension))) found.push(path);
  }

  return found;
}

const SOURCE_FILES = [
  ...walk(join(ROOT, 'src'), ['.tsx', '.css']),
  join(ROOT, 'index.html'),
  join(ROOT, 'public', 'offline.html'),
].filter((path) => !path.includes('.test.'));

/**
 * המחלקות שמקבעות כיוון.
 *
 * גבולות המילה חשובים: `border-red-200` אינו `border-r`, ו-`text-red-700`
 * אינו `text-right`. `-mr-2` (מרווח שלילי) כן נתפס.
 */
const FORBIDDEN: { pattern: RegExp; instead: string }[] = [
  { pattern: /-?\bm[lr]-[\w.[\]]+/g, instead: 'ms-* / me-*' },
  { pattern: /-?\bp[lr]-[\w.[\]]+/g, instead: 'ps-* / pe-*' },
  { pattern: /\btext-(left|right)\b/g, instead: 'text-start / text-end' },
  { pattern: /\b(left|right)-[\w.[\]]+/g, instead: 'start-* / end-*' },
  { pattern: /\bborder-[lr]\b/g, instead: 'border-s / border-e' },
  { pattern: /\brounded-([lr]|[tb][lr])-/g, instead: 'rounded-s-* / rounded-e-*' },
  { pattern: /\bfloat-(left|right)\b/g, instead: 'float-start / float-end' },
  { pattern: /\bmargin-(left|right)\s*:/g, instead: 'margin-inline-start/end' },
  { pattern: /\bpadding-(left|right)\s*:/g, instead: 'padding-inline-start/end' },
  { pattern: /\btext-align\s*:\s*(left|right)\b/g, instead: 'text-align: start/end' },
];

describe('RTL — אין כיוון קשיח בשום קובץ', () => {
  it('נסרקו הקבצים שבאמת קיימים', () => {
    // בלם: תקלה בהליכה על התיקיות הייתה הופכת את הטסט הבא לירוק-ריק.
    expect(SOURCE_FILES.length).toBeGreaterThan(30);
    expect(SOURCE_FILES.some((path) => path.endsWith('offline.html'))).toBe(true);
    expect(SOURCE_FILES.some((path) => path.endsWith('index.css'))).toBe(true);
  });

  it('אין מחלקות או תכונות שמקבעות ימין/שמאל', () => {
    const violations: string[] = [];

    for (const path of SOURCE_FILES) {
      const source = readFileSync(path, 'utf8');

      source.split('\n').forEach((line, index) => {
        for (const { pattern, instead } of FORBIDDEN) {
          const matches = line.match(pattern);
          if (!matches) continue;
          violations.push(
            `${path.slice(ROOT.length)}:${index + 1} → ${matches.join(', ')} (במקום ${instead})`,
          );
        }
      });
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('RTL — המסמך מוגדר עברית', () => {
  it('index.html הוא lang="he" dir="rtl"', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('<html lang="he" dir="rtl">');
  });

  it('offline.html הוא lang="he" dir="rtl" — הוא נטען בלי React', () => {
    const html = readFileSync(join(ROOT, 'public', 'offline.html'), 'utf8');
    expect(html).toContain('<html lang="he" dir="rtl">');
  });

  it('ה-manifest מצהיר על עברית ו-rtl', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'public', 'manifest.webmanifest'), 'utf8'),
    ) as Record<string, unknown>;

    expect(manifest.lang).toBe('he');
    expect(manifest.dir).toBe('rtl');
  });
});

/* ------------------------------------------------------------------ */
/* אין מסך לבן                                                         */
/* ------------------------------------------------------------------ */

/** כל קומפוננטת תצוגה שמקבלת `LoadStatus` — היא זו שאמורה לטפל במצבים. */
const STATUS_VIEWS = walk(join(ROOT, 'src', 'features'), ['.tsx'])
  .filter((path) => !path.includes('.test.'))
  .filter((path) => /\bstatus:\s*LoadStatus\b/.test(readFileSync(path, 'utf8')));

describe('אין מסך שנשאר לבן', () => {
  it('נמצאו מסכי התצוגה של כל התפקידים', () => {
    const names = STATUS_VIEWS.map((path) => path.split(/[\\/]/).pop());
    expect(names).toEqual(
      expect.arrayContaining([
        'CoachDashboardView.tsx',
        'TeamView.tsx',
        'PlanView.tsx',
        'ExerciseLibraryView.tsx',
        'ReportsView.tsx',
        'MyWeekView.tsx',
        'HistoryView.tsx',
      ]),
    );
  });

  it('כל מסך מטפל במפורש גם ב-loading וגם ב-error', () => {
    const missing: string[] = [];

    for (const path of STATUS_VIEWS) {
      const source = readFileSync(path, 'utf8');
      if (!source.includes("status === 'loading'")) missing.push(`${path} — אין מצב טעינה`);
      if (!source.includes("status === 'error'")) missing.push(`${path} — אין מצב שגיאה`);
    }

    expect(missing, missing.join('\n')).toEqual([]);
  });
});
