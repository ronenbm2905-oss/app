// ============================================================================
// rules.test.mjs — בדיקות `firestore.rules` מול האמולטור האמיתי.
//
// הרצה:  npm run test:rules      (דורש Java — האמולטור רץ עליו)
//
// ⚠ **למה זה קובץ נפרד מ-smoke:** smoke בודק לוגיקה טהורה ורץ בשנייה. כאן
// עולה אמולטור אמיתי ונשאלות שאלות אבטחה — הן איטיות, אבל הן היחידות שעונות
// על "האם זר יכול לקרוא את 85 הספקים והטלפונים שלהם".
//
// הלקח מ-coachtrack: כללים שנכתבו ולא נבדקו הם כללים שלא עובדים. שלושה חורים
// התגלו שם רק כשמישהו הריץ אותם.
// ============================================================================

import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * ⚠ `RULES_FILE` מאפשר לבדוק את **הטקסט המדויק שרונן מדביק בקונסולה**, ולא
 * רק את הקובץ שבריפו. הגרסה להדבקה נקייה מהערות בעברית — טקסט דו-כיווני
 * בעורך קוד בדפדפן עלול להישבר, ובלי הבדיקה הזאת היינו מגלים את זה רק
 * כשהכללים לא מתקמפלים אצלו.
 */
const RULES_FILE = process.env.RULES_FILE || "firestore.rules";
const ORG = "vitzman";

const RONEN = { email: "ronen@example.com", email_verified: true };
const ANDREI = { email: "andrei@example.com", email_verified: true };
const STRANGER = { email: "stranger@example.com", email_verified: true };
const UPPER = { email: "Ronen@Example.COM", email_verified: true };

let pass = 0, fail = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); return; }
  fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};
const check = async (name, promise) => {
  try { await promise; ok(name, true); }
  catch (e) { ok(name, false, e.message?.slice(0, 120)); }
};

const env = await initializeTestEnvironment({
  projectId: "vitzman-rules-test",
  firestore: { rules: readFileSync(resolve(ROOT, RULES_FILE), "utf8"), host: "127.0.0.1", port: 8080 },
});

// מצב פתיחה: הארגון קיים, רונן ואנדריי ברשימה, ויש בניין אחד.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "orgs", ORG), { members: ["ronen@example.com", "andrei@example.com"] });
  await setDoc(doc(db, "orgs", ORG, "buildings", "b1"), { id: "b1", address: "אהרוני 10" });
  await setDoc(doc(db, "orgs", ORG, "vendors", "v1"), { id: "v1", name: "ספק", phone: "050-1234567" });

  // ⚠ ארגון שני שבו `members` נשמר כ**מחרוזת** ולא כמערך — הטעות שקל לעשות
  // בקונסולה, שנראית זהה, וחוסמת את הבעלים מהמערכת שלו.
  await setDoc(doc(db, "orgs", "strorg"), { members: "ronen@example.com" });
  await setDoc(doc(db, "orgs", "strorg", "buildings", "b1"), { id: "b1" });
});

const asRonen = env.authenticatedContext("u_ronen", RONEN).firestore();
const asAndrei = env.authenticatedContext("u_andrei", ANDREI).firestore();
const asStranger = env.authenticatedContext("u_stranger", STRANGER).firestore();
const asUpper = env.authenticatedContext("u_upper", UPPER).firestore();
const asAnon = env.unauthenticatedContext().firestore();

console.log("\n--- חבר צוות: רואה וכותב הכול ---");
await check("רונן קורא בניין", assertSucceeds(getDoc(doc(asRonen, "orgs", ORG, "buildings", "b1"))));
await check("רונן סורק את כל הבניינים", assertSucceeds(getDocs(collection(asRonen, "orgs", ORG, "buildings"))));
await check("רונן כותב בניין", assertSucceeds(setDoc(doc(asRonen, "orgs", ORG, "buildings", "b2"), { id: "b2", address: "חדש" })));
await check("רונן מוחק בניין", assertSucceeds(deleteDoc(doc(asRonen, "orgs", ORG, "buildings", "b2"))));
await check("אנדריי רואה בדיוק אותו דבר", assertSucceeds(getDoc(doc(asAndrei, "orgs", ORG, "buildings", "b1"))));
await check("אנדריי כותב — אין תפקידים", assertSucceeds(setDoc(doc(asAndrei, "orgs", ORG, "contracts", "c1"), { id: "c1", amount: 100 })));

console.log("\n--- ⚠ ״מחובר ל-Google״ אינו ״מורשה״ ---");
await check("זר מחובר לא קורא בניין", assertFails(getDoc(doc(asStranger, "orgs", ORG, "buildings", "b1"))));
await check("זר לא סורק בניינים", assertFails(getDocs(collection(asStranger, "orgs", ORG, "buildings"))));
await check("זר לא קורא ספקים (טלפונים!)", assertFails(getDocs(collection(asStranger, "orgs", ORG, "vendors"))));
await check("זר לא כותב", assertFails(setDoc(doc(asStranger, "orgs", ORG, "buildings", "hack"), { x: 1 })));
await check("זר לא קורא את מסמך הארגון", assertFails(getDoc(doc(asStranger, "orgs", ORG))));
await check("זר לא מוסיף את עצמו לרשימה",
  assertFails(updateDoc(doc(asStranger, "orgs", ORG), { members: ["ronen@example.com", "stranger@example.com"] })));

console.log("\n--- לא מחובר בכלל ---");
await check("אנונימי לא קורא", assertFails(getDoc(doc(asAnon, "orgs", ORG, "buildings", "b1"))));
await check("אנונימי לא כותב", assertFails(setDoc(doc(asAnon, "orgs", ORG, "buildings", "x"), { x: 1 })));
await check("אנונימי לא קורא את הארגון", assertFails(getDoc(doc(asAnon, "orgs", ORG))));

console.log("\n--- רשימת המורשים ---");
await check("חבר קורא את מסמך הארגון", assertSucceeds(getDoc(doc(asRonen, "orgs", ORG))));
await check("חבר מוסיף חבר",
  assertSucceeds(updateDoc(doc(asRonen, "orgs", ORG), { members: ["ronen@example.com", "andrei@example.com", "dana@example.com"] })));
await check("⚠ חבר לא מסיר את עצמו — זה היה נועל את כולם החוצה",
  assertFails(updateDoc(doc(asRonen, "orgs", ORG), { members: ["andrei@example.com"] })));
await check("⚠ ורשימה ריקה נחסמת",
  assertFails(updateDoc(doc(asRonen, "orgs", ORG), { members: [] })));
await check("⚠ שלושה מורשים מותרים",
  assertSucceeds(updateDoc(doc(asRonen, "orgs", ORG), {
    members: ["ronen@example.com", "andrei@example.com", "third@example.com"] })));
await check("⚠ רביעי נחסם — ״מאגר המנוהל בידי יחיד״ מוגבל ל-3",
  assertFails(updateDoc(doc(asRonen, "orgs", ORG), {
    members: ["ronen@example.com", "andrei@example.com", "third@example.com", "fourth@example.com"] })),
  "הרביעי מוציא את המאגר מהקטגוריה המקלה בתקנות אבטחת מידע");
await check("אי אפשר למחוק את מסמך הארגון", assertFails(deleteDoc(doc(asRonen, "orgs", ORG))));
await check("אי אפשר ליצור ארגון שני", assertFails(setDoc(doc(asRonen, "orgs", "other"), { members: ["stranger@example.com"] })));

console.log("\n--- ⚠ אותיות גדולות במייל ---");
await check("Ronen@Example.COM מזוהה כרונן",
  assertSucceeds(getDoc(doc(asUpper, "orgs", ORG, "buildings", "b1"))),
  "Google מחזיר את המייל כפי שנרשם; בלי lower() רונן היה ננעל החוצה מהחשבון שלו");

console.log("\n--- ⚠ members מסוג string במקום array ---");
// זו הטעות שרונן עשה בקונסולה: השדה נשמר, נראה זהה, וחוסם את הבעלים.
await check("⚠ members כמחרוזת חוסם גם את מי שכתוב בו",
  assertFails(getDoc(doc(asRonen, "orgs", "strorg", "buildings", "b1"))),
  "בקונסולה השדה נראה זהה למערך — ולכן הקליינט מציג הודעה מפורשת");
await check("וגם קריאת מסמך הארגון עצמו נחסמת",
  assertFails(getDoc(doc(asRonen, "orgs", "strorg"))));

console.log("\n--- מחוץ לארגון: deny by default ---");
await check("אוסף שורש אחר חסום", assertFails(getDoc(doc(asRonen, "whatever", "x"))));
await check("וכתיבה אליו חסומה", assertFails(setDoc(doc(asRonen, "whatever", "x"), { x: 1 })));

await env.cleanup();
console.log(`\n${"=".repeat(50)}\n  עברו ${pass} · נכשלו ${fail}`);
if (failures.length) { console.log("\n  כשלונות:"); for (const f of failures) console.log(`    ✗ ${f}`); }
console.log(`${"=".repeat(50)}\n`);
process.exit(fail ? 1 : 0);
