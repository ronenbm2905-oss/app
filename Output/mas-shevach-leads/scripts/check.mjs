// ============================================================================
// check.mjs — שער ה-build. **אסרשן, לא כוונה טובה.**
//
// עדי S2.5: "לנועם/עומר: זה בדיוק כמו `FORBIDDEN_FIELDS` ב-fleet
// ו-`render:check` ב-Absolut — אסרשן, לא כוונה טובה. תבנית שנכשלת ב-build
// אם נמצאה התאמה במלל הנראה."
//
// ארבע קבוצות בדיקה:
//   A. סנכרון `firestore.rules` ↔ `constants.js` — הדריפט השקט המסוכן ביותר
//   B. שדות אסורים בקוד המקור
//   C. מחרוזות אסורות במלל הנראה (S2.5 + S1 + S7)
//   D. placeholders שחייבים להיות מוחלפים לפני go-live
//
// שימוש:
//   npm run check                  — A/B/C נכשלים; D מדווח כחוסם go-live
//   npm run check -- --strict      — גם D נכשל. זה מה שרצים לפני deploy.
//   npm run check -- --html <path> — מריץ את C על קובץ HTML.
//                                    🔴 זה המסלול של **עומר** לדף הנחיתה.
// ============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEAD_CREATE_FIELDS,
  LEAD_SOURCE_FIELDS,
  FORBIDDEN_FIELDS,
  FORBIDDEN_STRINGS,
  FORBIDDEN_AMOUNT_RE,
  POLICY_VERSION,
} from "../src/constants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const htmlIdx = argv.indexOf("--html");
const HTML_TARGETS = htmlIdx >= 0 ? argv.slice(htmlIdx + 1).filter((a) => !a.startsWith("--")) : [];

let errors = 0;
let blockers = 0;
const section = (t) => console.log(`\n— ${t}`);
function fail(msg, detail) {
  errors++;
  console.error(`  ✗ ${msg}${detail ? `\n      ${detail}` : ""}`);
}
function blocker(msg, detail) {
  blockers++;
  console.error(`  🔴 חוסם go-live: ${msg}${detail ? `\n      ${detail}` : ""}`);
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ============================================================================
// A. סנכרון rules ↔ constants
//
// זו הבדיקה שתופסת את הכשל האמיתי: מישהו מוסיף שדה ל-`LEAD_CREATE_FIELDS`
// ושוכח את `firestore.rules` (או הפוך). התוצאה היא או שדה שנחסם בשקט
// ומפיל לידים, או — הרבה יותר גרוע — שדה שנכתב בלי שאיש התכוון.
// ============================================================================
section("A. סנכרון firestore.rules ↔ constants.js");

const rulesPath = join(ROOT, "firestore.rules");
const rulesText = readFileSync(rulesPath, "utf8");

function extractArray(afterMarker) {
  const i = rulesText.indexOf(afterMarker);
  if (i < 0) return null;
  const open = rulesText.indexOf("[", i);
  const close = rulesText.indexOf("]", open);
  if (open < 0 || close < 0) return null;
  return rulesText
    .slice(open + 1, close)
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

const rulesAllowlist = extractArray("d.keys().hasOnly(");
if (!rulesAllowlist) {
  fail("לא נמצאה רשימת hasOnly ב-firestore.rules — השער הזה מת");
} else if (JSON.stringify([...rulesAllowlist].sort()) !== JSON.stringify([...LEAD_CREATE_FIELDS].sort())) {
  fail(
    "🔴 ה-allowlist ב-firestore.rules אינו זהה ל-LEAD_CREATE_FIELDS",
    `rules: ${JSON.stringify(rulesAllowlist)}\n      constants: ${JSON.stringify(LEAD_CREATE_FIELDS)}`
  );
} else {
  pass(`ה-allowlist מסונכרן (${rulesAllowlist.length} שדות)`);
}

const rulesSourceList = extractArray("d.source.keys().hasOnly(");
if (!rulesSourceList) {
  fail("לא נמצאה רשימת hasOnly ל-source ב-firestore.rules");
} else if (JSON.stringify([...rulesSourceList].sort()) !== JSON.stringify([...LEAD_SOURCE_FIELDS].sort())) {
  fail(
    "רשימת `source` ב-rules אינה זהה ל-LEAD_SOURCE_FIELDS",
    `rules: ${JSON.stringify(rulesSourceList)}`
  );
} else {
  pass("רשימת `source` מסונכרנת");
}

// deny-by-default + אין כלל רחב מתיר.
// זה הכשל של NRCAR: כללי Firebase אדיטיביים ואין בהם `deny`.
if (!/match\s*\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/.test(rulesText)) {
  fail("🔴 חסר כלל deny-by-default סוגר `match /{document=**} { allow read, write: if false; }`");
} else {
  pass("deny-by-default קיים");
}

const permissiveWildcard = /match\s*\/\{[a-zA-Z]*=\*\*\}[\s\S]{0,200}?allow[^;]*if\s+(true|request\.auth\s*!=\s*null)/;
if (permissiveWildcard.test(rulesText)) {
  fail("🔴 נמצא כלל wildcard מתיר — כללי Firebase אדיטיביים, זה מבטל את כל השאר");
} else {
  pass("אין כלל wildcard מתיר");
}

if (/allow\s+(read|write|get|list|create|update|delete)[^;]*:\s*if\s+true\s*;/.test(rulesText)) {
  fail("🔴 נמצא `allow ...: if true`");
} else {
  pass("אין `if true` בשום כלל");
}

// R-4: אין הסתמכות על "מחובר" כבקרת גישה.
if (/allow\s+(get|list|read)[^;]*:\s*if\s+request\.auth\s*!=\s*null\s*;/.test(rulesText)) {
  fail("🔴 קריאה מותנית ב-`request.auth != null` בלבד — 'מחובר' אינו 'מורשה' (עדי R-4)");
} else {
  pass("הקריאה מותנית בזהות מפורשת, לא ב-'מחובר'");
}

// R-1: update/delete חסומים על leads.
if (!/match \/leads\/\{leadId\}[\s\S]*?allow update, delete: if false;/.test(rulesText)) {
  fail("🔴 `update, delete: if false` חסר על leads (עדי R-1)");
} else {
  pass("update/delete על leads חסומים — גם לבעלים");
}

// ============================================================================
// B. שדות אסורים בקוד המקור
//
// ⚠️ הסריקה מוגבלת לשמות **בעלי אות מובהקת** בפרויקט הזה. מילים כמו
//    `message`, `amount`, `details`, `description` הן חלק מ-JavaScript תקין
//    (`err.message`) ולכן סריקת טקסט עליהן מייצרת רעש ולא אות. הן עדיין
//    נאכפות במקום שבו זה באמת סופר: `hasOnly` ב-rules ובדיקת A למעלה.
// ============================================================================
section("B. שדות אסורים בקוד המקור");

const GENERIC_WORDS = new Set([
  "message", "amount", "details", "description", "notes", "comments", "answers",
  "address", "story", "salary", "income", "block", "parcel", "tz", "freeText",
]);
const HIGH_SIGNAL = FORBIDDEN_FIELDS.filter((f) => !GENERIC_WORDS.has(f));

const SCAN_DIRS = ["src", "intake", "functions/src"];
const SKIP_FILES = new Set([join(ROOT, "src", "constants.js")]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".js", ".jsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

let fieldHits = 0;
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    if (SKIP_FILES.has(file)) continue;
    const text = readFileSync(file, "utf8");
    // מתעלמים משורות הערה — הרשימות מוזכרות שם בכוונה, כתיעוד.
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (!code.trim() || code.trim().startsWith("*")) return;
      for (const field of HIGH_SIGNAL) {
        if (new RegExp(`\\b${field}\\b`).test(code)) {
          fail(`שדה אסור "${field}" ב-${relative(ROOT, file)}:${i + 1}`, code.trim());
          fieldHits++;
        }
      }
    });
  }
}
if (!fieldHits) pass(`אין שדות אסורים ב-${SCAN_DIRS.join(", ")} (${HIGH_SIGNAL.length} שמות נבדקו)`);

// ============================================================================
// C. מחרוזות אסורות במלל הנראה (S2.5, S1, S7)
// ============================================================================
section("C. מחרוזות אסורות במלל הנראה");

function scanCopy(label, text, { allowAmountsIn = null } = {}) {
  let hits = 0;
  for (const bad of FORBIDDEN_STRINGS) {
    if (text.includes(bad)) {
      fail(`מחרוזת אסורה ב-${label}: "${bad}"`);
      hits++;
    }
  }
  // סכומים בני 4 ספרות ומעלה. חריג יחיד ומתועד: בלוק מקרי המבחן (S6),
  // שמסומן ב-HTML ב-`data-legal-exception="S6-case-study"`.
  let scanned = text;
  if (allowAmountsIn) scanned = text.replace(allowAmountsIn, "");
  const m = scanned.match(new RegExp(FORBIDDEN_AMOUNT_RE.source, "g"));
  if (m) {
    fail(`סכום בן 4 ספרות ומעלה ב-${label}: ${[...new Set(m)].join(", ")}`);
    hits++;
  }
  if (!hits) pass(`${label} — נקי`);
}

// המלל של הקונסולה מרוכז ב-i18n.js, ולכן די לסרוק אותו.
scanCopy("src/i18n.js", readFileSync(join(ROOT, "src", "i18n.js"), "utf8"));

// הודעות שגיאה שמוצגות למבקר יושבות ב-utils/lead.js.
scanCopy("src/utils/lead.js", readFileSync(join(ROOT, "src", "utils", "lead.js"), "utf8"));

// -- מסלול עומר: HTML של דף הנחיתה --------------------------------------
//
// 🔴 M5 — החריג של S6 היה שבור **פעמיים**, ושני הכשלים מצטברים:
//    (א) הוא חיפש `data-legal-exception="S6-case-study"` בזמן שהדף מסמן
//        `data-amounts-allowed` — כלומר לא היה מוצא את החריג לעולם;
//    (ב) גם אילו תאמו, `<\/[a-zA-Z]+>` הלא-חמדני היה נסגר על ה-`</p>`
//        הראשון **בתוך** הכרטיס, ומשאיר את שאר הסכומים חשופים לסריקה.
//
//    למה זה קריטי אף שבלוק מקרי המבחן ריק מסכומים כרגע: הוא עובר היום רק
//    **במקרה**. הכשל מתפוצץ בדיוק ביום שמשה ימסור את המספרים — ה-build
//    ייפול, ותחת לחץ התיקון שיישמע הגיוני יהיה **להחליש את הבדיקה**.
//    זה כשל ה-CRLF מ-Absolut במופע אחר: שער שנראה ירוק כי הוא לא בודק כלום.
//
//    התיקון: עוגן ל-`<section>` מפורש בשני הקצוות, כדי שהסגירה תתפוס את
//    הסקשן כולו ולא תגית מקוננת. עומר מיישר את התכונה בדף.
const S6_EXCEPTION = /<section[^>]*data-legal-exception=["']S6-case-study["'][\s\S]*?<\/section>/g;

for (const target of HTML_TARGETS) {
  if (!existsSync(target)) {
    fail(`קובץ HTML לא נמצא: ${target}`);
    continue;
  }
  const raw = readFileSync(target, "utf8");
  // רק מלל נראה: מסירים script/style **והערות HTML**.
  // 🟠 M6 — בדף יש מאות שורות הערה שמצטטות את הסקירה של עדי, ובהן בהכרח
  //    מופיעות המחרוזות האסורות עצמן ("מגיע לכם", סכומים). בלי ההסרה,
  //    עריכה עתידית של ההערות מפילה build בהודעה בלתי-מובנת לחלוטין.
  const visible = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  scanCopy(target, visible, { allowAmountsIn: S6_EXCEPTION });

  // S1 נתיב א' — 0 מופעים של "רו"ח" גם ב-title/og/alt, כלומר גם **בתוך
  // תגיות** ולא רק במלל הנראה. לכן נבדק על הקובץ עם התגיות, אבל **בלי
  // הערות** (M6): ההערות מצטטות את הסקירה של עדי, שבה המילה מופיעה
  // בהכרח — אחרת הבדיקה נופלת על התיעוד של עצמה.
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, "");
  for (const bad of ['רו"ח', "רו״ח", "רואה חשבון"]) {
    if (withoutComments.includes(bad)) {
      fail(`S1 נתיב א' — "${bad}" מופיע ב-${target} (כולל title/og/alt)`);
    }
  }
}

// ============================================================================
// E. גבולות שרת/קליינט — האסרשנים שהופכים "אני מאשר" למנגנון
// ============================================================================
section("E. גבולות שרת/קליינט");

// -- E1: סוד ה-HMAC ובדיקת הדיכוי הם **שרת בלבד** ------------------------
//
// 🔴 זה הכשל ששורד סקירות: אם בדיקת הדיכוי מתבצעת בדפדפן, המפתח נשלח
//    לדפדפן — וה-HMAC מתאפס לגיבוב רגיל של טלפון ישראלי, כלומר ~10⁸
//    אפשרויות שנפרצות בשניות. הבדיקה למטה מוודאת שזה לא יכול לקרות בשקט.
const CLIENT_DIRS = ["src", "intake"];
const SERVER_ONLY_TOKENS = ["SUPPRESSION_SECRET", "hashPhone", "createHmac"];
let leakHits = 0;
for (const dir of CLIENT_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (!code.trim() || code.trim().startsWith("*")) return;
      for (const tok of SERVER_ONLY_TOKENS) {
        if (code.includes(tok)) {
          fail(`🔴 טוקן שרת-בלבד "${tok}" בקוד קליינט: ${relative(ROOT, file)}:${i + 1}`);
          leakHits++;
        }
      }
    });
  }
}
if (!leakHits) {
  pass("סוד ה-HMAC ובדיקת הדיכוי אינם מופיעים בקוד קליינט (שרת בלבד)");
}

// ה-rules חייבות לחסום את `suppression` לחלוטין — גם לבעלים.
if (!/match \/suppression\/\{[a-zA-Z]+\} \{\s*\n\s*allow read, write: if false;/.test(rulesText)) {
  fail("🔴 `suppression` אינו חסום מוחלט ב-rules — הקליינט אסור שיגע בו");
} else {
  pass("`suppression` חסום לקריאה ולכתיבה מכל קליינט");
}

// -- E2: referrer / URL מלא לא נקראים בכלל בקליינט -----------------------
const BANNED_APIS = ["document.referrer", "location.href", "document.URL", "location.toString"];
let apiHits = 0;
for (const dir of CLIENT_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (!code.trim() || code.trim().startsWith("*")) return;
      for (const api of BANNED_APIS) {
        if (code.includes(api)) {
          fail(`🔴 API אסור "${api}" ב-${relative(ROOT, file)}:${i + 1}`, code.trim());
          apiHits++;
        }
      }
    });
  }
}
if (!apiHits) pass("אין קריאה ל-referrer או ל-URL מלא בשום מקום בקליינט");

// -- E3: `policyVersion` הוא שדה עליון וחובה ------------------------------
if (!/hasAll\(\['firstName', 'phone', 'policyVersion', 'createdAt'\]\)/.test(rulesText)) {
  fail("🔴 `policyVersion` אינו שדה חובה עליון ב-rules (ראיית ההסכמה)");
} else {
  pass("`policyVersion` הוא שדה עליון וחובה — לא קבור בתוך `source`");
}
if (rulesSourceList && rulesSourceList.includes("policyVersion")) {
  fail("🔴 `policyVersion` חזר לתוך `source` — ניקוי ייחוס שיווקי ימחק את ראיית ההסכמה");
} else {
  pass("`source` אינו מכיל את `policyVersion`");
}

// ============================================================================
// F. `POLICY_VERSION` ↔ מדיניות הפרטיות שפורסמה
//
// 🔴 `policyVersion` נשמר על **כל ליד** כראיית ההסכמה. הערך שלו נובע כולו
//    מכך שהוא מצביע על נוסח שהוצג בפועל. שתי מחרוזות שמתוחזקות בנפרד —
//    אחת ב-`constants.js` ואחת ב-`privacy.html` — **יתפצלו בעריכה הראשונה**,
//    ומאותו רגע כל ליד נושא מצביע לשום מקום, בלי ששום דבר ייראה שבור.
//
//    זה בדיוק הדפוס של M5: בדיקה שנראית תקינה כי שני הצדדים במקרה תואמים
//    היום. לכן ההתאמה נאכפת, ולא מונחת.
//
//    העוגן הוא **הצהרת התוקף הנראית** ("גרסה X · בתוקף מיום …") ולא סתם
//    מופע של המחרוזת — אחרת שורה בטבלת הגרסאות ההיסטורית הייתה מספיקה
//    כדי "לאשר" גרסה שכבר אינה בתוקף.
// ============================================================================
section("F. POLICY_VERSION ↔ מדיניות הפרטיות");

const privacyIdx = argv.indexOf("--privacy");
const PRIVACY_PATH =
  privacyIdx >= 0
    ? argv[privacyIdx + 1]
    : join(ROOT, "..", "2026-08-15-mas-shevach", "privacy.html");

if (!existsSync(PRIVACY_PATH)) {
  // חוסר בקובץ אינו סתירה — הוא חוסר יכולת לאמת. חוסם go-live, לא כשל build,
  // כדי שהפרויקט יישאר בר-בנייה גם בלי דף הנחיתה לצדו.
  blocker(
    `לא נמצאה מדיניות פרטיות לאימות מול POLICY_VERSION: ${PRIVACY_PATH}`,
    "אפשר להצביע על נתיב אחר: npm run check -- --privacy <path>"
  );
} else {
  const policyRaw = readFileSync(PRIVACY_PATH, "utf8");
  // מלל נראה בלבד: בלי הערות (M6) ובלי תגיות.
  const policyText = policyRaw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const v = POLICY_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "גרסה X" כשאחריה לא ספרה/נקודה (כדי ש-1.0 לא יתפוס את 1.01),
  // ובטווח קצר אחריה "בתוקף" — כלומר ההצהרה הפעילה, לא שורת היסטוריה.
  const inForce = new RegExp(`גרסה\\s+${v}(?![\\d.])[^]{0,80}?בתוקף`);

  if (inForce.test(policyText)) {
    pass(`POLICY_VERSION "${POLICY_VERSION}" מופיע כגרסה בתוקף במדיניות שפורסמה`);
  } else if (new RegExp(`גרסה\\s+${v}(?![\\d.])`).test(policyText)) {
    fail(
      `🔴 "גרסה ${POLICY_VERSION}" מופיעה במדיניות אבל **לא כגרסה בתוקף**`,
      "ייתכן שהיא רק שורה בטבלת הגרסאות ההיסטורית. ראיית ההסכמה חייבת להצביע על הנוסח הפעיל."
    );
  } else {
    const found = policyText.match(/גרסה\s+([\d.]+)/g);
    fail(
      `🔴 POLICY_VERSION הוא "${POLICY_VERSION}" ואינו מופיע במדיניות שפורסמה`,
      `${PRIVACY_PATH}\n      נמצא במסמך: ${found ? [...new Set(found)].join(", ") : "(אין אזכור גרסה)"}` +
        `\n      כל ליד יישא ראיית הסכמה שמצביעה על נוסח שלא קיים.`
    );
  }
}

// ============================================================================
// D. placeholders — חוסמי go-live
// ============================================================================
section("D. placeholders");

if (rulesText.includes("REPLACE_WITH_MOSHE_EMAIL")) {
  blocker(
    "firestore.rules עדיין מכיל את ה-placeholder של מייל הבעלים",
    "בלי בעלים אמיתי, allowlist המיילים לא נותן גישה לאיש — והגישה תלויה כולה ב-custom claim."
  );
} else {
  pass("מייל הבעלים הוחלף ב-firestore.rules");
}

// 🔴 B4 — `POLICY_VERSION` שמכיל "draft" הוא חוסם go-live.
// כל ליד נושא את המחרוזת הזאת כ**ראיית הסכמה**. אם היא מצביעה על טיוטה
// שאיש לא אישר, הראיה מצביעה על מסמך שלא קיים. המחרוזת הסופית נקבעת ע"י
// עדי יחד עם מדיניות הפרטיות.
if (/draft|טיוטה|TODO|REPLACE/i.test(POLICY_VERSION)) {
  blocker(
    `POLICY_VERSION הוא "${POLICY_VERSION}" — ראיית הסכמה שמצביעה על טיוטה`,
    "המחרוזת הסופית נקבעת ע\"י עדי יחד עם מדיניות הפרטיות ומשובצת ב-src/constants.js."
  );
} else {
  pass(`POLICY_VERSION סופי ("${POLICY_VERSION}")`);
}

const firebaserc = readFileSync(join(ROOT, ".firebaserc"), "utf8");
if (firebaserc.includes("REPLACE_WITH_FIREBASE_PROJECT_ID")) {
  blocker(".firebaserc עדיין מכיל placeholder של מזהה הפרויקט");
} else {
  pass("מזהה הפרויקט הוגדר");
}

const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) {
  blocker(".env אינו קיים — האפליקציה תרוץ במצב מקומי בלבד");
} else {
  const env = readFileSync(envPath, "utf8");
  // 🔴 R-5 — App Check הוא חוסם go-live מפורש אצל עדי.
  if (!/VITE_APPCHECK_SITE_KEY=\S/.test(env)) {
    blocker(
      "App Check אינו מוגדר (VITE_APPCHECK_SITE_KEY ריק) — עדי R-5",
      "בלעדיו נקודת ה-create הציבורית היא endpoint פתוח לכתיבה."
    );
  } else {
    pass("VITE_APPCHECK_SITE_KEY מוגדר");
    console.log(
      "      ⚠️ הערה: המפתח כאן רק **משיג** טוקן. האכיפה עצמה מוגדרת בקונסולה\n" +
        "         (App Check → Firestore → Enforce) ואינה ניתנת לבדיקה מהקוד."
    );
  }
  if (/VITE_APPCHECK_DEBUG_TOKEN=\S/.test(env)) {
    blocker("VITE_APPCHECK_DEBUG_TOKEN מוגדר — טוקן דיבאג לא נכנס ל-build של פרודקשן");
  }
}

// ============================================================================
console.log(`\n${"=".repeat(62)}`);
if (errors) {
  console.error(`🔴 ${errors} כשלים. ה-build נעצר.`);
  process.exit(1);
}
if (blockers) {
  if (STRICT) {
    console.error(`🔴 ${blockers} חוסמי go-live. (--strict)`);
    process.exit(1);
  }
  console.warn(
    `\n⚠️  ${blockers} חוסמי go-live פתוחים.\n` +
      `   ה-build ממשיך — אלה פריטי הקמה, לא באגים.\n` +
      `   🔴 לפני deploy חובה להריץ:  npm run check -- --strict\n`
  );
} else {
  console.log("✅ כל הבדיקות עברו, ואין חוסמי go-live פתוחים.");
}
