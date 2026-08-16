// ============================================================================
// render-check.mjs — מרנדר את **כל המסכים** באמת (React server render) ובודק
// שמה שיוצא הוא מה שהמפרט אומר.
//
// זה תופס את מה ש-smoke לא תופס: JSX שבור, prop חסר, **מפתח תרגום שלא קיים
// ומודפס כמפתח**, מחלקה אסורה שנכנסה דרך רכיב, וטקסט שלא הגיע למסך.
//
// ⚠️ **הוא אינו תחליף ל-QA בדפדפן.** אין כאן effects, אין לחיצות, אין
// קונסול ואין רשת. הוא הרצפה — לא התקרה. מה שלא נבדק כאן מדווח ככזה.
//
//   npm run render:check
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, ".render-tmp");

const ENTRY = `
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import App from "../src/App.jsx";
import { I18nProvider } from "../src/hooks/useI18n.jsx";

export function render(lang) {
  return renderToStaticMarkup(
    createElement(I18nProvider, { initialLang: lang }, createElement(App))
  );
}
`;

mkdirSync(TMP, { recursive: true });
writeFileSync(join(TMP, "entry.jsx"), ENTRY);

await build({
  entryPoints: [join(TMP, "entry.jsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(TMP, "entry.mjs"),
  external: ["react", "react-dom", "react-dom/server", "firebase/*"],
  // mainFields/conditions — כדי ש-lucide-react ייפתר לגרסת ה-ESM שלו ולא
  // ל-CJS שקורא require("react") בתוך חבילת ESM.
  mainFields: ["module", "main"],
  conditions: ["import", "module", "default"],
  // Vite פותר נכסים דרך הפלאגין שלו; ל-esbuild צריך loader מפורש.
  loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" },
  jsx: "automatic",
  logLevel: "error",
});

// ---------------------------------------------------------------------------
let pass = 0;
let failed = 0;
const failures = [];
function ok(name, cond) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
}

const TODAY = new Date().toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ============================================================================
// משק בית מאוכלס: רכב אחד, משימת ביטוח חובה **באיחור** (כדי לבדוק את
// הכרטיס הרגיש ביותר), מסמך shared אחד, ופוליסה בדומיין owner שחייבת
// להישאר מחוץ למסך החירום.
// ============================================================================
const SEED = {
  schemaVersion: 1,
  household: { id: "local", name: "", createdAt: null, members: { "local-owner": "owner" } },
  settings: {
    onboarded: true,
    policyVersion: "0.1-draft",
    leadDays: 30,
    emergencyAuth: "session",
    emergencyOffline: "text",
    language: "he",
    textSize: "default",
  },
  profile: {
    uid: "local-owner",
    displayName: "רונן",
    phone: "0500000000",
    email: "x@y.z",
    notices: [{ policyVersion: "0.1-draft", acknowledgedAt: `${TODAY}T00:00:00Z`, method: "inApp" }],
    serviceChannels: { push: true, sms: false, email: false },
    marketingConsent: null,
  },
  vehicles: [
    {
      id: "v1",
      householdId: "local",
      plate: "1234567",
      nickname: "האוטו של אמא",
      manufacturer: "מאזדה",
      commercialName: "3",
      year: 2019,
      color: "לבן",
      status: "active",
      insurerName: "הראל",
      policyNumber: "123456789",
      insurerEmergencyPhone: "037777777",
      testValidUntil: addDays(200),
      compulsoryInsuranceUntil: addDays(-4),
      garage: { name: "המוסך", phone: "" },
      motSource: { resourceId: "053cea08", fetchedAt: `${TODAY}T00:00:00Z`, found: true },
      photoRef: null,
      photoData: null,
      photoStorageMode: "none",
    },
  ],
  vehiclesPrivate: [],
  drivers: [],
  vehicleAccess: [],
  tasks: [
    {
      id: "t-ins",
      householdId: "local",
      vehicleId: "v1",
      type: "insurance",
      coverage: "compulsory",
      dueDate: addDays(-4),
      tag: "insurance",
      important: false,
      manualStatus: null,
      completedAt: null,
      renewalRule: { basis: "dueDate", months: 12, km: null },
      schedule: { leadDays: 30, ladder: [30, 14, 7, 3, 1, 0], nextFireAt: TODAY, lastFiredStep: null, lastFiredAt: null, channelsTried: [], deliveryState: "pending", acknowledgedAt: null, acknowledgedStep: null, escalateToOwner: true, snoozedUntil: null, muted: false },
    },
  ],
  documents: [
    { id: "d-lic", householdId: "local", vehicleId: "v1", type: "vehicleLicence", visibility: "shared", storageDomain: "shared", validUntil: addDays(200), fileRef: null, localData: "data:image/png;base64,AAA", storageMode: "local", sensitivity: "containsIdNumber" },
    { id: "d-policy", householdId: "local", vehicleId: "v1", type: "comprehensive", visibility: "owner", storageDomain: "owner", validUntil: null, fileRef: null, localData: "data:image/png;base64,BBB", storageMode: "local", sensitivity: "containsIdNumber" },
  ],
  personalDocs: [],
  serviceRecords: [],
  odometerReadings: [],
};

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

async function renderRoute(hash, { storage = makeStorage({ nrcar_data: JSON.stringify(SEED) }), lang = "he" } = {}) {
  globalThis.localStorage = storage;
  // הראוטר קורא את ה-hash ב-initializer של useState — לכן חייבים לקבוע אותו
  // **לפני** הייבוא הדינמי.
  globalThis.window = { location: { hash }, history: { length: 1 }, addEventListener() {}, removeEventListener() {} };
  const mod = await import(`${pathToFileURL(join(TMP, "entry.mjs")).href}?v=${Math.random()}`);
  return mod.render(lang);
}

const all = [];
function record(html) {
  all.push(html);
  return html;
}

// ============================================================================
console.log("— אונבורדינג + תרגול החירום");
const onboarding = record(await renderRoute("#/", { storage: makeStorage() }));
ok("נטען בלי לזרוק", onboarding.length > 200);
ok("הכותרת של שירה", onboarding.includes("מעכשיו אנחנו זוכרים במקומך"));
ok("★ כפתור אחד בלבד", (onboarding.match(/<button/g) || []).length === 1);
ok("בגובה פעולה ראשית", onboarding.includes("min-h-14"));
ok("אין 'דלג'", !onboarding.includes("דלג"));

console.log("— דשבורד (משימה באיחור)");
const dash = record(await renderRoute("#/"));
ok("כרטיס-גיבור מוצג", dash.includes("הכי דחוף עכשיו"));
ok("aria-live על אזור הגיבור", dash.includes('aria-live="polite"'));
ok("משפט המנוע עם הכינוי", dash.includes("של האוטו של אמא"));
ok("★ ולא עם מספר רישוי", !dash.includes("הטסט של 12-345-67"));
ok("★ הכלל מיוחס לחוק", dash.includes("החוק אוסר לנהוג ברכב שאין לו ביטוח חובה בתוקף"));
ok("★ ושורת ייחוס-העובדה מופיעה לצדו", dash.includes("כדאי לוודא מול חברת הביטוח"));
ok("★ ופעולת התיקון בלחיצה אחת", dash.includes("כבר חידשתי"));
ok("גלולת הסטטוס — מילה, לא רק צבע", dash.includes("באיחור"));
ok("כרטיס רכב עם הכינוי", dash.includes("האוטו של אמא"));
ok("★ בלי מונה משימות פתוחות", !/\d+\s*משימות פתוחות/.test(dash));
ok("כפתור הוספת רכב ברוחב מלא (לא FAB)", dash.includes("הוספת רכב") && dash.includes("w-full"));

console.log("— רכבים");
const vehicles = record(await renderRoute("#/vehicles"));
ok("כותרת המסך", vehicles.includes("הרכבים שלי"));
ok("הרכב מוצג", vehicles.includes("האוטו של אמא"));
ok("לוחית בתוך .num", /class="[^"]*num[^"]*"[^>]*>12-345-67/.test(vehicles));

console.log("— הוספת רכב: הטופס הידני תמיד גלוי");
const addVehicle = record(await renderRoute("#/vehicles/new"));
ok("שדה מספר הרישוי", addVehicle.includes("מספר רישוי"));
ok("כפתור החיפוש", addVehicle.includes("חיפוש הרכב"));
ok("★ הטופס הידני גלוי בלי שום לחיצה", addVehicle.includes("פרטי הרכב"));
ok("★ ובו שדה תוקף הטסט", addVehicle.includes("תוקף הטסט"));
ok("★ ושדה ביטוח חובה", addVehicle.includes("ביטוח חובה בתוקף עד"));
ok("★ וכפתור שמירה — כלומר אפשר לסיים בלי רשת", addVehicle.includes("שמירת הרכב"));
ok("הקישור להזנה ידנית קיים", addVehicle.includes("אני מעדיף להזין את הפרטים ידנית"));
ok("גילוי נאות על המאגר", addVehicle.includes("לא מאמת בעלות"));

console.log("— דף רכב: שלוש תתי-לשוניות");
const vehicle = record(await renderRoute("#/vehicle/v1"));
ok('★ role="tablist" קיים', vehicle.includes('role="tablist"'));
ok('★ ו-role="tab"', vehicle.includes('role="tab"'));
ok("★ aria-selected", vehicle.includes("aria-selected"));
ok("★ aria-controls", vehicle.includes("aria-controls"));
ok('★ ו-role="tabpanel" לתוכן', vehicle.includes('role="tabpanel"'));
for (const label of ["משימות", "מסמכים", "פרטים"]) {
  ok(`הלשונית "${label}"`, vehicle.includes(`>${label}</button>`));
}
ok("המשימה מוצגת בלשונית הראשונה", vehicle.includes("באיחור"));

console.log("— מסך משימה");
const task = record(await renderRoute("#/task/t-ins"));
ok("סטטוס המשימה", task.includes("באיחור"));
ok("★ ההסבר שמונע 'זה נראה כמו באג'", task.includes("התאריך עבר וזה עוד לא סומן כבוצע"));
ok("★ פעולת התיקון היא הפעולה הראשית", task.includes("כבר חידשתי"));
ok("אפשר לסמן 'קבעתי תור'", task.includes("קבעתי תור"));
ok("ואפשר להשתיק", task.includes("לא להזכיר לי על זה"));

console.log("— מסמכים");
const docs = record(await renderRoute("#/docs"));
ok("★ כפתורי סינון עם aria-pressed", docs.includes("aria-pressed"));
for (const label of ["הכול", "רישיונות", "ביטוח", "טיפולים", "קבלות"]) {
  ok(`מסנן "${label}"`, docs.includes(`>${label}</button>`));
}
ok("רישיון הרכב מוצג", docs.includes("רישיון רכב"));
ok("★ והנראות נאמרת למשתמש", docs.includes("זמין גם לנהגים ברכב"));
ok("★ ההסבר על המסמך האישי", docs.includes("גם בעל החשבון לא רואה אותו"));

console.log("— 🔴 מסך החירום");
const emergency = record(await renderRoute("#/emergency"));
ok("★ מספר הרישוי ב-text-3xl (הפריט הגדול באפליקציה)", /text-3xl[^"]*"[^>]*>12-345-67/.test(emergency));
ok("★ והוא בתוך .num", /num[^"]*text-3xl|text-3xl[^"]*num/.test(emergency));
ok("★ חיוג למבטח דרך href=tel:", emergency.includes('href="tel:037777777"'));
ok("★ משטרה 100 כקישור tel:", emergency.includes('href="tel:100"'));
ok("★ מד״א 101 כקישור tel:", emergency.includes('href="tel:101"'));
ok("★ אין חיוג תכנותי", !emergency.includes("window.location='tel"));
ok("פרטי המבטח", emergency.includes("הראל") && emergency.includes("123456789"));
ok("רישיון הרכב מוצג ככפתור", emergency.includes("רישיון הרכב"));
ok("★ הפוליסה (דומיין owner) **לא** מוצגת", !emergency.includes("ביטוח מקיף"));
ok("★ שם הבעלים מוצג", emergency.includes("רונן"));
ok("★ ואין מייל", !emergency.includes("x@y.z"));
ok("הבהרה שהמסך מציג מה ששמרת", emergency.includes("לא מחליף מסמך מקורי"));
ok("★ אין מפה ואין geolocation", !emergency.includes("geolocation"));
ok("הניווט התחתון נשאר גלוי (דרך יציאה)", emergency.includes("ניווט ראשי"));

console.log("— הגדרות + משפטי");
const settings = record(await renderRoute("#/settings"));
ok("★ יציאה מהחשבון גלויה", settings.includes("יציאה מהחשבון") || settings.includes("מצב הדגמה מקומי"));
ok("★ ייצוא נתונים גלוי (N6)", settings.includes("ייצוא הנתונים שלי"));
ok("★ מחיקת חשבון גלויה (N6 + שער חנויות)", settings.includes("מחיקת החשבון והנתונים"));
// ⚠️ המתג מוצג — אבל **מושבת ומסומן "בקרוב"**, כי המימוש ב-Cache Storage
// עוד לא קיים. מתג שמבטיח שמירת מסמכים בזמן שנשמר טקסט בלבד הוא מצג.
ok("★ המתג לשמירת מסמכים מוצג", settings.includes("לשמור גם את קובצי המסמכים"));
ok('★ ומסומן "בקרוב"', /לשמור גם את קובצי המסמכים — בקרוב/.test(settings));
ok(
  "★ ושני המתגים במסך החירום מושבתים",
  (settings.match(/role="switch"[^>]*disabled/g) || []).length === 2
);
ok('★ "אימות בכל פתיחה" מוצג כמושבת', settings.includes("אימות בכל פתיחה") && settings.includes("disabled"));
ok("מתג עם role=switch (4.1.2)", settings.includes('role="switch"'));
ok("הבהרת האמינות (O3)", settings.includes("עזר בלבד"));
ok("קישור לתרגול החירום", settings.includes("לראות איך נראה מסך החירום"));

const notice = record(await renderRoute("#/settings/notice"));
ok("★ המסך מציג את היסטוריית האישורים", notice.includes("0.1-draft"));
const noticeFresh = record(
  await renderRoute("#/settings/notice", {
    storage: makeStorage({ nrcar_data: JSON.stringify({ ...SEED, profile: { ...SEED.profile, notices: [] } }) }),
  })
);
ok('★ הכפתור הוא "קראתי"', noticeFresh.includes(">קראתי</span>"));
ok('★ ואין "אני מסכים"', !noticeFresh.includes("אני מסכים"));

const a11y = record(await renderRoute("#/settings/accessibility"));
ok("הצהרת נגישות: התקן", a11y.includes("5568"));
ok("★ המגבלה הידועה מוצהרת", a11y.includes("אינם נגישים לקורא מסך"));
ok("★ והמסך אומר שהנוסח בהכנה (לא מצהיר לפני שמימשנו)", a11y.includes("בהכנה"));

console.log("— בדיקות רוחב על כל המסכים");
for (const html of all) {
  const rawKeys = html.match(/>[a-z][a-zA-Z]*\.[a-z][a-zA-Z.]+</g) || [];
  ok(`אין מפתח i18n שנשפך לתצוגה${rawKeys.length ? ` (${rawKeys.slice(0, 3).join(",")})` : ""}`, rawKeys.length === 0);
  for (const cls of ["text-xs", "text-slate-400", "text-gray-400", "text-stone-400", "text-slate-500"]) {
    ok(`אין ${cls}`, !html.includes(cls));
  }
  ok("אין undefined בתצוגה", !html.includes(">undefined<"));
  ok("אין NaN בתצוגה", !html.includes(">NaN<"));
  ok("אין [object Object]", !html.includes("[object Object]"));
  // ★ אין כתובת הורדה בשום מסך — הטוקן של Firebase לא מגיע ל-DOM.
  ok("★ אין firebasestorage URL ב-DOM", !html.includes("firebasestorage.googleapis.com"));
}

console.log("— ניווט (על מסך מלא)");
ok("יש <nav> ראשי", dash.includes('aria-label="ניווט ראשי"'));
for (const label of ["בית", "רכבים", "מסמכים", "חירום", "הגדרות"]) {
  ok(`תווית "${label}" כטקסט, לא רק אייקון`, dash.includes(`>${label}</span>`));
}
ok("★ ה-shortcut לחירום כקישור", dash.includes('href="#/emergency"'));
ok("aria-current על הפריט הפעיל", dash.includes('aria-current="page"'));
ok("אייקון החירום אדום גם כשאינו פעיל", dash.includes("text-danger-600"));
ok("★ הניווט אינו role=tab", !dash.includes('role="tab"'));

console.log("— אנגלית (parity בפועל, לא רק במילון)");
const dashEn = record(await renderRoute("#/", { lang: "en" }));
for (const label of ["Home", "Cars", "Documents", "Emergency", "Settings"]) {
  ok(`תווית "${label}"`, dashEn.includes(`>${label}</span>`));
}
ok("★ הכלל מיוחס לחוק גם באנגלית", dashEn.includes("By law, driving without valid compulsory insurance is prohibited"));
ok("אין עברית קשיחה בניווט האנגלי", !dashEn.includes(">בית</span>"));

rmSync(TMP, { recursive: true, force: true });

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור עברו`);
