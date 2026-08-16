// ============================================================================
// intake-wire-tests.mjs — בודק את **הקובץ שעומר באמת טוען**, על החוט.
//
// למה זה קיים בנוסף ל-rules-tests.mjs:
//
//   rules-tests משתמש ב-SDK של Firebase כדי לאמת את הכללים. אבל
//   `lead-intake.js` **אינו** משתמש ב-SDK — הוא מדבר Firestore REST ידנית
//   (קידוד ערכים, `updateTransforms` ל-serverTimestamp, `currentDocument`).
//   כלומר: rules-tests מאמת את הכללים, ולא מאמת שהפורמט שהקובץ שלנו שולח
//   בכלל מתקבל. פער בין השניים = טופס שנראה תקין ולא כותב כלום בפרודקשן.
//
//   הבדיקה הזאת מייבאת את `submitLead` **מהמודול האמיתי**, מפנה אותו
//   לאמולטור, ומריצה דרכו את אותם מקרים. אם קידוד ה-REST שגוי — זה נופל כאן.
//
// רץ בתוך `npm run emu:intake`. אין כאן App Check (אין לו אמולטור), ולכן
// `requireAppCheck: false` — הנתיב הזה מאומת בנפרד ב-`selfTest()` מול
// פרויקט אמיתי. מסומן ככזה בדיווח, לא מוצג כאילו נבדק.
// ============================================================================

import { init, submitLead } from "../intake/lead-intake.js";

const HOST = "http://127.0.0.1:8080/v1";
const PROJECT = "mas-shevach-emulator";

init({
  projectId: PROJECT,
  apiKey: "emulator-fake-key",
  appId: "1:123456789:web:abcdef",
  firestoreHost: HOST,
  requireAppCheck: false, // אין אמולטור ל-App Check
  policyVersion: "1.0-draft",
});

let pass = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}${detail === undefined ? "" : `\n      ${JSON.stringify(detail)}`}`);
  }
}
const section = (t) => console.log(`\n— ${t}`);

// קריאה ישירה ל-REST של האמולטור, בעקיפת ה-rules, כדי לאמת מה **באמת** נכתב.
async function readDoc(id) {
  const res = await fetch(
    `${HOST}/projects/${PROJECT}/databases/(default)/documents/leads/${id}`,
    { headers: { Authorization: "Bearer owner" } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ============================================================================
section("1. הזרימה המאושרת — הקובץ של עומר כותב ליד דרך ה-rules האמיתיים");
// ============================================================================

const r1 = await submitLead(
  {
    firstName: "דנה",
    phone: "052-123-4567", // עם מקפים — הקליינט אמור לנרמל
    email: "dana@example.com",
    marketingOptIn: true, // 🔴 M4 — מוזרק בכוונה. חייב ליפול לפני השליחה.
    screened: true,
  },
  {
    source: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "shevach-aug",
      // כל אלה מוזרקים בכוונה וחייבים ליפול בשקט לפני השליחה:
      utm_term: "מכרתי דירה ושילמתי 240 אלף מס",
      gclid: "Cj0KCQjw",
      fbclid: "IwAR0x",
      referrer: "https://www.google.com/search?q=החזר+מס+שבח",
      landingUrl: "https://x.co.il/?q=...",
    },
  }
);
ok("ליד תקין נכתב בהצלחה דרך REST", r1.ok, r1);

if (r1.ok) {
  const stored = await readDoc(r1.id);
  const f = stored?.fields || {};
  ok("הטלפון נורמל ל-0521234567", f.phone?.stringValue === "0521234567", f.phone);
  ok("createdAt נכתב כזמן שרת", Boolean(f.createdAt?.timestampValue), f.createdAt);
  // 🔴 M4 — הטופס שלח `marketingOptIn: true`, והוא **לא הגיע למאגר**.
  //    זה בדיוק התרחיש שיקרה אם עותק ישן של הדף יישאר בשטח.
  ok("🔴 M4 — marketingOptIn לא הגיע למאגר", !("marketingOptIn" in f), Object.keys(f));
  ok("screened נשמר כבוליאני יחיד", f.screened?.booleanValue === true, f.screened);

  // 🔴 ראיית ההסכמה יושבת ברמה העליונה, לא בתוך הייחוס השיווקי: ג'וב
  //    שינקה ייחוס אחרי N חודשים היה מוחק אותה בשקט יחד איתו.
  ok("policyVersion נשמר כשדה עליון", f.policyVersion?.stringValue === "1.0-draft", f.policyVersion);

  const src = f.source?.mapValue?.fields || {};
  ok("utmSource נשמר", src.utmSource?.stringValue === "google", src);
  ok("policyVersion אינו בתוך source", !("policyVersion" in src), Object.keys(src));

  // 🔴 הדפוס: טקסט/מזהה מהמשתמש או מהפלטפורמה שנכנס דרך שכבת האנליטיקס.
  ok(
    "🔴 source מכיל רק את ארבעת ה-utm שאנחנו קובעים",
    JSON.stringify(Object.keys(src).sort()) ===
      JSON.stringify(["utmCampaign", "utmMedium", "utmSource"]),
    Object.keys(src)
  );
  for (const bad of ["utmTerm", "utm_term", "gclid", "fbclid", "referrer", "landingUrl"]) {
    ok(`🔴 "${bad}" לא הגיע למאגר`, !(bad in src), Object.keys(src));
  }

  // 🔴 הליבה: המסמך שנכתב מכיל **בדיוק** את השדות המותרים.
  const keys = Object.keys(f).sort();
  ok(
    "🔴 המסמך מכיל בדיוק את שדות ה-allowlist ותו לא",
    JSON.stringify(keys) ===
      JSON.stringify([
        "createdAt",
        "email",
        "firstName",
        "phone",
        "policyVersion",
        "screened",
        "source",
      ]),
    keys
  );
}

// ============================================================================
section("2. סינון בקליינט — שדות אסורים לא מגיעים לחוט בכלל");
// ============================================================================

const r2 = await submitLead({
  firstName: "יוסי",
  phone: "0501112222",
  // כל אלה מוזרקים בכוונה. `buildLead` אמור להשליך אותם לפני השליחה.
  idNumber: "123456789",
  refundAmount: 265000,
  notes: "מכרתי דירה ושילמתי 240 אלף",
  lastName: "כהן",
  soldProperty: true,
  employmentStatus: "salaried",
});
ok("ליד עם שדות אסורים בקלט — נכתב, אחרי סינון", r2.ok, r2);

if (r2.ok) {
  const stored = await readDoc(r2.id);
  const keys = Object.keys(stored?.fields || {});
  ok("🔴 `idNumber` לא הגיע למאגר", !keys.includes("idNumber"), keys);
  ok("🔴 `refundAmount` לא הגיע למאגר", !keys.includes("refundAmount"), keys);
  ok("🔴 `notes` לא הגיע למאגר", !keys.includes("notes"), keys);
  ok("🔴 `lastName` לא הגיע למאגר", !keys.includes("lastName"), keys);
  ok("🔴 תשובות הבודק לא הגיעו למאגר", !keys.includes("soldProperty"), keys);
}

// ============================================================================
section("3. ה-rules עוצרים גם כשהקליינט נעקף — payload עוין ישירות ב-REST");
// ============================================================================
// זה התרחיש האמיתי: תוקף לא משתמש בקובץ שלנו, הוא שולח POST משלו.

async function rawCommit(fields, { withTransform = true } = {}) {
  const id = "hostile_" + Math.random().toString(36).slice(2, 10);
  const body = {
    writes: [
      {
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/leads/${id}`,
          fields,
        },
        ...(withTransform
          ? { updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }] }
          : {}),
        currentDocument: { exists: false },
      },
    ],
  };
  const res = await fetch(`${HOST}/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

const baseFields = {
  firstName: { stringValue: "תוקף" },
  phone: { stringValue: "0521112222" },
  screened: { booleanValue: true },
  source: { mapValue: { fields: { utmSource: { stringValue: "google" } } } },
  policyVersion: { stringValue: "1.0-draft" },
};

const s1 = await rawCommit({ ...baseFields });
ok("POST ישיר תקין מתקבל (הבדיקה עצמה שפויה)", s1 === 200, s1);

const s2 = await rawCommit({ ...baseFields, idNumber: { stringValue: "123456789" } });
ok("🔴 POST ישיר עם `idNumber` נדחה ע\"י ה-rules", s2 === 403, s2);

const s3 = await rawCommit({ ...baseFields, notes: { stringValue: "טקסט חופשי" } });
ok("🔴 POST ישיר עם שדה טקסט חופשי נדחה", s3 === 403, s3);

const s4 = await rawCommit(
  { ...baseFields, createdAt: { timestampValue: "2020-01-01T00:00:00Z" } },
  { withTransform: false }
);
ok("🔴 POST ישיר עם createdAt שנשלט ע\"י הקליינט נדחה", s4 === 403, s4);

const s5 = await rawCommit({ ...baseFields, firstName: { stringValue: "יוסי ת.ז 123456789" } });
ok("🔴 POST ישיר עם ת.ז. מוסתרת בתוך השם נדחה", s5 === 403, s5);

const s6 = await rawCommit({
  ...baseFields,
  source: { mapValue: { fields: { gclid: { stringValue: "Cj0KCQjw" } } } },
});
ok("🔴 POST ישיר עם `gclid` ב-source נדחה", s6 === 403, s6);

const s7 = await rawCommit({ ...baseFields, policyVersion: undefined });
ok("🔴 POST ישיר בלי `policyVersion` נדחה", s7 === 403, s7);

// ============================================================================
section("4. ולידציה בקליינט — הודעות שגיאה, בלי בקשת רשת");
// ============================================================================

const bad1 = await submitLead({ firstName: "", phone: "0521234567" });
ok("שם ריק נעצר בקליינט", !bad1.ok && bad1.errors?.firstName, bad1);

const bad2 = await submitLead({ firstName: "דנה", phone: "123" });
ok("טלפון לא תקין נעצר בקליינט", !bad2.ok && bad2.errors?.phone, bad2);

const bad3 = await submitLead({ firstName: "דנה 123456789", phone: "0521234567" });
ok("שם עם ספרות נעצר בקליינט עם הסבר", !bad3.ok && bad3.errors?.firstName, bad3);

const bad4 = await submitLead({ firstName: "דנה", phone: "0521234567", email: "nope" });
ok("אימייל לא תקין נעצר בקליינט", !bad4.ok && bad4.errors?.email, bad4);

// אימייל ריק הוא מצב תקין — הוא מושמט, לא נשלח כמחרוזת ריקה.
const r5 = await submitLead({ firstName: "מירי", phone: "0533334444", email: "   " });
ok("אימייל ריק — הליד עובר, השדה מושמט", r5.ok, r5);
if (r5.ok) {
  const stored = await readDoc(r5.id);
  ok(
    "אימייל ריק לא נשלח כמחרוזת ריקה",
    !Object.keys(stored?.fields || {}).includes("email"),
    Object.keys(stored?.fields || {})
  );
}

// ============================================================================
section("5. M4 — אין הסכמת דיוור במערכת");
// ============================================================================
const r6 = await submitLead({ firstName: "אבי", phone: "0544445555" });
ok("ליד תקין בלי שום שדה דיוור נשלח בהצלחה", r6.ok, r6);

// ה-rules דוחות את השדה גם כשהוא מגיע ישירות, בעקיפת הקליינט.
const s8 = await rawCommit({ ...baseFields, marketingOptIn: { booleanValue: true } });
ok("🔴 M4 — POST ישיר עם `marketingOptIn` נדחה ע\"י ה-rules", s8 === 403, s8);

// ============================================================================
console.log(`\n${"=".repeat(62)}`);
console.log(`עברו: ${pass}   נכשלו: ${failed}`);
if (failed) {
  console.error("\n🔴 נכשלו:");
  for (const f of failures) console.error("   · " + f);
  process.exit(1);
}
console.log("✅ lead-intake.js מאומת מקצה לקצה מול ה-rules האמיתיים.");
