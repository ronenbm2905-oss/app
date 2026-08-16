// ============================================================================
// smoke.mjs — אסרשנים על הלוגיקה הטהורה, בלי דפדפן ובלי ענן.
//
// ⚠️ smoke **אינו** מחליף את האמולטור. הוא בודק את מדיניות השמירה, בניית
//    הליד והנרמול; ה-rules נבדקים רק בהרצה (`npm run emu:rules`). 602
//    אסרשנים סטטיים ב-fleet לא תפסו באג שהרצה אחת תפסה — הלקח נשמר.
// ============================================================================

import {
  LEAD_CREATE_FIELDS,
  LEAD_REQUIRED_FIELDS,
  LEAD_SERVER_FIELDS,
  LEAD_SOURCE_FIELDS,
  FORBIDDEN_FIELDS,
  LEAD_STATUS,
  RETENTION_CLASS,
  RETENTION_DAYS,
  LEAD_PII_FIELDS,
} from "../src/constants.js";
import {
  buildLead,
  buildSource,
  validateLead,
  normalizePhone,
  normalizeName,
  sanitizeLead,
  forbiddenFieldsIn,
  leadShapeIsValid,
} from "../src/utils/lead.js";
import {
  retentionClassFor,
  purgeAfterMillis,
  daysUntilPurge,
  isDueForPurge,
  purgedShape,
  purgeLeftovers,
} from "../src/utils/retention.js";

let pass = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}${detail === undefined ? "" : `\n      got: ${JSON.stringify(detail)}`}`);
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), a);
const section = (t) => console.log(`\n— ${t}`);

const DAY = 864e5;

// ============================================================================
section("1. הסכימה — allowlist מול רשימת האיסור");
// ============================================================================
eq("שדות היצירה — אחרי M4 (הדיוור ירד) ועם policyVersion עליון", LEAD_CREATE_FIELDS, [
  "firstName",
  "phone",
  "email",
  "screened",
  "source",
  "policyVersion",
  "createdAt",
]);

// 🔴 M4 — ההסכמה לדיוור ירדה לגמרי. הרשימה הזאת קיימת כדי שהחזרתה תדרוש
//    מעבר דרך עדי (S14(1)) ולא עריכה של שורה אחת.
for (const f of ["marketingOptIn", "marketingConsent", "newsletter", "smsOptIn", "optInAt"]) {
  ok(`"${f}" אסור מבנית`, FORBIDDEN_FIELDS.includes(f));
  ok(`"${f}" אינו בשדות היצירה`, !LEAD_CREATE_FIELDS.includes(f));
}
eq("שדות חובה", LEAD_REQUIRED_FIELDS, ["firstName", "phone", "policyVersion", "createdAt"]);

// 🔴 ראיית ההסכמה אינה יושבת בתוך הייחוס השיווקי: ג'וב שינקה ייחוס אחרי N
//    חודשים היה מוחק אותה בשקט יחד איתו. מחזורי חיים שונים = שדות שונים.
ok("policyVersion הוא שדה עליון", LEAD_CREATE_FIELDS.includes("policyVersion"));
ok("policyVersion אינו בתוך source", !LEAD_SOURCE_FIELDS.includes("policyVersion"));
eq("source הוא ייחוס שיווקי בלבד — ארבעה שדות", LEAD_SOURCE_FIELDS, [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
]);

const overlap = LEAD_CREATE_FIELDS.filter((f) => FORBIDDEN_FIELDS.includes(f));
eq("אין חפיפה בין ה-allowlist לרשימת האסורים", overlap, []);
const serverOverlap = LEAD_SERVER_FIELDS.filter((f) => LEAD_CREATE_FIELDS.includes(f));
eq("שדות השרת אינם ניתנים לכתיבה ביצירה", serverOverlap, []);

ok("ת.ז. ברשימת האסורים", FORBIDDEN_FIELDS.includes("idNumber"));
ok("סכומים ברשימת האסורים", FORBIDDEN_FIELDS.includes("refundAmount"));
ok("שדה טקסט חופשי ברשימת האסורים", FORBIDDEN_FIELDS.includes("notes"));
ok("שם משפחה ברשימת האסורים", FORBIDDEN_FIELDS.includes("lastName"));
// 🔴 הליבה של S3: ארבע התשובות כערכים נפרדים = תיק מס מזערי.
for (const f of ["soldProperty", "within6y", "employmentStatus", "taxWasPaid", "checkerAnswers"]) {
  ok(`תשובת בודק "${f}" אסורה`, FORBIDDEN_FIELDS.includes(f));
}
ok("`screened` הוא הבוליאני היחיד שכן מותר", LEAD_CREATE_FIELDS.includes("screened"));

// 🔴 הדפוס, לא רק המופע: טקסט/מזהה שמקורו במשתמש או בפלטפורמה, שנכנס דרך
//    שכבת האנליטיקס ועוקף את S3 בדלת צדדית — בלי ששום שדה טופס נפתח.
for (const f of [
  "utmTerm",
  "utm_term",
  "referrer",
  "documentReferrer",
  "landingUrl",
  "pageUrl",
  "queryString",
  "gclid",
  "fbclid",
  "msclkid",
  "wbraid",
]) {
  ok(`"${f}" אסור מבנית`, FORBIDDEN_FIELDS.includes(f));
  ok(`"${f}" אינו ב-source`, !LEAD_SOURCE_FIELDS.includes(f));
}

// ============================================================================
section("2. buildLead — מה יוצא בפועל");
// ============================================================================
const built = buildLead(
  {
    firstName: "  דנה   כהן ",
    phone: "052-123-4567",
    email: " dana@example.com ",
    marketingOptIn: true, // 🔴 M4 — מוזרק בכוונה. חייב ליפול.
    screened: true,
  },
  { source: { utm_source: "google", utm_medium: "cpc" }, policyVersion: "1.0-draft" }
);

eq("רווחים כפולים בשם מנורמלים", built.firstName, "דנה כהן");
eq("טלפון עם מקפים מנורמל", built.phone, "0521234567");
eq("אימייל מנורמל", built.email, "dana@example.com");
eq("אין שדות אסורים בפלט", forbiddenFieldsIn(built), []);
ok("🔴 M4 — marketingOptIn נופל גם אם הטופס שולח אותו", !("marketingOptIn" in built), built);
ok("צורת המסמך תקינה", leadShapeIsValid(built).ok, leadShapeIsValid(built));
ok("`createdAt` אינו נקבע בקליינט — הוא זמן השרת", !("createdAt" in built));

eq("+972 מנורמל ל-0", normalizePhone("+972521234567"), "0521234567");
eq("972 בלי + מנורמל", normalizePhone("972521234567"), "0521234567");
eq("רווחים בטלפון מנורמלים", normalizePhone(" 052 123 4567 "), "0521234567");
eq("שם ריק", normalizeName("   "), "");

// הזרקה: כל השדות האסורים בקלט — אף אחד לא שורד.
const injected = buildLead({
  firstName: "יוסי",
  phone: "0501112222",
  ...Object.fromEntries(FORBIDDEN_FIELDS.map((f) => [f, "X"])),
});
eq("🔴 כל FORBIDDEN_FIELDS מסוננים ע\"י buildLead", forbiddenFieldsIn(injected), []);
eq(
  "🔴 המסמך שנבנה מכיל רק מפתחות מותרים",
  Object.keys(injected).filter((k) => !LEAD_CREATE_FIELDS.includes(k)),
  []
);

eq(
  "sanitizeLead משליך מפתח לא מוכר",
  Object.keys(sanitizeLead({ firstName: "א", phone: "0521234567", idNumber: "1" })),
  ["firstName", "phone"]
);

// -- source: ייחוס שיווקי בלבד --
const src = buildSource({
  utm_source: "g",
  utm_content: "v2",
  // כל אלה חייבים ליפול בשקט:
  utm_term: "מכרתי דירה ושילמתי מס",
  gclid: "Cj0KCQ…",
  fbclid: "IwAR…",
  referrer: "https://www.google.com/search?q=החזר+מס+שבח",
  landingUrl: "https://x.co.il/?q=…",
});
eq("utm_source עובר", src.utmSource, "g");
eq("utm_content עובר", src.utmContent, "v2");
eq("🔴 source מכיל רק את המותרים", Object.keys(src).sort(), ["utmContent", "utmSource"]);
for (const bad of ["utmTerm", "utm_term", "gclid", "fbclid", "referrer", "landingUrl"]) {
  ok(`🔴 "${bad}" נופל בשקט מ-buildSource`, !(bad in src), src);
}
ok("ערך ארוך נחתך ל-64", buildSource({ utm_campaign: "c".repeat(200) }).utmCampaign.length === 64);

// policyVersion — שדה עליון על המסמך, לא בתוך source
eq("policyVersion על המסמך", built.policyVersion, "1.0-draft");
ok("policyVersion לא בתוך source", !("policyVersion" in built.source), built.source);

// ============================================================================
section("3. ולידציה");
// ============================================================================
eq("ליד תקין — אין שגיאות", validateLead({ firstName: "דנה", phone: "0521234567" }), {});
ok("שם ריק נתפס", validateLead({ firstName: "", phone: "0521234567" }).firstName);
ok("שם בן תו אחד נתפס", validateLead({ firstName: "א", phone: "0521234567" }).firstName);
ok("שם ארוך מדי נתפס", validateLead({ firstName: "א".repeat(41), phone: "0521234567" }).firstName);
// 🔴 החיזוק מעבר למפרט: אין ספרות בשם ⇒ אי אפשר להסתיר ת.ז. בשדה החופשי היחיד.
ok(
  "🔴 שם עם ת.ז. מוסתרת נתפס",
  validateLead({ firstName: "יוסי 123456789", phone: "0521234567" }).firstName
);
ok("שם עם סכום נתפס", validateLead({ firstName: "דנה 265000", phone: "0521234567" }).firstName);
// ============================================================================
// 🔴 רגרסיה — הבאג שנתפס בסבב השני.
//
// הגרסה הראשונה של הבדיקה הייתה **allowlist תווים** (עברית + לטינית), והיא
// דחתה `محمد`, `سارة` ו-`Дмитрий`. זה חוסם בשקט חלק ניכר מהאוכלוסייה
// בישראל — כל אחד מהם ליד אבוד בקמפיין ממומן, וגם הפליה בתוצאה.
// ה-denylist משיג את אותה מטרה (אי אפשר להסתיר ת.ז. בלי ספרות) בלי להניח
// הנחות על האלפבית של אף אחד. הרשימה הזאת נשארת כדי שזה לא יחזור.
// ============================================================================
for (const name of [
  "בת-אל",
  "Daniel",
  "ג'ו",
  "محمد",
  "سارة",
  "Дмитрий",
  "Zoë",
  "José",
  "אבו-חמד",
  "Jean-Luc",
]) {
  ok(`שם לגיטימי עובר: ${name}`, !validateLead({ firstName: name, phone: "0521234567" }).firstName);
}
// ספרות בכל אלפבית נדחות — אחרת ת.ז. נכתבת בספרות ערביות ועוברת.
ok("ספרות ערביות-הודיות נדחות", validateLead({ firstName: "محمد ١٢٣٤٥٦٧٨٩", phone: "0521234567" }).firstName);
// שורה חדשה מנורמלת לרווח ע"י normalizeName, ולכן לא מגיעה לחוט בכלל.
// (ה-rules בכל זאת דוחות אותה — נגד POST ישיר שעוקף את הקליינט.
//  האסרשן על כך יושב ב-rules-tests.mjs.)
eq("שורה חדשה בשם מנורמלת לרווח", normalizeName("דנה\nכהן"), "דנה כהן");
ok("טלפון קווי עובר", !validateLead({ firstName: "דנה", phone: "036543210" }).phone);
ok("טלפון קצר נתפס", validateLead({ firstName: "דנה", phone: "052123" }).phone);
ok("טלפון שמתחיל ב-01 נתפס", validateLead({ firstName: "דנה", phone: "0112345678" }).phone);
ok(
  "אימייל ריק תקין — הוא אופציונלי (S3)",
  !validateLead({ firstName: "דנה", phone: "0521234567", email: "" }).email
);
ok(
  "אימייל פסול נתפס",
  validateLead({ firstName: "דנה", phone: "0521234567", email: "a@b" }).email
);

// ============================================================================
section("4. מדיניות השמירה (S8) — המדרג כקוד");
// ============================================================================
eq("6 חודשים ללא מענה", RETENTION_DAYS[RETENTION_CLASS.UNANSWERED], 183);
eq("12 חודשים לאחר מגע", RETENTION_DAYS[RETENTION_CLASS.CONTACTED], 365);
eq("מחיקה מיידית", RETENTION_DAYS[RETENTION_CLASS.IMMEDIATE], 0);

eq("ליד חדש → לא נענה", retentionClassFor({ status: LEAD_STATUS.NEW }), RETENTION_CLASS.UNANSWERED);
eq("ניסיון ללא מענה → לא נענה", retentionClassFor({ status: LEAD_STATUS.ATTEMPTED }), RETENTION_CLASS.UNANSWERED);
eq("נוצר קשר → 12 חודשים", retentionClassFor({ status: LEAD_STATUS.CONTACTED }), RETENTION_CLASS.CONTACTED);
eq("סירב → מיידי", retentionClassFor({ status: LEAD_STATUS.REFUSED }), RETENTION_CLASS.IMMEDIATE);
eq("הומר → מיידי (יוצא מ-leads)", retentionClassFor({ status: LEAD_STATUS.CONVERTED }), RETENTION_CLASS.IMMEDIATE);
eq("ליד בלי סטטוס → ברירת מחדל מחמירה", retentionClassFor({}), RETENTION_CLASS.UNANSWERED);

const now = Date.UTC(2026, 7, 15);
const createdOld = now - 200 * DAY;

eq(
  "ליד ללא מענה בן 200 יום — חורג",
  isDueForPurge({ status: LEAD_STATUS.NEW, createdAt: createdOld }, now),
  true
);
eq(
  "ליד ללא מענה בן 100 יום — עדיין בתוקף",
  isDueForPurge({ status: LEAD_STATUS.NEW, createdAt: now - 100 * DAY }, now),
  false
);
eq(
  "ליד שנוצר איתו קשר לפני 200 יום — עדיין בתוקף (12 חודשים)",
  isDueForPurge(
    { status: LEAD_STATUS.CONTACTED, createdAt: createdOld, lastContactAt: now - 200 * DAY },
    now
  ),
  false
);
eq(
  "ליד שנוצר איתו קשר לפני 400 יום — חורג",
  isDueForPurge(
    { status: LEAD_STATUS.CONTACTED, createdAt: createdOld, lastContactAt: now - 400 * DAY },
    now
  ),
  true
);
eq(
  "סירוב — חורג מיידית",
  isDueForPurge({ status: LEAD_STATUS.REFUSED, createdAt: now }, now),
  true
);
eq(
  "ליד שכבר נמחק לא נסרק שוב",
  isDueForPurge({ status: LEAD_STATUS.NEW, createdAt: createdOld, purgedAt: now }, now),
  false
);

// 🔴 האסרשן שמגן על ההבחנה בעוגן. אילו "לא נענה" היה נמדד מהמגע האחרון,
//    כל שיחה נכשלת הייתה **מאריכה** את חיי הליד — כלומר מי שלא עונה נשמר
//    הכי הרבה זמן. זה בדיוק ההפך מהכוונה של S8.
const attempted = {
  status: LEAD_STATUS.ATTEMPTED,
  createdAt: now - 190 * DAY,
  lastContactAt: now - 1 * DAY,
  contactAttempts: 3,
};
eq("🔴 ניסיונות ללא מענה לא מאריכים את השעון", isDueForPurge(attempted, now), true);

eq("ימים שנותרו — ליד בן יום, ללא מענה", daysUntilPurge({ status: "new", createdAt: now - DAY }, now), 182);
eq("ימים שנותרו — null בלי createdAt", daysUntilPurge({ status: "new" }, now), null);
ok("purgeAfter מחושב", purgeAfterMillis({ status: "new", createdAt: now }) === now + 183 * DAY);

// ============================================================================
section("5. המחיקה עצמה — לא נשאר PII");
// ============================================================================
const full = {
  id: "x",
  firstName: "דנה",
  phone: "0521234567",
  email: "d@e.com",
  screened: true,
  status: LEAD_STATUS.REFUSED,
  createdAt: now,
};
const purged = purgedShape(full);
eq("🔴 אחרי מחיקה לא נשאר אף שדה מזהה", purgeLeftovers(purged), []);
for (const f of LEAD_PII_FIELDS) ok(`${f} נמחק`, !(f in purged));
ok("השלד נשאר לצורך ספירה", purged.status === LEAD_STATUS.REFUSED && purged.createdAt === now);
ok("`screened` נשאר — הוא אינו מזהה איש", purged.screened === true);

// ============================================================================
console.log(`\n${"=".repeat(62)}`);
console.log(`עברו: ${pass}   נכשלו: ${failed}`);
if (failed) {
  console.error("\n🔴 נכשלו:");
  for (const f of failures) console.error("   · " + f);
  process.exit(1);
}
console.log("✅ smoke עבר.");
