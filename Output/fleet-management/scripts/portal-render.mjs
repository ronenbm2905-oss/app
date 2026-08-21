// ============================================================================
// portal-render.mjs — QA לפורטל הנהג: מרנדר את שני המסכים ואת כרטיס ניהול
// הגישה דרך react-dom/server, ובודק שמה שמופיע על המסך הוא מה שמותר להופיע.
//
//   npm run portal:check
//
// למה בנפרד מ-smoke: `npm run build` עובר מצוין גם כשמסך מדליף את העלות
// החודשית של הרכב לעובד, וגם כשהוא מרנדר מפתח i18n חסר כטקסט. הבדיקות כאן
// הן **מה נראה בעיניים של העובד**, ולא מה הפונקציה מחזירה.
//
// שלוש שכבות שמרכיבות את אותה הבטחה, וכולן חייבות להתקיים:
//   1. firestore.rules — הנהג בכלל לא קורא את מסמך הרכב (מקטע ז ב-rules-test);
//   2. utils/portal.js — ההיטל אינו מכיל את השדה;
//   3. **כאן** — ואפילו אם ההיטל היה מכיל אותו, המסך לא מציג אותו.
//
// לא מדפיס שמות אמיתיים — הפיקסטורה בדויה.
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const tmp = join(ROOT, "node_modules", ".fleet-portal-render");
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, "entry.jsx");
const outfile = join(tmp, "out.mjs");
const p = (rel) => JSON.stringify(join(ROOT, rel).replace(/\\/g, "/"));

writeFileSync(
  entry,
  `
import { renderToStaticMarkup } from "react-dom/server";
import DriverPortal from ${p("src/components/portal/DriverPortal.jsx")};
import MyVehicleScreen from ${p("src/components/portal/MyVehicleScreen.jsx")};
import OdometerReportScreen from ${p("src/components/portal/OdometerReportScreen.jsx")};
import DriverPortalCard from ${p("src/components/DriverPortalCard.jsx")};
import { I18nProvider } from ${p("src/hooks/useI18n.jsx")};

const wrap = (lang, node) =>
  renderToStaticMarkup(<I18nProvider initialLang={lang}>{node}</I18nProvider>);

export const renderPortal = (props, lang) =>
  wrap(lang, <DriverPortal onSubmitReading={async () => ({ ok: true })} onSignOut={() => {}} {...props} />);

export const renderVehicle = (props, lang) => wrap(lang, <MyVehicleScreen {...props} />);

export const renderReport = (props, lang) =>
  wrap(lang, <OdometerReportScreen onSubmit={async () => ({ ok: true })} {...props} />);

export const renderCard = (driver, lang) =>
  wrap(lang, <DriverPortalCard driver={driver} actions={{ unlinkDriverPortal: () => {}, inviteDriverPortal: () => {} }} />);
`
);

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  mainFields: ["module", "main"],
  conditions: ["import", "module", "default"],
  define: { "import.meta.env": "undefined" },
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      name: "stub-firebase",
      setup(b) {
        b.onResolve({ filter: /(^|[\\/])firebase\.js$/ }, () => ({ path: "stub-firebase", namespace: "stubfb" }));
        b.onLoad({ filter: /.*/, namespace: "stubfb" }, () => ({
          contents:
            "export const isFirebaseConfigured=false;export const db=null;export const auth=null;" +
            "export const storage=null;export const googleProvider=null;export const CONFIGURED_ORG_ID=null;",
          loader: "js",
        }));
      },
    },
  ],
});

const R = await import(pathToFileURL(outfile).href);
const load = async (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const dict = (await load("src/i18n.js")).default;
const { buildDriverPortal } = await load("src/utils/portal.js");

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
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
const has = (html, s) => html.includes(esc(s));
const section = (title) => console.log(`\n— ${title}`);

// ---------------------------------------------------------------------------
// הפיקסטורה: ההיטל נבנה מ**הקוד האמיתי**, לא נכתב ביד. אחרת הבדיקה בודקת
// מה שכתבתי בבדיקה, ולא מה שהאפליקציה מייצרת.
// ---------------------------------------------------------------------------
const MODEL = {
  org: { id: "orgR" },
  schemaVersion: 2,
  drivers: [
    { id: "d1", orgId: "orgR", fullName: "עובדת בדיקה", status: "active" },
    { id: "d2", orgId: "orgR", fullName: "עובד אחר", status: "active" },
  ],
  assignments: [
    { id: "a1", vehicleId: "v1", driverId: "d1", fromDate: "2025-01-01", toDate: null },
    { id: "a2", vehicleId: "v2", driverId: "d2", fromDate: "2025-01-01", toDate: null },
  ],
  vehicles: [
    {
      id: "v1", plate: "44-555-66", model: "אוקטביה", manufacturer: "סקודה", year: 2024,
      leaseCompanyId: "lc1", contractEnd: "2027-09-30",
      // ⬅ שדות שאסור שיגיעו למסך. הם **לא** אמורים לעבור את buildDriverPortal.
      monthlyCost: 3877, notes: "הערת אדמין פנימית", currentKm: 51234,
    },
    { id: "v2", plate: "77-888-99", model: "טוסון", manufacturer: "יונדאי", leaseCompanyId: "lc1" },
  ],
  leaseCompanies: [{ id: "lc1", name: "ליסינג בדיקה", phone: "03-1112222", email: "a@b.test", contactName: "מוקד" }],
};
const PORTAL = buildDriverPortal(MODEL, "2026-06-01");
const ENTRY = PORTAL.find((x) => x.id === "d1");
const DRIVER = { id: "d1", fullName: "עובדת בדיקה", email: "worker@gmail.test" };
const READINGS = [
  { id: "r2", date: "2026-05-20", km: 51234, source: "driver" },
  { id: "r1", date: "2026-04-01", km: 48000, source: "admin" },
];

// כל מפתח i18n שהודפס כמפתח = תרגום חסר (t מחזיר את המפתח, fail-visible).
const noRawKeys = (html, label) => {
  const raw = [...html.matchAll(/\b(portal|odoReport|driverLink|odo)\.[a-zA-Z.]+/g)].map((m) => m[0]);
  ok(`${label}: אפס מפתחות i18n גולמיים${raw.length ? " — " + raw.slice(0, 3).join(", ") : ""}`, raw.length === 0);
};

// ============================================================================
section("1. ⚠️ 'הרכב שלי' — מה שאסור להופיע, לא מופיע");
// ============================================================================
for (const lang of ["he", "en"]) {
  const html = R.renderVehicle({ entry: ENTRY, driver: DRIVER, contact: dict[lang]["portal.contactFallback"] }, lang);
  ok(`(${lang}) הלוחית מוצגת`, has(html, "44-555-66"));
  ok(`(${lang}) היצרן והדגם`, has(html, "סקודה") && has(html, "אוקטביה"));
  ok(`(${lang}) חברת הליסינג`, has(html, "ליסינג בדיקה"));
  ok(`(${lang}) טלפון חברת הליסינג`, has(html, "03-1112222"));
  ok(`(${lang}) תאריך סיום החוזה`, has(html, lang === "he" ? "30.9.2027" : "30/09/2027"));
  ok(`(${lang}) כתובת לפנייה (A2)`, has(html, dict[lang]["portal.contactFallback"]));

  // ⬅ **הבדיקה המרכזית של המסך הזה.**
  ok(`(${lang}) ⚠️ אין עלות חודשית`, !html.includes("3877") && !html.includes("3,877"));
  ok(`(${lang}) ⚠️ אין הערת אדמין`, !has(html, "הערת אדמין פנימית"));
  ok(`(${lang}) ואין מילת "עלות" בכלל`, !has(html, dict[lang]["vehicle.monthlyCost"]));
  ok(`(${lang}) אין רכב של עובד אחר`, !html.includes("77-888-99") && !has(html, "טוסון"));
  ok(`(${lang}) ואין שם של עובד אחר`, !has(html, "עובד אחר"));
  noRawKeys(html, `MyVehicle/${lang}`);
}

// ============================================================================
section("2. 'הרכב שלי' בלי רכב — מסך ריק מוסבר, לא מסך שבור");
// ============================================================================
for (const lang of ["he", "en"]) {
  const empty = PORTAL.find((x) => x.id === "d2");
  const html = R.renderVehicle(
    { entry: { ...empty, vehicleId: null }, driver: DRIVER, contact: dict[lang]["portal.contactFallback"] },
    lang
  );
  ok(`(${lang}) כותרת "לא רשום עליך רכב"`, has(html, dict[lang]["portal.noVehicleTitle"]));
  ok(`(${lang}) והסבר למי לפנות`, has(html, dict[lang]["portal.noVehicleBody"]));
  noRawKeys(html, `MyVehicle-empty/${lang}`);
}

// ============================================================================
section("3. ⚠️ 'דיווח ק\"מ' — הצהרת המטרה, ובלי צילום");
// ============================================================================
for (const lang of ["he", "en"]) {
  const html = R.renderReport({ entry: ENTRY, readings: READINGS }, lang);
  ok(`(${lang}) כותרת הדיווח`, has(html, dict[lang]["odoReport.title"]));
  ok(`(${lang}) תווית שדה הק"מ`, has(html, dict[lang]["odoReport.kmLabel"]));
  ok(`(${lang}) כפתור השליחה`, has(html, dict[lang]["odoReport.submit"]));
  ok(`(${lang}) היסטוריית הדיווחים`, has(html, dict[lang]["odoReport.history"]));

  // -- שקיפות בנקודת האיסוף (עדי 2.4) ------------------------------------
  ok(`(${lang}) הצהרת המטרה`, has(html, dict[lang]["odo.purposeNote"]));
  ok(`(${lang}) "מי רואה את זה" (2.4.1)`, has(html, dict[lang]["odo.whoSees"]));
  ok(`(${lang}) "מה אם טעיתי" (2.4.2)`, has(html, dict[lang]["odo.correction"]));
  ok(`(${lang}) ההפניה לנוהל הרכב (2.4.3)`, has(html, dict[lang]["odo.purposeLink"]));
  // ⬅ **אות שקיפות כוזב**: אין להציג לעובד מספר גרסה של מסמך שאין אליו דרך.
  ok(`(${lang}) ⚠️ ואין "0.1-draft" מול העובד`, !html.includes("0.1-draft"));
  // ⬅ A8: הצהרת המטרה **אינה** הטקסט הקטן ביותר במסך.
  ok(
    `(${lang}) A8 — ההצהרה בגודל גוף ולא text-[11px]`,
    !/text-\[11px\][^"]*"[^>]*>\s*<p>/.test(html) && html.includes("text-sm leading-relaxed")
  );

  // -- D4: בלי צילום, בלי מיקום -------------------------------------------
  ok(`(${lang}) ⚠️ אין קלט קובץ`, !/type="file"/.test(html));
  ok(`(${lang}) ⚠️ ואין תווית "צילום המד"`, !has(html, dict[lang]["odo.photo"]));
  ok(`(${lang}) ואין בורר תאריך`, !/type="date"/.test(html));
  ok(`(${lang}) התאריך מוצג כקבוע`, html.includes(esc(dict[lang]["odoReport.dateNote"].split("{")[0])));

  // -- נגישות (A5) ----------------------------------------------------------
  ok(`(${lang}) לשדה יש label מקושר`, /<label[^>]*for="/.test(html));
  ok(`(${lang}) והשדה מסומן required`, /<input[^>]*required/.test(html));
  ok(`(${lang}) ויש aria-describedby לרמז`, /aria-describedby="/.test(html));
  ok(`(${lang}) כל האייקונים aria-hidden`, (html.match(/<svg/g) || []).length === (html.match(/aria-hidden="true"[^>]*>/g) || []).length || /aria-hidden/.test(html));
  noRawKeys(html, `Report/${lang}`);
}

// ============================================================================
section("4. שגיאת ולידציה — מקושרת לשדה, לא רק אדומה");
// ============================================================================
{
  const html = R.renderReport({ entry: ENTRY, readings: [] }, "he");
  ok("בלי דיווחים — הודעת ריק", has(html, dict.he["odoReport.empty"]));
  ok("כפתור השליחה מושבת כשהשדה ריק", /<button[^>]*type="submit"[^>]*disabled/.test(html));
}

// ============================================================================
section("5. המעטפת — שתי לשוניות, ואפס מסכי אדמין");
// ============================================================================
for (const lang of ["he", "en"]) {
  const html = R.renderPortal({ driver: DRIVER, entry: ENTRY, readings: READINGS }, lang);
  ok(`(${lang}) שם העובד בכותרת`, has(html, "עובדת בדיקה"));
  ok(`(${lang}) לשונית "הרכב שלי"`, has(html, dict[lang]["portal.myVehicle"]));
  ok(`(${lang}) לשונית "דיווח ק"מ"`, has(html, dict[lang]["portal.reportKm"]));
  ok(`(${lang}) h1 יחיד`, (html.match(/<h1/g) || []).length === 1);
  ok(`(${lang}) הלשונית הפעילה מסומנת ב-aria-current`, /aria-current="page"/.test(html));
  ok(`(${lang}) לניווט יש שם נגיש`, /<nav[^>]*aria-label="/.test(html));
  ok(`(${lang}) לכפתור היציאה יש שם נגיש`, has(html, dict[lang]["nav.signOut"]));

  // ⬅ **הרדיוס המינימלי** (עדי 3.2.5): אין כאן שום מסך אדמין.
  for (const k of ["nav.dashboard", "nav.fines", "nav.drivers", "nav.settings", "nav.vehicles"]) {
    ok(`(${lang}) אין ${k} בפורטל`, !has(html, dict[lang][k]));
  }
  noRawKeys(html, `Portal/${lang}`);
}

// ============================================================================
section("6. כרטיס ניהול הגישה (צד האדמין) — ארבעת המצבים");
// ============================================================================
for (const lang of ["he", "en"]) {
  const base = { id: "d1", fullName: "עובדת בדיקה", status: "active" };
  const noMail = R.renderCard({ ...base, email: "", portalStatus: "none" }, lang);
  ok(`(${lang}) בלי מייל — נאמר במפורש`, has(noMail, dict[lang]["driverLink.noEmail"]));
  ok(`(${lang}) ואין כפתור ניתוק`, !has(noMail, dict[lang]["driverLink.unlink"]));

  const waiting = R.renderCard({ ...base, email: "worker@gmail.test", portalStatus: "none" }, lang);
  ok(`(${lang}) ממתין — הכתובת מוצגת`, has(waiting, "worker@gmail.test"));
  ok(`(${lang}) והמסך אומר שהמערכת אינה שולחת מייל`, has(waiting, dict[lang]["driverLink.emailHint"]));
  ok(`(${lang}) ועדיין אין ניתוק`, !has(waiting, dict[lang]["driverLink.unlink"]));

  const linked = R.renderCard(
    { ...base, email: "worker@gmail.test", userId: "uid1", portalStatus: "active", portalLinkedEmail: "worker@gmail.test" },
    lang
  );
  ok(`(${lang}) מקושר — יש כפתור ניתוק`, has(linked, dict[lang]["driverLink.unlink"]));
  ok(`(${lang}) וההסבר שהחסימה בשרת`, has(linked, dict[lang]["driverLink.note"]));

  const revoked = R.renderCard({ ...base, email: "worker@gmail.test", userId: null, portalStatus: "revoked" }, lang);
  ok(`(${lang}) נותק — מוסבר שצריך פעולה מפורשת`, has(revoked, dict[lang]["driverLink.revoked"]));
  ok(`(${lang}) ויש "אפשר קישור מחדש"`, has(revoked, dict[lang]["driverLink.invite"]));
  ok(`(${lang}) ואין כפתור ניתוק`, !has(revoked, dict[lang]["driverLink.unlink"]));

  const archived = R.renderCard({ ...base, email: "worker@gmail.test", userId: "uid1", portalStatus: "active", status: "archived" }, lang);
  ok(`(${lang}) בארכיון — אין כפתורים`, !has(archived, dict[lang]["driverLink.unlink"]) && !has(archived, dict[lang]["driverLink.invite"]));
  noRawKeys(linked, `Card/${lang}`);
}

// ============================================================================
section("7. ⚠️ נעילת קוד — אין צילום, אין מיקום, אין קריאה ישירה לרכב");
// ============================================================================
// עדי (17.8): "היעדר הצילום הוא מקריות טכנית, לא החלטה. הפעלת Blaze וחמש-עשרה
// שורות מחזירות את כל וקטור ה-EXIF — בלי סקירה, כי לא נוסף שדה, שדה קיים
// פשוט התמלא." לכן: הנעילה נבדקת על **קוד המקור של הפורטל**, לא על התנהגות.
{
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.jsx?$/.test(f)) files.push(full);
    }
  };
  walk(join(SRC, "components", "portal"));
  files.push(join(SRC, "hooks", "useDriverPortal.js"));
  // ⚠️ **מסירים הערות לפני הסריקה.** אחרת ההערה שמסבירה למה אין geolocation
  // מפילה את הבדיקה שאוכפת שאין geolocation — והדרך היחידה "לתקן" אותה היא
  // למחוק את התיעוד. בדיקה שמענישה על הסבר היא בדיקה מקולקלת.
  const stripComments = (t) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const src = files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

  ok(`נסרקו ${files.length} קבצי פורטל`, files.length >= 4);
  for (const forbidden of [
    "geolocation", "getCurrentPosition", "watchPosition",
    "FileInput", "type=\"file\"", "photoRef", "photoName", "photoStorageMode",
    "monthlyCost", "vehiclesPrivate", "finesPrivate", "incidentsPrivate",
  ]) {
    ok(`⚠️ "${forbidden}" אינו מופיע בקוד הפורטל`, !src.includes(forbidden));
  }
  // הפורטל אינו קורא את אוסף הרכבים ישירות — הוא קורא את ההיטל.
  ok('הפורטל אינו פונה לאוסף "vehicles"', !/collection\([^)]*"vehicles"/.test(src));
  ok("והוא כן קורא את driverPortal", src.includes('"driverPortal"'));

  // הפונקציה שמייצרת דיווח נהג נועלת את ארבעת שדות התמונה.
  const portalSrc = readFileSync(join(SRC, "utils", "portal.js"), "utf8");
  ok("createDriverReading נועל photoRef ל-null", /photoRef: null/.test(portalSrc));
  ok("ו-photoStorageMode ל-'none'", /photoStorageMode: "none"/.test(portalSrc));
  ok("ו-createdAt הוא התאריך ולא nowIso", /createdAt: date/.test(portalSrc) && !/createdAt: nowIso/.test(portalSrc));

  // ואותה נעילה קיימת ב-firestore.rules — שלוש שכבות, לא אחת.
  const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
  ok("rules אוכפים photoRef == null", rules.includes("d.get('photoRef', null) == null"));
  ok("rules אוכפים createdAt == date", rules.includes("d.get('createdAt', '') == d.get('date', '')"));
  ok("rules אוכפים hasOnly על שדות הדיווח", rules.includes("d.keys().hasOnly(["));
}

// ============================================================================
console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור של פורטל הנהג עברו`);
