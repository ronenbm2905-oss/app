// ============================================================================
// rules-tests.mjs — אכיפת `firestore.rules` **בהרצה**, מול אמולטור אמיתי.
//
// 🔴 זה **תנאי סף לשער של עדי** (R-6), לא נחמד-שיהיה:
//
//    "כללי Firebase **אדיטיביים ואין בהם `deny`** — כלל רחב אחד במקום אחר
//     בקובץ מבטל בשקט את כל מה שלמעלה."
//
//    ב-NRCAR כלל רחב כזה איפשר להנפיק טוקן הורדה בלתי-מאומת על מסמך הזהות
//    של אדם אחר. הוא לא נתפס בשום סריקה סטטית ובשום code review — רק
//    בהרצה מול אמולטור.
//
// שבעת האסרשנים שעדי דרשה מסומנים למטה ב-[R-6.n].
// רץ בתוך `npm run emu:rules`. project-id פיקטיבי, אפס נתונים אמיתיים.
// ============================================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  setLogLevel,
} from "firebase/firestore";

// דחיות צפויות מייצרות PERMISSION_DENIED רועש ב-stderr. הן **הציפייה** כאן,
// ולכן הרעש מסתיר את התוצאה במקום לחשוף אותה.
setLogLevel("silent");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULES_TEXT = readFileSync(join(ROOT, "firestore.rules"), "utf8");

// ⚠️ מייל הבעלים **נקרא מתוך `firestore.rules`** ולא מקודד כאן.
//    אחרת הבדיקה עוברת היום עם ה-placeholder ונשברת ביום שבו המשתמש
//    מחליף אותו במייל אמיתי — כלומר בדיוק ביום שבו היא הכי נחוצה.
//    כך היא מאמתת את **המנגנון**, לא מחרוזת מסוימת.
const OWNER_EMAIL = (() => {
  const block = RULES_TEXT.match(/function ownerEmails\(\)\s*\{[\s\S]*?\}/);
  const m = block && block[0].match(/['"]([^'"]+@[^'"]+)['"]/);
  if (!m) throw new Error("לא נמצא מייל בעלים ב-ownerEmails() בתוך firestore.rules");
  return m[1];
})();
console.log(`(מייל הבעלים לבדיקה, נקרא מתוך firestore.rules: ${OWNER_EMAIL})`);

let pass = 0;
let failed = 0;
const failures = [];

async function must(name, promise, shouldSucceed) {
  try {
    await (shouldSucceed ? assertSucceeds(promise) : assertFails(promise));
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n      ${String(err.message).split("\n")[0]}`);
  }
}
const allow = (name, p) => must(name, p, true);
const deny = (name, p) => must(name, p, false);
const section = (title) => console.log(`\n— ${title}`);

// -- סביבה -------------------------------------------------------------------
const testEnv = await initializeTestEnvironment({
  projectId: "mas-shevach-emulator",
  firestore: { rules: RULES_TEXT, host: "127.0.0.1", port: 8080 },
});
await testEnv.clearFirestore();

// ⚠️ הזריעה חייבת לרוץ **לפני** יצירת כל context אחר.
//    `withSecurityRulesDisabled` מאתחל Firestore מחדש, ואם כבר נוצר ממנו
//    instance אחר — הוא נופל ב-"Firestore has already been started".
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const seedDb = ctx.firestore();
  await setDoc(doc(seedDb, "leads", "seed_1"), {
    firstName: "דנה",
    phone: "0521234567",
    screened: true,
    status: "new",
    createdAt: new Date(),
  });
  await setDoc(doc(seedDb, "suppression", "hash_abc"), { optedOut: true });
  await setDoc(doc(seedDb, "opsLog", "op_1"), { action: "status:new" });
  // 🔴 M4 — אוסף הדיוור הוסר. נזרע כאן בכל זאת, כדי לאמת שהוא נופל תחת
  //    ה-deny-by-default הסוגר ולא נשאר נגיש בגלל כלל שנשכח.
  await setDoc(doc(seedDb, "marketingSubscribers", "sub_1"), { email: "a@b.com" });
});

// אנונימי = מבקר בדף הנחיתה. **זה המצב שבו ליד נכתב בפועל.**
const anon = testEnv.unauthenticatedContext();
// משתמש מחובר שאינו הבעלים — כל בעל חשבון Google בעולם.
const stranger = testEnv.authenticatedContext("uid_stranger", {
  email: "someone@example.com",
  email_verified: true,
});
// הבעלים דרך custom claim (המסלול המועדף).
const ownerByClaim = testEnv.authenticatedContext("uid_owner_claim", { role: "owner" });
// הבעלים דרך allowlist מיילים (מסלול ההקמה).
const ownerByEmail = testEnv.authenticatedContext("uid_owner_email", {
  email: OWNER_EMAIL,
  email_verified: true,
});
// אותו מייל, **בלי אימות מייל** — חייב להיחסם.
const unverified = testEnv.authenticatedContext("uid_unverified", {
  email: OWNER_EMAIL,
  email_verified: false,
});

const anonDb = anon.firestore();
const strangerDb = stranger.firestore();
const claimDb = ownerByClaim.firestore();
const emailDb = ownerByEmail.firestore();
const unverifiedDb = unverified.firestore();

// -- payloads ----------------------------------------------------------------
const validLead = (over = {}) => ({
  firstName: "דנה",
  phone: "0521234567",
  email: "dana@example.com",
  screened: true,
  source: { utmSource: "google", utmMedium: "cpc" },
  policyVersion: "1.0-draft", // 🔴 שדה עליון, לא בתוך source
  createdAt: serverTimestamp(),
  ...over,
});

let n = 0;
const newLeadRef = (db) => doc(db, "leads", `lead_${++n}`);

// ============================================================================
section("1. הזרימה הציבורית — כתיבת ליד מדף הנחיתה");
// ============================================================================
// [R-6.1] אנונימי יכול ליצור ליד תקין.
await allow("[R-6.1] אנונימי יוצר ליד תקין", setDoc(newLeadRef(anonDb), validLead()));

await allow(
  "אנונימי יוצר ליד בלי אימייל (השדה אופציונלי — עדי S3)",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.email; return d; })())
);
await allow(
  "אנונימי יוצר ליד עם screened:false (לא עבר סינון — עדיין ליד לגיטימי)",
  setDoc(newLeadRef(anonDb), validLead({ screened: false }))
);
await allow("טלפון קווי בן 9 ספרות", setDoc(newLeadRef(anonDb), validLead({ phone: "036543210" })));
await allow(
  "ליד בלי `source` כלל (כניסה ישירה, בלי utm)",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.source; return d; })())
);

// 🔴 רגרסיה — הבאג שנתפס בסבב השני. הגרסה הראשונה של `validName` הייתה
//    allowlist תווים (עברית + לטינית), והיא דחתה שמות בערבית וברוסית.
//    בישראל זה חוסם בשקט חלק ניכר מהאוכלוסייה: כל אחד מהם ליד אבוד
//    בקמפיין ממומן, וגם הפליה בתוצאה.
for (const name of ["בת-אל", "Daniel", "ג'ו", "محمد", "سارة", "Дмитрий", "Zoë", "Jean-Luc"]) {
  await allow(`שם לגיטימי מתקבל: ${name}`, setDoc(newLeadRef(anonDb), validLead({ firstName: name })));
}

// ============================================================================
section("2. R-2 — allowlist השדות. הליבה של 'אין ת.ז. ואין סכומים'");
// ============================================================================
// [R-6.3] מפתח מחוץ ל-allowlist נדחה. זה מה שהופך את האיסור למנגנון:
// בלי hasOnly, כל אחד שפותח DevTools כותב את זה בהצלחה.
await deny(
  "[R-6.3] ת.ז. — `idNumber` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ idNumber: "123456789" }))
);
await deny("ת.ז. — `tz` נדחה", setDoc(newLeadRef(anonDb), validLead({ tz: "123456789" })));
await deny(
  "סכום — `refundAmount` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ refundAmount: 265000 }))
);
await deny(
  "סכום — `taxPaid` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ taxPaid: 530000 }))
);
await deny(
  "תאריך מכירה מדויק נדחה",
  setDoc(newLeadRef(anonDb), validLead({ saleDate: "2021-03-14" }))
);
await deny(
  "כתובת נכס נדחית",
  setDoc(newLeadRef(anonDb), validLead({ propertyAddress: "הרצל 5, תל אביב" }))
);
await deny(
  "שדה טקסט חופשי — `notes` נדחה (הווקטור שהורד גם ב-fleet וגם ב-property)",
  setDoc(newLeadRef(anonDb), validLead({ notes: "מכרתי דירה, שילמתי 240 אלף" }))
);
await deny(
  "שם משפחה נדחה",
  setDoc(newLeadRef(anonDb), validLead({ lastName: "כהן" }))
);

// 🔴 הליבה של S3: ארבע תשובות הבודק כערכים נפרדים = תיק מס מזערי.
await deny(
  "ארבע תשובות הבודק כערכים נפרדים נדחות (S3)",
  setDoc(
    newLeadRef(anonDb),
    validLead({ soldProperty: true, within6y: true, employmentStatus: "salaried", taxWasPaid: true })
  )
);
await deny(
  "מפה של תשובות הבודק נדחית",
  setDoc(newLeadRef(anonDb), validLead({ checkerAnswers: { q1: true, q2: "6y" } }))
);

// שדות שרת — הקליינט לא כותב אותם, גם לא בהתחזות.
await deny(
  "הקליינט לא יכול לקבוע `status`",
  setDoc(newLeadRef(anonDb), validLead({ status: "converted" }))
);
await deny(
  "הקליינט לא יכול לקבוע `purgeAfter` (עקיפת מדיניות המחיקה)",
  setDoc(newLeadRef(anonDb), validLead({ purgeAfter: new Date(2099, 0, 1) }))
);
await deny(
  "הקליינט לא יכול לקבוע `purgedAt`",
  setDoc(newLeadRef(anonDb), validLead({ purgedAt: null }))
);

// שדות חובה
await deny(
  "בלי `firstName` נדחה",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.firstName; return d; })())
);
await deny(
  "בלי `phone` נדחה",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.phone; return d; })())
);
await deny(
  "בלי `createdAt` נדחה",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.createdAt; return d; })())
);

// ============================================================================
section("3. R-3 — טיפוסים, אורכים, ותקינות");
// ============================================================================
await deny(
  "טלפון לא תקין (אותיות)",
  setDoc(newLeadRef(anonDb), validLead({ phone: "05x1234567" }))
);
await deny("טלפון קצר מדי", setDoc(newLeadRef(anonDb), validLead({ phone: "052123" })));
await deny("טלפון ארוך מדי", setDoc(newLeadRef(anonDb), validLead({ phone: "05212345678" })));
await deny("טלפון עם מקפים (הקליינט מנרמל)", setDoc(newLeadRef(anonDb), validLead({ phone: "052-123-4567" })));
await deny("טלפון שאינו מחרוזת", setDoc(newLeadRef(anonDb), validLead({ phone: 521234567 })));

await deny(
  "שם ארוך מ-40 תווים (מונע הפיכתו לשדה טקסט חופשי)",
  setDoc(newLeadRef(anonDb), validLead({ firstName: "א".repeat(41) }))
);
// 🔴 חיזוק מעבר למפרט של עדי: אין ספרות בשם.
// תקרת אורך לבדה עדיין מאפשרת "יוסי ת.ז 123456789".
await deny(
  "🔴 שם המכיל ת.ז. נדחה — אין ספרות ב-firstName",
  setDoc(newLeadRef(anonDb), validLead({ firstName: "יוסי 123456789" }))
);
await deny(
  "שם המכיל סכום נדחה",
  setDoc(newLeadRef(anonDb), validLead({ firstName: "דנה 265000" }))
);

await deny("אימייל לא תקין", setDoc(newLeadRef(anonDb), validLead({ email: "not-an-email" })));
await deny("אימייל ריק נדחה (נשלח כהשמטה, לא כמחרוזת ריקה)", setDoc(newLeadRef(anonDb), validLead({ email: "" })));
await deny(
  "אימייל ארוך מ-100 תווים",
  setDoc(newLeadRef(anonDb), validLead({ email: "a".repeat(95) + "@x.com" }))
);
await deny("screened שאינו בוליאני", setDoc(newLeadRef(anonDb), validLead({ screened: "yes" })));

// 🔴 M4 — ההסכמה לדיוור ירדה לגמרי. השדה נדחה עכשיו כ**מפתח לא מוכר**
//    (hasOnly), ולא כטיפוס שגוי — כלומר גם `marketingOptIn: false` נדחה.
await deny(
  "🔴 M4 — `marketingOptIn: true` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ marketingOptIn: true }))
);
await deny(
  "🔴 M4 — גם `marketingOptIn: false` נדחה (מפתח לא מוכר, לא טיפוס שגוי)",
  setDoc(newLeadRef(anonDb), validLead({ marketingOptIn: false }))
);
await deny(
  "🔴 M4 — `optInAt` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ optInAt: new Date() }))
);

// [R-6.7] createdAt שאינו זמן השרת — חותמת שנשלטת ע"י הקליינט מאפשרת
// להזיז ליד אל מחוץ לחלון המחיקה של S8.
await deny(
  "[R-6.7] createdAt שאינו request.time נדחה",
  setDoc(newLeadRef(anonDb), validLead({ createdAt: new Date(2020, 0, 1) }))
);
await deny(
  "createdAt עתידי נדחה",
  setDoc(newLeadRef(anonDb), validLead({ createdAt: new Date(2099, 0, 1) }))
);

await deny(
  "שם רב-שורתי נדחה (POST ישיר שעוקף את נרמול הקליינט)",
  setDoc(newLeadRef(anonDb), validLead({ firstName: "דנה\nת.ז" }))
);

// ============================================================================
// 🔴 `source` — ייחוס שיווקי בלבד. הדפוס: טקסט/מזהה שמקורו במשתמש או
//    בפלטפורמה, שנכנס דרך שכבת האנליטיקס ועוקף את S3 **בדלת צדדית** —
//    בלי ששום שדה טופס נפתח.
// ============================================================================
await deny(
  "🔴 `utmTerm` נדחה — מילת החיפוש שהמשתמש הקליד",
  setDoc(newLeadRef(anonDb), validLead({ source: { utmTerm: "מכרתי דירה ושילמתי 240 אלף מס" } }))
);
await deny(
  "🔴 `referrer` מלא נדחה — נושא את שאילתת מנוע החיפוש המפנה",
  setDoc(newLeadRef(anonDb), validLead({ source: { referrer: "https://www.google.com/search?q=..." } }))
);
await deny(
  "🔴 `landingUrl` עם query string נדחה",
  setDoc(newLeadRef(anonDb), validLead({ source: { landingUrl: "https://x.co.il/?q=..." } }))
);
await deny(
  "🔴 `gclid` נדחה — מזהה קליק בלי שום שימוש מותר (S11(1) חסם את היחיד שהיה)",
  setDoc(newLeadRef(anonDb), validLead({ source: { gclid: "Cj0KCQjw" } }))
);
await deny(
  "🔴 `fbclid` נדחה",
  setDoc(newLeadRef(anonDb), validLead({ source: { fbclid: "IwAR0x" } }))
);
await deny(
  "`source` שאינו מפה נדחה",
  setDoc(newLeadRef(anonDb), validLead({ source: "google/cpc" }))
);
await deny(
  "ערך utm ארוך מ-64 תווים נדחה",
  setDoc(newLeadRef(anonDb), validLead({ source: { utmCampaign: "c".repeat(65) } }))
);

// -- policyVersion — ראיית ההסכמה, שדה עליון וחובה --
await deny(
  "🔴 ליד בלי `policyVersion` נדחה — הסכמה בלי חותמת חסרת ערך ראייתי (S9)",
  setDoc(newLeadRef(anonDb), (() => { const d = validLead(); delete d.policyVersion; return d; })())
);
await deny(
  "`policyVersion` ריק נדחה",
  setDoc(newLeadRef(anonDb), validLead({ policyVersion: "" }))
);
await deny(
  "`policyVersion` שאינו מחרוזת נדחה",
  setDoc(newLeadRef(anonDb), validLead({ policyVersion: 1 }))
);
await deny(
  "🔴 `policyVersion` בתוך `source` אינו מתקבל — הוא חייב להיות עליון",
  setDoc(
    newLeadRef(anonDb),
    (() => {
      const d = validLead({ source: { utmSource: "g", policyVersion: "1.0" } });
      delete d.policyVersion;
      return d;
    })()
  )
);

// ============================================================================
section("4. R-1 + R-4 — קריאה. 'מחובר' אינו 'מורשה'");
// ============================================================================
// (הזריעה בוצעה בראש הקובץ — ראה ההערה שם.)

// [R-6.2] 🔴 האסרשן החשוב ביותר בקובץ.
await deny("[R-6.2] אנונימי לא קורא ליד בודד", getDoc(doc(anonDb, "leads", "seed_1")));
await deny("[R-6.2] אנונימי לא מריץ list על leads", getDocs(collection(anonDb, "leads")));

// [R-6.5] 🔴 החוסם שעדי תפסה ב-basketball: `request.auth != null` אינו בקרת גישה.
await deny(
  "[R-6.5] משתמש מחובר שאינו הבעלים לא קורא ליד",
  getDoc(doc(strangerDb, "leads", "seed_1"))
);
await deny(
  "[R-6.5] משתמש מחובר שאינו הבעלים לא מריץ list",
  getDocs(collection(strangerDb, "leads"))
);
await deny(
  "מייל הבעלים בלי email_verified נחסם",
  getDoc(doc(unverifiedDb, "leads", "seed_1"))
);

// [R-6.6] הבעלים קורא — בשני המסלולים.
await allow("[R-6.6] בעלים לפי custom claim קורא ליד", getDoc(doc(claimDb, "leads", "seed_1")));
await allow("[R-6.6] בעלים לפי custom claim מריץ list", getDocs(collection(claimDb, "leads")));
await allow("[R-6.6] בעלים לפי allowlist מיילים קורא", getDoc(doc(emailDb, "leads", "seed_1")));

// ============================================================================
section("5. R-1 — update/delete חסומים. גם למשה");
// ============================================================================
// [R-6.4]
await deny(
  "[R-6.4] אנונימי לא מעדכן ליד קיים",
  updateDoc(doc(anonDb, "leads", "seed_1"), { firstName: "אחר" })
);
await deny("[R-6.4] אנונימי לא מוחק ליד", deleteDoc(doc(anonDb, "leads", "seed_1")));
await deny(
  "אנונימי לא דורס ליד קיים דרך set",
  setDoc(doc(anonDb, "leads", "seed_1"), validLead())
);
// 🔴 גם הבעלים. כל מוטציה עוברת ב-Cloud Function (Admin SDK).
// המשמעות: session גנוב של משה לא יכול למחוק את המאגר או לזייף סטטוס.
await deny(
  "🔴 גם הבעלים לא מעדכן ישירות — הכל דרך Cloud Function",
  updateDoc(doc(claimDb, "leads", "seed_1"), { status: "contacted" })
);
await deny("🔴 גם הבעלים לא מוחק ישירות", deleteDoc(doc(claimDb, "leads", "seed_1")));

// ============================================================================
section("6. אוספים שאינם `leads` — רשימת הדיכוי, הדיוור והיומן");
// ============================================================================
await deny("אנונימי לא קורא את רשימת הדיכוי", getDoc(doc(anonDb, "suppression", "hash_abc")));
await deny(
  "🔴 גם הבעלים לא קורא את רשימת הדיכוי — שרת בלבד",
  getDoc(doc(claimDb, "suppression", "hash_abc"))
);
await deny(
  "אף אחד לא כותב לרשימת הדיכוי מהקליינט",
  setDoc(doc(claimDb, "suppression", "hash_zzz"), { optedOut: true })
);
// 🔴 M4 — אוסף הדיוור הוסר מה-rules. האסרשנים האלה מוודאים שהוא נפל תחת
//    ה-deny-by-default הסוגר, ולא נשאר נגיש בגלל `match` שנשכח.
//    **גם הבעלים אינו קורא אותו יותר.**
await deny(
  "🔴 M4 — אנונימי לא קורא את אוסף הדיוור שהוסר",
  getDoc(doc(anonDb, "marketingSubscribers", "sub_1"))
);
await deny(
  "🔴 M4 — גם הבעלים לא קורא את אוסף הדיוור שהוסר",
  getDoc(doc(claimDb, "marketingSubscribers", "sub_1"))
);
await deny(
  "🔴 M4 — אף אחד לא כותב לאוסף הדיוור שהוסר",
  setDoc(doc(claimDb, "marketingSubscribers", "sub_2"), { email: "x@y.com" })
);
await allow("בעלים קורא את יומן הפעולות", getDoc(doc(claimDb, "opsLog", "op_1")));
await deny("אנונימי לא קורא את יומן הפעולות", getDoc(doc(anonDb, "opsLog", "op_1")));
await deny(
  "אף אחד לא כותב ליומן הפעולות מהקליינט",
  setDoc(doc(claimDb, "opsLog", "op_2"), { action: "fake" })
);

// ============================================================================
section("7. deny-by-default — אוסף שלא הוגדר כלל");
// ============================================================================
// זה האסרשן שתופס את הכשל של NRCAR: כלל רחב מתיר במקום כלשהו בקובץ.
await deny(
  "אנונימי לא כותב לאוסף שרירותי",
  setDoc(doc(anonDb, "randomCollection", "x"), { a: 1 })
);
await deny(
  "🔴 גם בעלים לא כותב לאוסף שרירותי (deny-by-default)",
  setDoc(doc(claimDb, "randomCollection", "x"), { a: 1 })
);
await deny(
  "בעלים לא קורא אוסף שרירותי",
  getDoc(doc(claimDb, "randomCollection", "x"))
);
await deny(
  "אין תת-אוסף חבוי מתחת לליד",
  setDoc(doc(anonDb, "leads", "seed_1", "private", "p1"), { a: 1 })
);
await deny(
  "בעלים לא קורא תת-אוסף מתחת לליד",
  getDoc(doc(claimDb, "leads", "seed_1", "private", "p1"))
);

// ============================================================================
await testEnv.cleanup();

console.log(`\n${"=".repeat(62)}`);
console.log(`עברו: ${pass}   נכשלו: ${failed}`);
if (failed) {
  console.error("\n🔴 אסרשנים שנכשלו:");
  for (const f of failures) console.error("   · " + f);
  console.error("\nה-rules אינם מאומתים. השער של עדי סגור.");
  process.exit(1);
}
console.log("✅ כל אסרשני ה-rules עברו מול אמולטור אמיתי.");
