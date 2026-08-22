/**
 * יוצר את אייקוני ה-PWA ל-`public/icons/`.
 *
 * הרצה:  node scripts/make-icons.mjs
 *
 * ## למה סקריפט ולא קובץ שנגרר לתיקייה
 *
 * האייקונים צריכים להיות (א) תקינים כ-PNG, (ב) בגדלים שאנדרואיד ו-iOS באמת
 * מבקשים, ו-(ג) ניתנים ליצירה מחדש בלי שום כלי חיצוני. לכן הכל כאן: מקודד PNG
 * על `zlib` המובנה של Node, בלי sharp, בלי canvas, ובלי להוסיף תלות
 * (CLAUDE.md — "אין להוסיף ספריות חדשות בלי לשאול").
 *
 * ## ארבעת הקבצים ולמה כל אחד
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
 *
 * ────────────────────────────────────────────────────────────────────────
 *
 * ## הכדור — למה גיאומטריה תלת-ממדית ולא קשתות מצוירות
 *
 * הגרסה הקודמת ציירה על עיגול כתום ארבעה תפרים "ידניים": קו אנכי, קו אופקי,
 * ושתי קשתות שמתנפחות הצידה ונפגשות בשני הקטבים. **זה יצא גלובוס, לא כדורסל** —
 * ובצדק: קשתות שמתכנסות לשתי נקודות אנטיפודיות הן בדיוק ההגדרה של קווי אורך.
 * שינוי הבליטה, עיבוי הקווים והטיית כל התבנית לא הצילו את זה; הם רק ייצרו
 * גלובוס מוטה.
 *
 * מה שכן פותר את זה הוא לצייר את הדבר האמיתי. כדורסל הוא כדור שחתוך בשלושה
 * מעגלים גדולים **מאונכים זה לזה** (8 פאנלים). התכונה החשובה: כשמסתכלים עליו
 * מכיוון כלשהו שאינו אחד הצירים, שלושת המעגלים מוקרנים לשלוש אליפסות שנפגשות
 * בזוויות — התפרים סוחפים על פני הכדור ו**לא** מתכנסים לקטבים. זה ההבדל
 * הוויזואלי בין כדורסל לגלובוס.
 *
 * המימוש פר-פיקסל, אנליטי לגמרי, בלי מנוע גרפי:
 *
 *   1. מנרמלים את הפיקסל ל-(u, v) ביחס לרדיוס הכדור. מחוץ ל-1 → רקע.
 *   2. z = √(1 − u² − v²) — הנקודה על ההמיספרה הקדמית. כך מקבלים חינם גם
 *      הסתרה של הצד האחורי וגם קיצור פרספקטיבי: תפר נראה דק יותר ליד השפה,
 *      בדיוק כמו בכדור אמיתי.
 *   3. מסובבים את הנקודה למערכת הצירים של הכדור (Q = Mᵀ·P).
 *   4. שלושת המעגלים הגדולים הם המישורים x=0, y=0, z=0 במערכת הזאת, ולכן
 *      התנאי "אני על תפר" הוא פשוט min(|Qx|, |Qy|, |Qz|) < SEAM.
 *
 * ⚠️ **הזווית היא לא קישוט.** ב-(0°, 0°) אחד המעגלים מתלכד עם קו המתאר
 * ושני האחרים מוקרנים לקו אנכי וקו אופקי — כלומר צלב על עיגול, שזה שוב
 * גלובוס. בקצה השני, מבט לאורך האלכסון של הקובייה (~45°/35°) נותן שלוש
 * אליפסות שוות שנראות ככדור חוף או כמודל אטום. הטווח שעובד צר: **20°–30°
 * בשני הצירים.** נבדק ויזואלית בכל הגדלים לפני שנבחר.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** slate-900 — אותו צבע כמו `theme_color` ב-manifest. גם הרקע וגם התפרים. */
const BACKGROUND = [15, 23, 42];
/** orange-500 — הכדור. צבע שטוח, בלי גרדיאנט: גרדיאנט נראה בוצי ב-48px. */
const BALL = [249, 115, 22];

/** זוויות הצפייה על הכדור (מעלות). ראה האזהרה בראש הקובץ — 20°–30°. */
const PITCH = 26;
const YAW = 28;

/** חצי-רוחב התפר, כשבר מרדיוס הכדור. */
const SEAM = 0.09;

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

/** מטריצת סיבוב R = Ry(yaw)·Rx(pitch). השורות הן וקטורי הבסיס. */
const ROTATION = (() => {
  const p = (PITCH * Math.PI) / 180;
  const y = (YAW * Math.PI) / 180;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  return [
    [cy, sy * sp, sy * cp],
    [0, cp, -sp],
    [-sy, cy * sp, cy * cp],
  ];
})();

/**
 * צבע הדגימה בנקודה (x, y) — או `null` כשהיא מחוץ לרקע (פינה מעוגלת).
 *
 * `ballRatio` — רדיוס הכדור כשבר מהגודל.
 * `cornerRatio` — רדיוס פינה כשבר מהגודל. 0 = ריבוע מלא.
 *
 * הריכוך נעשה בקורא (`render`) בעזרת supersampling — 4×4 דגימות לפיקסל.
 */
function sample(x, y, size, ballRatio, cornerRatio) {
  const c = size / 2;
  const radius = size * ballRatio;
  const cornerRadius = size * cornerRatio;

  // פינות מעוגלות: מחוץ לרדיוס הפינה → שקוף.
  if (cornerRadius > 0) {
    const dx = Math.abs(x - c) - (c - cornerRadius);
    const dy = Math.abs(y - c) - (c - cornerRadius);
    if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > cornerRadius) return null;
  }

  // נרמול לקואורדינטות של הכדור: מחוץ לעיגול היחידה → רקע.
  const u = (x - c) / radius;
  const v = (y - c) / radius;
  const rr = u * u + v * v;
  if (rr > 1) return BACKGROUND;

  // ההמיספרה הקדמית. z הוא מה שהופך את זה לכדור ולא לעיגול.
  const z = Math.sqrt(1 - rr);

  // Q = Rᵀ·P — הנקודה במערכת הצירים של הכדור.
  const M = ROTATION;
  const qx = M[0][0] * u + M[1][0] * v + M[2][0] * z;
  const qy = M[0][1] * u + M[1][1] * v + M[2][1] * z;
  const qz = M[0][2] * u + M[1][2] * v + M[2][2] * z;

  // שלושת המעגלים הגדולים = שלושת מישורי הצירים.
  if (Math.abs(qx) < SEAM || Math.abs(qy) < SEAM || Math.abs(qz) < SEAM) {
    return BACKGROUND;
  }

  return BALL;
}

function render(size, ballRatio, cornerRatio) {
  const rgba = new Uint8Array(size * size * 4);
  const steps = 4;

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
            ballRatio,
            cornerRatio,
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
      // חלוקה ב-covered ולא ב-samples: פיקסל שקוף למחצה שומר על צבע נכון.
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
  // any — הכדור ממלא 80% מהרוחב, פינות מעוגלות כמו אייקון רגיל.
  { name: 'icon-192.png', size: 192, ball: 0.4, corner: 0.22 },
  { name: 'icon-512.png', size: 512, ball: 0.4, corner: 0.22 },
  // maskable — כדור על 64% מהרוחב, עמוק בתוך ה-80% הבטוחים. רקע מלא בלי פינות.
  { name: 'icon-maskable-512.png', size: 512, ball: 0.32, corner: 0 },
  // iOS — ריבוע מלא; המערכת מעגלת בעצמה, ולכן רק הפינות נחתכות.
  { name: 'apple-touch-icon.png', size: 180, ball: 0.38, corner: 0 },
];

for (const file of FILES) {
  const png = render(file.size, file.ball, file.corner);
  writeFileSync(join(OUT_DIR, file.name), png);
  console.log(`✓ ${file.name} — ${file.size}×${file.size}, ${png.length} bytes`);
}
