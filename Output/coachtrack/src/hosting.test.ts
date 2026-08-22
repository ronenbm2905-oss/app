/**
 * טסטים ל-`firebase.json` — כותרות ה-Cache ונכסי ה-PWA.
 *
 * ## הבאג שהטסט הזה קיים בשבילו
 *
 * ב-Firebase Hosting, `source` של כותרת נבדק מול **הנתיב שהתבקש**, לא מול
 * היעד של ה-rewrite. באפליקציית SPA זה אומר שהכלל
 *
 *     { "source": "/index.html", "Cache-Control": "no-cache" }
 *
 * **לא חל על אף ניווט אמיתי.** משתמש שנכנס ל-`/coach` מבקש את `/coach`;
 * ה-rewrite מגיש לו את תוכן `index.html`, אבל הכותרת שהוא מקבל היא
 * ברירת המחדל של Firebase (`max-age=3600`) ולא `no-cache`. התוצאה: עד שעה
 * שלמה של גרסה ישנה אחרי deploy — בדיוק התקלה שרונן כבר חטף בפרויקט אחר,
 * והכלל שנועד למנוע אותה פשוט לא נגע בה.
 *
 * לכן **כל נתיב ניווט מקבל כותרת משלו**, והטסט הזה אוכף שהרשימה ב-
 * `firebase.json` מכסה את `ROUTES` בשלמותו. מסך חדש שיתווסף בלי כותרת
 * ייפול כאן ולא אצל רונן שבוע אחרי ה-deploy.
 *
 * ⚠️ מה שהטסט **לא** יכול לבדוק: איך Firebase מתנהג בפועל. זה דורש
 * `curl -I` מול האתר החי אחרי deploy, והוא רשום בדיווח כפריט לרונן.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ROUTES } from './lib/routing';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const hosting = (
  JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8')) as {
    hosting: { headers: HeaderRule[]; rewrites: { source: string; destination: string }[] };
  }
).hosting;

/** האם הכלל מכסה את הנתיב. תומך בתבניות שבשימוש כאן: מדויק ו-`prefix/**`. */
function covers(source: string, path: string): boolean {
  if (source === path) return true;
  if (source.endsWith('/**')) return path.startsWith(source.slice(0, -2));
  return false;
}

function cacheControlFor(path: string): string | null {
  // Firebase מחיל את כל הכללים שמתאימים; המאוחר גובר. לכן האחרון.
  const matching = hosting.headers.filter((rule) => covers(rule.source, path));
  const values = matching.flatMap((rule) =>
    rule.headers.filter((header) => header.key === 'Cache-Control').map((header) => header.value),
  );
  return values.length === 0 ? null : values[values.length - 1];
}

describe('כותרות Cache לניווטים', () => {
  it('יש rewrite שמפנה כל נתיב ל-index.html', () => {
    // בלעדיו כל הדיון על הכותרות לא רלוונטי — הניווטים היו מחזירים 404.
    expect(hosting.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
  });

  it('כל נתיב ב-ROUTES מקבל no-cache — כולל השורש', () => {
    const missing: string[] = [];

    for (const path of ['/', ...Object.values(ROUTES)]) {
      const value = cacheControlFor(path);
      if (!value || !value.includes('no-cache')) {
        missing.push(`${path} → ${value ?? 'אין כותרת בכלל'}`);
      }
    }

    expect(missing, `נתיבים בלי no-cache:\n${missing.join('\n')}`).toEqual([]);
  });

  it('נכסים עם hash בשם נשארים immutable — שם אין סכנת התיישנות', () => {
    const value = cacheControlFor('/assets/index-C_gT954-.css');
    expect(value).toContain('immutable');
    expect(value).not.toContain('no-cache');
  });

  it('sw.js לעולם לא נשמר ב-cache — SW ישן שורד deploy', () => {
    expect(cacheControlFor('/sw.js')).toContain('no-cache');
  });

  it('offline.html ו-manifest מתרעננים ב-deploy', () => {
    expect(cacheControlFor('/offline.html')).toContain('no-cache');
    expect(cacheControlFor('/manifest.webmanifest')).toContain('no-cache');
  });
});
