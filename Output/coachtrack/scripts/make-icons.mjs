/**
 * יוצר את אייקוני ה-PWA ל-`public/icons/`.
 *
 * הרצה:  node scripts/make-icons.mjs
 *
 * ## למה סקריפט ולא קובץ שנגרר לתיקייה
 *
 * האייקונים הם **placeholder מכוון** — איתי יחליף אותם אם רונן ירצה מיתוג
 * אמיתי. עד אז הם צריכים להיות (א) תקינים כ-PNG, (ב) בגדלים שאנדרואיד
 * ו-iOS באמת מבקשים, ו-(ג) ניתנים ליצירה מחדש בלי שום כלי חיצוני. לכן
 * הכל כאן: מקודד PNG על `zlib` המובנה של Node, בלי sharp, בלי canvas,
 * ובלי להוסיף תלות (CLAUDE.md — "אין להוסיף ספריות חדשות בלי לשאול").
 *
 * ## שלושת הגדלים ולמה כל אחד
 *
 * | קובץ | למי |
 * |---|---|
 * | `icon-192.png` | מינימום של אנדרואיד ל"הוסף למסך הבית" |
 * | `icon-512.png` | מסך הפתיחה (splash) של אנדרואיד |
 * | `icon-maskable-512.png` | `purpose: "maskable"` — אנדרואיד חותך אותו לצורה של המכשיר |
 * | `apple-touch-icon.png` | iOS. **מתעלם מה-manifest לגמרי** וקורא רק את תג ה-link |
 *
 * ⚠️ **ההבדל בין `any` ל-`maskable` הוא לא תיאורטי.** אנדרואיד חותך אייקון
 * maskable לעיגול/סקוויקל ומבטיח רק את ה-80% הפנימיים ("safe zone"). כדור
 * שממלא את הרוחב ייחתך בצדדים ויראה שבור. לכן בגרסת ה-maskable הכדור קטן
 * יותר והרקע מלא — ריבוע בלי פינות מעוגלות, כי המערכת ממילא מעגלת.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** slate-900 — אותו צבע כמו `theme-color` ב-index.html. */
const BACKGROUND = [15, 23, 42];
/** orange-500 — כדורסל. */
const BALL = [249, 115, 22];

/* ------------------------------------------------------------------ */
/* מקודד PNG                                                           */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** `rgba` הוא Uint8Array באורך width*height*4. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // עומק ביט
  header[9] = 6; // RGBA
  header[10] = 0; // דחיסה
  header[11] = 0; // פילטר
  header[12] = 0; // בלי interlace

  // כל שורה מקבלת בית פילטר 0 ("None") — הדחיסה של zlib מספיקה כאן בהחלט.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* הציור                                                               */
/* ------------------------------------------------------------------ */

/**
 * צבע הדגימה בנקודה (x, y) — או `null` כשהיא מחוץ לרקע (פינה מעוגלת).
 *
 * הכל אנליטי (מרחקים ורדיוסים) ולא ספרייה גרפית, כי הצורה פשוטה: ריבוע
 * מעוגל, עיגול, וארבעה תפרים. הריכוך נעשה בקורא (`render`) בעזרת
 * supersampling — 3×3 דגימות לפיקסל.
 */
function sample(x, y, size, radius, cornerRadius) {
  const c = size / 2;

  // פינות מעוגלות: מחוץ לרדיוס הפינה → שקוף.
  if (cornerRadius > 0) {
    const dx = Math.abs(x - c) - (c - cornerRadius);
    const dy = Math.abs(y - c) - (c - cornerRadius);
    if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > cornerRadius) return null;
  }

  const distance = Math.hypot(x - c, y - c);
  if (distance > radius) return BACKGROUND;

  const seam = radius * 0.075;

  // קו אנכי וקו אופקי דרך מרכז הכדור.
  if (Math.abs(x - c) < seam / 2) return BACKGROUND;
  if (Math.abs(y - c) < seam / 2) return BACKGROUND;

  // שני התפרים המעוגלים.
  //
  // כל תפר הוא קשת שיוצאת מהקוטב העליון, מתנפחת הצידה, וחוזרת לקוטב התחתון.
  // מרכז המעגל שמייצר אותה יושב על הציר האופקי — ובצד ה**נגדי** לכיוון
  // ההתנפחות. `BULGE` הוא עד כמה הקשת מתרחקת מהמרכז, כשבר מרדיוס הכדור;
  // ממנו נגזרים המרחק והרדיוס כך שהקשת תעבור בדיוק בשני הקטבים:
  //
  //   hypot(d, R) = d + k·R   →   d = R(1 − k²) / 2k
  //
  // ⚠️ 0.8 הוא לא שרירותי. ערך **קטן** מדי מקרב את שתי הקשתות למרכז עד
  // שהן חונקות את הקו האנכי, והאייקון מפסיק להיראות ככדורסל ומתחיל
  // להיראות כמו גלובוס. זה בדיוק מה שקרה בגרסה הראשונה (1.15R, שהיא
  // התנפחות של 0.38 — הקשתות עברו מעבר למרכז).
  const BULGE = 0.8;
  const offset = (radius * (1 - BULGE * BULGE)) / (2 * BULGE);
  const arcRadius = Math.hypot(offset, radius);
  for (const cx of [c - offset, c + offset]) {
    if (Math.abs(Math.hypot(x - cx, y - c) - arcRadius) < seam / 2) return BACKGROUND;
  }

  return BALL;
}

/**
 * `ballRatio` — רדיוס הכדור כשבר מהגודל.
 * `cornerRatio` — רדיוס פינה כשבר מהגודל. 0 = ריבוע מלא (maskable).
 */
function render(size, ballRatio, cornerRatio) {
  const rgba = new Uint8Array(size * size * 4);
  const radius = size * ballRatio;
  const cornerRadius = size * cornerRatio;
  const steps = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < steps; sy += 1) {
        for (let sx = 0; sx < steps; sx += 1) {
          const color = sample(
            x + (sx + 0.5) / steps,
            y + (sy + 0.5) / steps,
            size,
            radius,
            cornerRadius,
          );
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 255;
          }
        }
      }

      const samples = steps * steps;
      const index = (y * size + x) * 4;
      // חלוקה ב-samples ולא ב-a/255: פיקסל שקוף למחצה שומר על צבע נכון.
      const covered = a === 0 ? 1 : a / 255;
      rgba[index] = Math.round(r / covered);
      rgba[index + 1] = Math.round(g / covered);
      rgba[index + 2] = Math.round(b / covered);
      rgba[index + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, rgba);
}

/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

const FILES = [
  // any — הכדור ממלא את רוב הריבוע, פינות מעוגלות כמו אייקון רגיל.
  { name: 'icon-192.png', size: 192, ball: 0.34, corner: 0.22 },
  { name: 'icon-512.png', size: 512, ball: 0.34, corner: 0.22 },
  // maskable — כדור קטן יותר בתוך ה-80% הפנימיים, רקע מלא בלי פינות.
  { name: 'icon-maskable-512.png', size: 512, ball: 0.26, corner: 0 },
  // iOS — ריבוע מלא; המערכת מעגלת בעצמה.
  { name: 'apple-touch-icon.png', size: 180, ball: 0.32, corner: 0 },
];

for (const file of FILES) {
  const png = render(file.size, file.ball, file.corner);
  writeFileSync(join(OUT_DIR, file.name), png);
  console.log(`✓ ${file.name} — ${file.size}×${file.size}, ${png.length} bytes`);
}
