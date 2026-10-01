// ============================================================================
// rules-mutate.mjs — **מוטציות על firestore.rules.**
//
//   npm run rules:mutate          (האמולטור חייב לרוץ, כמו rules:test)
//
// ============================================================================
// למה זה קיים, ולמה חבילה ירוקה אינה תשובה
// ============================================================================
// `npm run rules:test` שמחזיר 387/387 אומר דבר אחד: **לא תפסנו כלום.** הוא
// אינו אומר "אין מה לתפוס". בדיקה יכולה לעבור כי תנאי *אחר* חסם במקומה —
// וזה לא תיאורטי אצלנו: ב-ז.8ב מתועד בדיוק זה. הוצאת `portalStatus=='active'`
// ו-`status!='archived'` מ-`isMyDriverId` **שרדה את כל החבילה**, כי בתרחיש
// הניתוק המלא גם `userId` התאפס, ולכן התנאי הראשון חסם ממילא ושני התנאים
// האחרים מעולם לא נבחנו לבדם. שתי בדיקות נוספו **אחרי** ריצת מוטציות.
//
// ולכן: הסקריפט הזה שובר את הכללים בכוונה, אחד-אחד, ומריץ את החבילה המלאה
// על כל שבר. התוצאה שמעניינת היא **כמה מוטציות נתפסו** — מוטציה ששרדה היא
// חור בבדיקות, ולפעמים גם חור בכללים שאיש לא שם לב אליו.
//
// ⚠️ כל מוטציה היא **החלשה של תנאי אחד**. לא "שינוי שובר קומפילציה" (זה היה
// נתפס טריוויאלית ולא מלמד כלום), אלא בדיוק הטעות שמתכנת היה עושה: להוריד
// בדיקה שנראית מיותרת, להרחיב enum, או להשוות מחרוזות במקום צורה קנונית.
//
// ⚠️ ו**מוטציה שקולה אינה מוטציה**: שינוי שאינו משנה סמנטיקה "שורד" בלי
// ללמד כלום. ראה M02 — ההורדה של עוגן הסוף התגלתה כשקולה (נמדד מול
// האמולטור), והוחלפה בהחלשה אמיתית של בדיקת האורך.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// ⚠️ **נרמול שורות.** firestore.rules שמור ב-CRLF, ותבניות המוטציה כתובות
// כאן ב-LF. בלי הנרמול הזה כל תבנית רבת-שורות "אינה נמצאת" — והסקריפט היה
// מדווח מספר מוטציות שאינו נכון, שזה גרוע מלא להריץ אותו בכלל.
const SRC = readFileSync(join(ROOT, "firestore.rules"), "utf8").split("\r\n").join("\n");
const TMP = join(ROOT, "node_modules", ".fleet-mutants");
mkdirSync(TMP, { recursive: true });

const Q = "'"; // גרש בודד, כדי שהתבניות למטה יישארו קריאות

// ---------------------------------------------------------------------------
// המוטציות. `find` חייב להימצא **בדיוק פעם אחת** — אחרת המוטציה אינה מה
// שחשבנו שהיא, והסקריפט עוצר במקום לדווח מספר שאינו נכון.
// ---------------------------------------------------------------------------
const MUTATIONS = [
  // ===================== canonPhone — הנרמול עצמו =====================
  {
    id: "M01",
    what: "canonPhone מקבל כל קידומת בת 10 ספרות (קו נייח הופך לעוגן זהות)",
    find: "d.matches('^05[0-9]{8}$') ? '+972' + d[1:10]",
    with: "d.matches('^0[0-9]{9}$') ? '+972' + d[1:10]",
  },
  {
    id: "M02",
    what: "canonPhone מקבל אורך גמיש (מספר עם ספרה עודפת הופך לנייד תקין)",
    // ⚠️ הערה שנקנתה בניסוי ולא בזיכרון: הורדת עוגן הסוף לבדה **אינה**
    // מוטציה — matches() ב-firestore.rules מתאים את **כל** המחרוזת, ולכן
    // התבנית עם העוגן וזו שבלעדיו שקולות לוגית (נמדד: שני הצדדים דחו
    // 05400000177 באותה צורה). ההחלשה האמיתית היא בכמות הספרות.
    find: "d.matches('^05[0-9]{8}$') ? '+972' + d[1:10]",
    with: "d.matches('^05[0-9]{7,9}$') ? '+972' + d[1:10]",
  },
  {
    id: "M03",
    what: "canonPhone אינו מסיר את ה-0 המוביל (כל נהג מפסיק להיכנס)",
    find: "d.matches('^05[0-9]{8}$') ? '+972' + d[1:10]",
    with: "d.matches('^05[0-9]{8}$') ? '+972' + d",
  },
  {
    id: "M04",
    what: "canonPhone מקבל גם 972 בלי לבדוק שזו קידומת נייד",
    find: "(d.matches('^9725[0-9]{8}$') ? '+' + d",
    with: "(d.matches('^972[0-9]{9}$') ? '+' + d",
  },
  // ============ phoneMatchesToken — שתי ההגנות על "ריק" ============
  {
    id: "M05",
    what: "phoneMatchesToken בלי בדיקת טוקן ריק (טוקן בלי נייד מותאם לרשומה בלי נייד)",
    find:
      "      return tokenPhone() != " + Q + Q + "\n" +
      "        && canonPhone(raw) != " + Q + Q + "\n" +
      "        && canonPhone(raw) == tokenPhone();",
    with: "      return canonPhone(raw) == tokenPhone();",
  },
  {
    id: "M06",
    what: "phoneMatchesToken בלי בדיקת רשומה ריקה",
    // ⚠️ **מוטציה שקולה, ולכן היא אמורה לשרוד.** התנאי הזה חסום-מתמטית ע"י
    // שני האחרים: אם canonPhone(raw) הוא '', אז השוויון ל-tokenPhone() יכול
    // להתקיים רק כשגם הטוקן ריק — וזה בדיוק מה שהתנאי הראשון שולל. כלומר
    // canonPhone(raw) != '' הוא **הגנת עומק מתועדת**, לא תנאי נושא-משקל.
    // נמדד: המוטציה שרדה את כל 431 הבדיקות, ואין בדיקה שתתפוס אותה — כי אין
    // התנהגות שהשתנתה. השארנו אותה ברשימה **כבקרה**: אם ביום מן הימים היא
    // תתחיל להיתפס, זה אומר שמישהו שינה את phoneMatchesToken והתנאי הזה הפך
    // לנושא-משקל — וזה בדיוק הרגע שבו רוצים לדעת.
    equivalent: true,
    find:
      "      return tokenPhone() != " + Q + Q + "\n" +
      "        && canonPhone(raw) != " + Q + Q + "\n" +
      "        && canonPhone(raw) == tokenPhone();",
    with:
      "      return tokenPhone() != " + Q + Q + "\n" +
      "        && canonPhone(raw) == tokenPhone();",
  },
  {
    id: "M07",
    what: "השוואת מחרוזות גולמית במקום צורה קנונית (מי שהמספר שלו שמור עם מקפים לא נכנס)",
    find:
      "      return tokenPhone() != " + Q + Q + "\n" +
      "        && canonPhone(raw) != " + Q + Q + "\n" +
      "        && canonPhone(raw) == tokenPhone();",
    with:
      "      return tokenPhone() != " + Q + Q + "\n" +
      "        && raw != " + Q + Q + "\n" +
      "        && raw == tokenPhone();",
  },
  // ===================== isSelfLinkClaim — חמשת התנאים =====================
  {
    id: "M08",
    what: "תביעת רשומה **מקושרת** מותרת (חטיפת חשבון של עובד אחר)",
    find:
      "      return phoneMatchesToken(resource.data.get('phone', ''))\n" +
      "        && resource.data.get('userId', null) == null",
    with: "      return phoneMatchesToken(resource.data.get('phone', ''))",
  },
  {
    id: "M09",
    what: "'revoked' ניתן לתביעה מחדש (עובד שעזב מקשר את עצמו בחזרה)",
    find:
      "        && resource.data.get('portalStatus', 'none') in ['none', 'invited']\n" +
      "        && resource.data.get('status', 'active') != 'archived'\n" +
      "        && request.resource.data.diff(resource.data).affectedKeys()",
    with:
      "        && resource.data.get('portalStatus', 'none') in ['none', 'invited', 'revoked']\n" +
      "        && resource.data.get('status', 'active') != 'archived'\n" +
      "        && request.resource.data.diff(resource.data).affectedKeys()",
  },
  {
    id: "M10",
    what: "נהג בארכיון מקשר חשבון",
    find:
      "        && resource.data.get('status', 'active') != 'archived'\n" +
      "        && request.resource.data.diff(resource.data).affectedKeys()",
    with: "        && request.resource.data.diff(resource.data).affectedKeys()",
  },
  {
    id: "M11",
    what: "hasOnly מורחב — הנהג עורך לעצמו שם, מחלקה, הערות וסטטוס",
    find: "             .hasOnly(['userId', 'portalStatus', 'portalLinkedPhone', 'updatedAt'])",
    with:
      "             .hasOnly(['userId', 'portalStatus', 'portalLinkedPhone', 'updatedAt',\n" +
      "                       'fullName', 'department', 'notes', 'status', 'phone', 'portalLinkedEmail'])",
  },
  {
    id: "M12",
    what: "קישור ל-uid של מישהו אחר",
    find:
      "        && request.resource.data.userId == request.auth.uid\n" +
      "        && request.resource.data.portalStatus == 'active'",
    with: "        && request.resource.data.portalStatus == 'active'",
  },
  {
    id: "M13",
    what: "portalLinkedPhone אינו נאכף מול הטוקן (מחרוזת חופשית בשדה התיעוד)",
    find: "        && request.resource.data.get('portalLinkedPhone', '') == tokenPhone();",
    with: "        && request.resource.data.get('portalLinkedPhone', '') != 'zzz';",
  },
  {
    id: "M14",
    what: "portalStatus היעד אינו נאכף ל-active",
    find: "        && request.resource.data.portalStatus == 'active'\n",
    with: "",
  },
  // ===================== סעיף ה-read של הנהגים =====================
  {
    id: "M15",
    what: "קריאת רשומת נהג **מקושרת** לפי התאמת נייד (עובד קורא רשומה של עובד אחר)",
    find:
      "          || (phoneMatchesToken(resource.data.get('phone', ''))\n" +
      "              && resource.data.get('userId', null) == null",
    with: "          || (phoneMatchesToken(resource.data.get('phone', ''))",
  },
  {
    id: "M16",
    what: "מי שנותק ('revoked') ממשיך לקרוא את רשומת הנהג שלו",
    find:
      "              && resource.data.get('portalStatus', 'none') in ['none', 'invited']\n" +
      "              && resource.data.get('status', 'active') != 'archived');",
    with: "              && resource.data.get('status', 'active') != 'archived');",
  },
  // ============ והצד שלא נגענו בו: האדמינים. אם מוטציה כאן שורדת, ============
  // ============ זה אומר שבדיקות ה-allowlist הפסיקו לשמור עליו.    ============
  {
    id: "M17",
    what: "בקרה: ה-allowlist של האדמינים בלי email_verified",
    find:
      "      return tokenEmailVerified()\n" +
      "        && tokenEmail() != " + Q + Q,
    with: "      return tokenEmail() != " + Q + Q,
  },
  {
    id: "M18",
    what: "בקרה: הבידוד של isMyDriverId בלי portalStatus=='active'",
    find:
      "        && get(driverRef(orgId, driverId)).data.get('portalStatus', 'none') == 'active'\n",
    with: "",
  },
];

// ---------------------------------------------------------------------------
const run = (file) => {
  const res = spawnSync(process.execPath, [join(ROOT, "scripts", "rules-test.mjs")], {
    cwd: ROOT,
    env: { ...process.env, FLEET_RULES_FILE: file },
    encoding: "utf8",
    timeout: 600000,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`;
  if (res.status === 2) {
    console.error("\n⛔ האמולטור אינו רץ. ראה scripts/rules-test.mjs לפקודת ההפעלה.\n");
    process.exit(2);
  }
  // מספר הבדיקות שנפלו — משורת הסיכום, ובגיבוי ספירת שורות ה-✗.
  const m = out.match(/נכשלו (\d+) בדיקות כללים/);
  const failed = m ? Number(m[1]) : (out.match(/^\s+✗ /gm) || []).length || null;
  const firstFailure = (out.match(/^\s+✗ .+$/m) || [""])[0].trim();
  return { ok: res.status === 0, failed, firstFailure, out };
};

console.log("— ריצת בסיס: הכללים האמיתיים חייבים לעבור לפני שמודדים מוטציות");
const base = run(join(ROOT, "firestore.rules"));
if (!base.ok) {
  console.error("⛔ חבילת הבדיקות נכשלת על הכללים **האמיתיים**. אין מה למדוד.");
  console.error(base.out.split("\n").slice(-25).join("\n"));
  process.exit(1);
}
console.log("  ✓ בסיס ירוק\n");

const caught = [];
const survived = [];
const equivalent = [];

for (const m of MUTATIONS) {
  const hits = SRC.split(m.find).length - 1;
  if (hits !== 1) {
    console.error(`⛔ ${m.id}: התבנית נמצאה ${hits} פעמים (נדרש 1). המוטציה אינה מה שחשבנו.`);
    process.exit(1);
  }
  const file = join(TMP, `${m.id}.rules`);
  // ⚠️ **replace עם פונקציה, לא עם מחרוזת.** בתבניות של canonPhone יש
  // `$'` (סוף regex + גרש סוגר), ו-`$'` הוא **תבנית החלפה מיוחדת** ב-JS:
  // "כל הטקסט שאחרי ההתאמה". עם מחרוזת, ארבע המוטציות הראשונות הפכו לקבצי
  // כללים שאינם מתקמפלים — כלומר "נתפסו" מהסיבה הלא נכונה: לא כי הבדיקות
  // שומרות על התנאי, אלא כי הכללים נשברו. בדיקה שנופלת מסיבה אחרת אינה
  // בדיקה — וזה בדיוק מה שהסקריפט הזה נועד לגלות, גם על עצמו.
  const mutant = SRC.replace(m.find, () => m.with);
  if (mutant === SRC) {
    console.error(`⛔ ${m.id}: ההחלפה לא שינתה דבר.`);
    process.exit(1);
  }
  writeFileSync(file, mutant, "utf8");
  const r = run(file);
  // כללים שאינם מתקמפלים אינם מוטציה — זו שגיאת תחביר, והיא "נתפסת"
  // טריוויאלית בלי ללמד כלום.
  if (/Error compiling rules/.test(r.out)) {
    console.error(`⛔ ${m.id}: המוטציה שברה את הקומפילציה של הכללים — תקן את התבנית.`);
    console.error("   " + (r.out.match(/Error compiling rules[^"]*/) || [""])[0].slice(0, 200));
    process.exit(1);
  }
  if (r.ok) {
    // מוטציה שקולה ששרדה היא התוצאה **הנכונה** — אין התנהגות שהשתנתה, ולכן
    // אין מה לתפוס. מוטציה רגילה ששרדה היא חור בבדיקות.
    if (m.equivalent) {
      equivalent.push(m);
      console.log(`  = ${m.id} שקולה (שרדה כצפוי) — ${m.what}`);
    } else {
      survived.push(m);
      console.log(`  ⚠️  ${m.id} שרדה — ${m.what}`);
    }
  } else {
    caught.push({ ...m, failed: r.failed, by: r.firstFailure });
    console.log(`  ✓ ${m.id} נתפסה (${r.failed} בדיקות נפלו) — ${m.what}`);
    if (r.by) console.log(`      ↳ ${r.by}`);
  }
}

console.log("\n" + "=".repeat(70));
console.log(
  `מוטציות: ${MUTATIONS.length} · נתפסו: ${caught.length} · שקולות: ${equivalent.length} · שרדו: ${survived.length}`
);
if (survived.length) {
  console.error("\n⚠️ מוטציות ששרדו — כל אחת מהן היא חור בבדיקות (ואולי בכללים):");
  for (const m of survived) console.error(`  • ${m.id} — ${m.what}`);
  process.exit(1);
}
console.log("✓ כל המוטציות נתפסו. החבילה שומרת על כל תנאי שנבדק כאן.");
