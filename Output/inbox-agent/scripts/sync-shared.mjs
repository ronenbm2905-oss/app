// ============================================================================
// sync-shared.mjs — מעתיק `shared/` אל `functions/src/shared/` לפני build.
//
// למה העתקה ולא symlink / workspaces: symlink שביר ב-Windows ובאריזת ה-deploy
// של Firebase, ו-workspaces מסבכים את הפאקג'ינג. העתקה היא הדבר המשעמם
// שעובד. אותה תבנית בדיוק כמו ב-`Output/hachzarei-mas/scripts/sync-shared.mjs`.
//
// ---------------------------------------------------------------------------
// ★★ ולמה זה חשוב כאן במיוחד, ולא רק נוח
// ---------------------------------------------------------------------------
// `shared/lib/orderSource.ts` הוא **אתר הקריאה היחיד** (B12), ו-
// `shared/lib/gmailContract.ts` הוא **השער** שדורש `format:'raw'` וכותרת
// חתימה. אם ה-Functions היו מחזיקים עותק משלהם שנערך בנפרד, היו לנו שני
// אתרי קריאה ושני שערים — כלומר בדיוק מה ששתי הבקרות נועדו למנוע, בצורה
// שנראית בקוד review כמו סדר.
//
// ⛔ **`functions/src/shared/` הוא תוצר. אסור לערוך אותו ידנית**, והוא
// ב-.gitignore. מקור האמת הוא `shared/` בשורש.
// ============================================================================

import { cp, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'shared');
const to = resolve(root, 'functions/src/shared');

await rm(to, { recursive: true, force: true });
await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });

console.log('shared/ -> functions/src/shared/');
