// ============================================================================
// phone-auth-check.mjs — **זרימת כניסת הנהג, מול אמולטור Auth אמיתי.**
//
//   npm run phone:check
//
// הפעלת האמולטור (Auth בלבד מספיק):
//   cmd /c "npx firebase-tools emulators:start --only auth --project fleet-auth-test"
//
// ============================================================================
// למה הסקריפט הזה קיים, ולמה הוא לא "עוד בדיקה"
// ============================================================================
// **כל** מודל ההרשאות של פורטל הנהג מאז 1.10.2026 נשען על הנחה אחת:
// שכניסת טלפון מייצרת טוקן שבו יש `phone_number`, בפורמט E.164, ושאין בו
// `email`/`email_verified`. אם ההנחה הזו שגויה או משתנה:
//   • `canonPhone(...) == tokenPhone()` לא יתקיים לאף נהג → **אף אחד לא נכנס**
//     (וזו בדיוק צורת הכשל של מסלול המייל, שהיה תקין ופשוט לא היה בשימוש);
//   • או שמסך "אין הרשאה" יציג לנהג "המייל שלך אינו מאומת" — הוראה לפעולה
//     בלתי אפשרית, כי אין לו מייל בכלל.
//
// `scripts/rules-test.mjs` מזריק טוקנים **סינתטיים** (`authenticatedContext`
// עם phone_number), ולכן הוא מוכיח את הכללים אבל **לא** את ההנחה עצמה. כאן
// הזרימה אמיתית: שליחת קוד → קריאת הקוד מהאמולטור → אימות → פענוח הטוקן.
//
// ⚠️ מה שכן נשאר מחוץ לסקריפט: **ה-reCAPTCHA בדפדפן** (`RecaptchaVerifier`
// דורש DOM), ו-SMS אמיתי מול מספר אמיתי. שני אלה נבדקים רק במכשיר.
//
// ⚠️ המספר כאן בדוי לחלוטין ואינו של אף עובד.
// ============================================================================

const HOST = process.env.FLEET_AUTH_EMULATOR || "http://127.0.0.1:9099";
const PROJECT = process.env.FLEET_AUTH_PROJECT || "fleet-auth-test";
const KEY = "fake-api-key";
const PHONE = "+972500000001";

let pass = 0;
let failed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
};
const eq = (name, a, b) => {
  if (a === b) pass++;
  else {
    failed++;
    failures.push(`${name} — קיבלנו ${JSON.stringify(a)} במקום ${JSON.stringify(b)}`);
    console.error("  FAIL:", name, "· קיבלנו", JSON.stringify(a), "· ציפינו", JSON.stringify(b));
  }
};

// -- preflight: בלי ההודעה הזו הכישלון נראה כמו באג בקוד -------------------
try {
  const r = await fetch(`${HOST}/emulator/v1/projects/${PROJECT}/config`);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error("\n⛔ אמולטור ה-Auth אינו רץ על " + HOST);
  console.error("   הפעלה:");
  console.error(
    `   cmd /c "npx firebase-tools emulators:start --only auth --project ${PROJECT}"\n`
  );
  process.exit(2);
}

const post = async (path, body) => {
  const r = await fetch(`${HOST}/identitytoolkit.googleapis.com/v1/${path}?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) {
    const err = new Error(j?.error?.message || JSON.stringify(j));
    err.apiMessage = j?.error?.message;
    throw err;
  }
  return j;
};

const claimsOf = (idToken) =>
  JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString("utf8"));

console.log("\n— 1. שליחת קוד (זה מה ש-signInWithPhoneNumber עושה)");
const { sessionInfo } = await post("accounts:sendVerificationCode", {
  phoneNumber: PHONE,
  // ⚠️ באמולטור ה-reCAPTCHA מדולגת. בפרודקשן זה **חייב** להיות טוקן אמיתי
  // מ-RecaptchaVerifier, ולכן ה-div שלו חייב להיות ב-DOM לפני הקריאה.
  recaptchaToken: "ignored-by-emulator",
});
ok("התקבל sessionInfo", Boolean(sessionInfo));

console.log("— 2. קריאת הקוד שהאמולטור 'שלח'");
const codes = await (
  await fetch(`${HOST}/emulator/v1/projects/${PROJECT}/verificationCodes`)
).json();
// ⚠️ **האחרון, לא הראשון.** האמולטור אוגר את כל הקודים שהונפקו מאז
// שעלה, ולכן בהרצה שנייה `find` מחזיר קוד שכבר נוצל — וה-API מחזיר
// INVALID_CODE על הקוד ה"נכון". זה נראה בדיוק כמו באג בזרימה.
const mine = (codes.verificationCodes || []).filter((c) => c.phoneNumber === PHONE);
const entry = mine[mine.length - 1];
ok("האמולטור הנפיק קוד למספר הנכון", Boolean(entry?.code));
ok("הקוד בן 6 ספרות", /^[0-9]{6}$/.test(entry?.code || ""));

console.log("— 3. אימות הקוד");
const signed = await post("accounts:signInWithPhoneNumber", { sessionInfo, code: entry.code });
ok("התקבל uid", Boolean(signed.localId));
ok("התקבל idToken", Boolean(signed.idToken));

console.log("— 4. ⚠️ מה שה-rules יקבלו בפועל");
const claims = claimsOf(signed.idToken);
eq("token.phone_number הוא המספר שאומת, ב-E.164", claims.phone_number, PHONE);
eq("ספק הכניסה", claims.firebase?.sign_in_provider, "phone");
// ⬅ **שתי השורות שמצדיקות את התיקון ב-NoAccessScreen.** לנהג אין מייל בכלל,
//   ולכן באנר "המייל שלך אינו מאומת" היה מוצג לו **תמיד** — הוראה לפעולה
//   בלתי אפשרית. הוא מוסתר שם מפורשות כשיש phone_number.
eq("ולטוקן של נהג אין email", claims.email, undefined);
eq("ואין email_verified", claims.email_verified, undefined);
// ⬅ וממילא: טוקן כזה **אינו** יכול לעבור את emailIsAllowed של האדמינים.
ok("כלומר טוקן נהג אינו יכול להיכנס למסלול האדמין", !claims.email && !claims.email_verified);

console.log("— 5. קוד שגוי נדחה, ועם קוד שגיאה שאפשר למפות להודעה");
{
  const { sessionInfo: s2 } = await post("accounts:sendVerificationCode", {
    phoneNumber: PHONE,
    recaptchaToken: "ignored-by-emulator",
  });
  let message = null;
  try {
    await post("accounts:signInWithPhoneNumber", { sessionInfo: s2, code: "000000" });
  } catch (e) {
    message = e.apiMessage || e.message;
  }
  ok("קוד שגוי נדחה", Boolean(message));
  // INVALID_CODE הוא מה שה-SDK ממפה ל-auth/invalid-verification-code, שזה
  // המפתח auth.phone.err.code ב-hooks/useAuth.js:PHONE_ERRORS.
  ok(`קוד השגיאה ניתן למיפוי (${message})`, /INVALID_CODE|SESSION_EXPIRED/.test(message || ""));
}

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות זרימת הכניסה בנייד עברו (אמולטור Auth אמיתי)`);
