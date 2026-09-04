// ============================================================================
// check-hook-wiring.mjs — ★★ בדיקת CI שמפילה build: **ערך שה-hook מחזיר
// וששום מסך אינו צורך.**
//
// ---------------------------------------------------------------------------
// הבאג שהבדיקה הזאת נכתבה בגללו
// ---------------------------------------------------------------------------
// `useCloudOrders` הגדיר `refreshNow`, ייצא אותו בטיפוס, והחזיר אותו
// ב-`useMemo`. **אף רכיב לא קרא לו.** התוצאה: דורית חיברה את התיבה, ואז לא
// קרה כלום עד הסנכרון של 06:30 למחרת — הרגע הראשון אחרי החיבור היה מסך ריק.
//
// ★★ ולמה TypeScript לא תופס את זה: הוא **כן** נצרך — ב-`useMemo` שבתוך
// ה-hook עצמו. מבחינת המהדר הערך בשימוש. מבחינת המשתמשת הוא לא קיים.
//
// זו אותה משפחת כשלים שנתפסה כאן שלוש פעמים — **הקוד קיים, נראה תקין,
// ופשוט לא רץ**: כלל הארכוב, מסלול ההזמנות, ו-`purgeAfter` שנכתב ואיש לא
// קרא אותו. שלוש הפעמים ההגנה הייתה הכוונה שלנו, ושלוש הפעמים הקוד לא הסכים.
//
// ---------------------------------------------------------------------------
// ★ מה בדיוק נבדק, וכמה זה מדויק
// ---------------------------------------------------------------------------
// לא "האם השם מופיע איפשהו ב-`src/`" — זה היה נדלק על כל `orders` מקומי
// ומאבד את כל האמון בבדיקה. במקום זה:
//
//  1. נמצא הקובץ שקורא ל-`useCloudOrders(`, והשם שאליו הוא נקשר
//     (`const cloud = useCloudOrders(...)`).
//  2. נאספים שמות החברים מ-`interface CloudState` ומ-`interface UseCloudOrders`.
//  3. לכל חבר נדרש **`cloud.<שם>`** בקובץ הצורך, או פירוק מפורש
//     (`const { <שם> } = cloud`).
//
// כלומר הטענה היא צרה ומדויקת: *כל ערך שה-hook מחזיר — מישהו במסך נוגע בו.*
//
// ---------------------------------------------------------------------------
// ⚠️ ומה שהבדיקה **לא** אומרת
// ---------------------------------------------------------------------------
// שהערך מוצג נכון, או שהפונקציה מחוברת לכפתור שאפשר ללחוץ עליו. `cloud.refreshNow`
// שמועבר ל-hook ונשכח שם היה עובר כאן. **לכן הבדיקה הזאת אינה לבד**:
// `tests/refreshControl.test.tsx` מרנדר את המסך, לוחץ על הכפתור, ומוודא
// שהקריאה יצאה. הסטטי מוודא שהחוט מחובר; המבחן מוודא שעובר בו זרם.
//
// ★ אם ערך באמת מיותר — **מוחקים אותו מה-hook.** זו הפעולה הנכונה, והיא
// גם מה שהבדיקה מכריחה: או שמשתמשים בו, או שהוא לא קיים.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { ROOT } from './buildGraph.mjs';

/** ה-hook שנבדק, והממשקים שמרכיבים את הערך המוחזר שלו. */
const HOOK_FILE = 'src/hooks/useCloudOrders.ts';
const HOOK_NAME = 'useCloudOrders';
const RESULT_INTERFACES = ['CloudState', 'UseCloudOrders'];

/**
 * חברים שמותר להם לא להיצרך, עם נימוק.
 *
 * ★ הרשימה ריקה בכוונה, והיא צריכה להישאר כך. הוספת שם לכאן היא בדיוק
 * המהלך שהפך את הבאג הזה לאפשרי — ולכן היא דורשת נימוק בשורה שלידה.
 */
const ALLOWED_UNUSED = Object.create(null);

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** כל קובצי ה-TS/TSX תחת `src/`. */
function srcFiles(dir = 'src', out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) srcFiles(rel, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** מסיר הערות, כדי ששם שמוזכר בהערה לא ייחשב לשימוש. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** שמות החברים של `interface X { ... }` — רמה ראשונה בלבד. */
function interfaceMembers(code, name) {
  const start = code.indexOf(`interface ${name}`);
  if (start === -1) return null;
  const open = code.indexOf('{', start);
  if (open === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  const body = code.slice(open + 1, end);
  const members = [];
  let depth2 = 0;
  for (const line of body.split('\n')) {
    // ספירת סוגריים כדי לדלג על שדות מקוננים.
    const atTop = depth2 === 0;
    depth2 += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length;
    if (!atTop) continue;
    const m = line.match(/^\s{2}(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/);
    if (m) members.push(m[1]);
  }
  return members;
}

export function findViolations() {
  const violations = [];
  const hookCode = stripComments(read(HOOK_FILE));

  // --- 1. מה ה-hook מחזיר ---------------------------------------------------
  const members = new Set();
  for (const name of RESULT_INTERFACES) {
    const found = interfaceMembers(hookCode, name);
    if (found === null) {
      violations.push({
        member: name,
        text: `הממשק \`${name}\` לא נמצא ב-${HOOK_FILE} — הבדיקה איבדה את מה שהיא בודקת`,
      });
      continue;
    }
    for (const m of found) members.add(m);
  }

  // --- 2. מי צורך אותו ------------------------------------------------------
  const consumers = [];
  for (const rel of srcFiles()) {
    if (rel === HOOK_FILE) continue;
    const code = stripComments(read(rel));
    const m = code.match(new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${HOOK_NAME}\\s*\\(`));
    if (m) consumers.push({ file: rel, binding: m[1] });
  }

  if (consumers.length === 0) {
    violations.push({
      member: HOOK_NAME,
      text: `אף קובץ ב-src/ אינו קורא ל-${HOOK_NAME}( — שכבת הענן כולה מנותקת מהמסך`,
    });
    return violations;
  }

  // --- 3. כל חבר, אצל לפחות צרכן אחד ---------------------------------------
  for (const member of members) {
    if (member in ALLOWED_UNUSED) continue;

    const used = consumers.some(({ file, binding }) => {
      const code = stripComments(read(file));
      const access = new RegExp(`\\b${binding}\\s*\\.\\s*${member}\\b`);
      const destructured = new RegExp(
        `\\{[^{}]*\\b${member}\\b[^{}]*\\}\\s*=\\s*${binding}\\b`,
      );
      const destructuredCall = new RegExp(
        `\\{[^{}]*\\b${member}\\b[^{}]*\\}\\s*=\\s*${HOOK_NAME}\\s*\\(`,
      );
      return access.test(code) || destructured.test(code) || destructuredCall.test(code);
    });

    if (!used) {
      violations.push({
        member,
        text:
          `\`${member}\` מוחזר מ-${HOOK_NAME} ואף מסך אינו נוגע בו. ` +
          `או שהוא צריך להגיע למסך — או שצריך למחוק אותו מה-hook.`,
      });
    }
  }

  return violations;
}

// הרצה ישירה מה-CLI (בתוך `npm run build`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations();
  if (violations.length > 0) {
    console.error('\n✖ יש ערך שה-hook מחזיר ושאף מסך אינו צורך.\n');
    console.error('  זה נראה כמו קוד תקין, הוא עובר הידור, והוא פשוט לא רץ.');
    console.error('  ככה `refreshNow` היה קיים בלי כפתור, ודורית חיברה את');
    console.error('  התיבה וראתה מסך ריק עד 06:30 למחרת.\n');
    for (const v of violations) console.error(`  ${v.member}: ${v.text}`);
    console.error('');
    process.exit(1);
  }
  const label = relative(ROOT, join(ROOT, HOOK_FILE)).split(sep).join('/');
  console.log(`✓ כל ערך ש-${label} מחזיר נצרך במסך.`);
}
