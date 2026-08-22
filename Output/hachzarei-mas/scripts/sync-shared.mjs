/**
 * מעתיק את `shared/` אל `functions/src/shared/` לפני build של הפונקציות.
 *
 * למה לא symlink / workspaces: symlink שביר ב-Windows ובאריזת ה-deploy של
 * Firebase, ו-workspaces מסבכים את הפאקג'ינג. העתקה היא הדבר המשעמם שעובד,
 * והיא שומרת על מקור אמת יחיד — `functions/src/shared/` נמצא ב-.gitignore
 * ואסור לערוך אותו ידנית.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'shared');
const to = resolve(root, 'functions/src/shared');

await rm(to, { recursive: true, force: true });
await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });

console.log(`shared/ -> functions/src/shared/`);
