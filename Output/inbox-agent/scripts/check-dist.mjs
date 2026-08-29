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
  // שרידי מסכים שהוקפאו או נמחקו. אם אחד מהם צץ בתוצר — משהו חזר לגרף.
  'mockAgent',
  'needsLlm',
  'llmCalls',
  'דוח הבוקר',
  'החשבוניות שלך',
];

// ============================================================================
// ⇄ פרוסה 1 — הבקרה על הרשת **החליפה צורה**, ולא נחלשה
// ============================================================================
//
// עד עכשיו כאן היה `'fetch('`, `'XMLHttpRequest'` ו-`'WebSocket('` ברשימת
// האסורים, והטענה הייתה **"אין קריאת רשת בתוצר"**. היא הייתה נכונה ומדויקת
// כל עוד לא היה לאן לפנות: בלי מודל ובלי ענן, `fetch` בתוצר הוא כשל בהגדרה.
//
// עם שכבת הענן זה חדל להיות נכון: ה-SDK של Firebase **חייב** לפנות לרשת —
// זו כל מטרתו. שתי הדרכים הגרועות לטפל בזה:
//
//   ✗ **להשאיר את האיסור ולהוסיף חריג** ("חוץ מהקבצים של firebase"). זו
//     בדיוק הצורה שכתובה בראש הקובץ הזה כפסולה: *"בקרה שיש לה חריג אחד
//     מוסבר היא בקרה שאף אחד לא קורא בפעם השנייה."*
//   ✗ **למחוק את הבדיקה** ולהסתמך על `check-no-model.mjs`, שרץ על המקור.
//     אבל הקובץ הזה קיים בדיוק כדי לבדוק את מה ש**נשלח**, אחרי כלי הבנייה.
//
// ★ ולכן השאלה הוחלפה בשאלה חזקה יותר: לא *"האם יש קריאת רשת"* אלא
// **"לאן היא יכולה ללכת"**. כל שם מארח שמופיע בתוצר נבדק מול רשימה סגורה,
// וכל שם שאינו בה מפיל build.
//
// זו שדרוג ולא ויתור: הבדיקה הקודמת לא הייתה תופסת `https://evil.example`
// שנכתב עם `new Image().src`, והחדשה כן. ו-`api.anthropic.com` אינו ברשימה
// **וגם** נשאר ברשימה השחורה למעלה — B13 עומד בשתי הדרכים.

/**
 * ★★ היעדים היחידים שהתוצר רשאי לפנות אליהם.
 *
 * כולם של Google/Firebase, וכולם נדרשים לזרימה אחת ספציפית:
 *   `*.googleapis.com`     — Firestore, Cloud Functions
 *   `*.firebaseapp.com`    — דומיין ה-Auth (מסך ההתחברות)
 *   `*.firebaseio.com`     — RTDB legacy, מגיע עם ה-SDK
 *   `accounts.google.com`  — מסך ההסכמה של Google
 *   `apis.google.com` / `*.gstatic.com` — סקריפטים של ה-popup
 *   `*.cloudfunctions.net` — כתובת ברירת המחדל של Functions
 *   `localhost` / `127.0.0.1` — אמולטורים
 *
 * ⛔ **מה שאין ברשימה, ובכוונה:** שום שירות אנליטיקה, שום CDN של פונטים
 * (הפונטים מקומיים — דגל M3 של עדי), ושום ספק מודל.
 */
const ALLOWED_HOSTS = [
  'googleapis.com',
  'firebaseapp.com',
  'firebaseio.com',
  'firebasedatabase.app',
  'cloudfunctions.net',
  'accounts.google.com',
  'apis.google.com',
  'gstatic.com',
  'firebase.google.com',
  // ★ נוספו אחרי שהבדיקה תפסה אותם ב-build הראשון של פרוסה 1, וכל אחד
  //   נבדק לגופו — זו בדיוק העבודה שהבדיקה נועדה לכפות:
  //   `securetoken.google.com` — חידוש אסימון ה-ID של Firebase Auth. ליבת
  //                              ההתחברות; בלעדיו אין כניסה לכלי.
  //   `www.google.com`         — reCAPTCHA של Firebase Auth בזרימת ה-popup.
  'securetoken.google.com',
  'www.google.com',
  'localhost',
  '127.0.0.1',
];

/**
 * ★ מארחים שמופיעים בטקסט ו**אינם יעד רשת**.
 *
 * ---------------------------------------------------------------------------
 * למה רשימה נפרדת ולא הוספה ל-`ALLOWED_HOSTS`
 * ---------------------------------------------------------------------------
 * כי הן אומרות שני דברים שונים. `ALLOWED_HOSTS` = *"מותר לשלוח לשם בייטים"*.
 * הרשימה הזאת = *"זה בכלל לא יעד — זו מחרוזת בהודעת שגיאה או בכותרת רישיון"*.
 *
 * מיזוגן היה מייצר רשימת יעדים מותרים שכוללת אתרים שאיש לא התכוון לפנות
 * אליהם, ואז השאלה "לאן הקוד יכול לפנות" כבר לא נענית מקריאת הרשימה. שתי
 * רשימות עולות שורה אחת ושומרות על המשמעות.
 *
 * שתיהן הגיעו מ-React ומ-Firebase: קישור לתיעוד בהודעת שגיאה, וכותרת
 * רישיון Apache-2.0.
 */
const NON_DESTINATION_HOSTS = ['reactjs.org', 'react.dev', 'www.apache.org', 'www.w3.org'];

/** כל `https?://host` שמופיע בבייטים. */
const URL_RE = /https?:\/\/([a-z0-9.-]+)/gi;

function hostAllowed(host) {
  const h = host.toLowerCase();
  if (NON_DESTINATION_HOSTS.includes(h)) return true;
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith('.' + allowed));
}

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
    const rel = f.replace(root, '').replace(/\\/g, '/');
    for (const marker of BANNED) {
      if (s.includes(marker)) {
        violations.push({ file: rel, text: `נמצא: ${marker}` });
      }
    }

    // ★★ רשימת היעדים. ראה ההערה למעלה.
    const seen = new Set();
    for (const m of s.matchAll(URL_RE)) {
      const host = m[1];
      if (seen.has(host)) continue;
      seen.add(host);
      // `www.w3.org` וכדומה מופיעים ב-SVG כ-namespace ואינם יעד רשת. הם
      // מסוננים לפי הצורה ולא לפי שם, כדי שהרשימה תישאר רשימת **יעדים**.
      if (/^www\.w3\.org$/i.test(host)) continue;
      if (!hostAllowed(host)) {
        violations.push({ file: rel, text: `★★ יעד רשת שאינו ברשימה המותרת: ${host}` });
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
  console.log('✓ התוצר נקי: כל יעדי הרשת ברשימה המותרת, אין סימני מודל, ויש בו את מה שצריך.');
}
