// ============================================================================
// gate-render.mjs — QA אמיתי לתיקוני שער עדי (13.8.2026): מרנדר את המסכים
// שהשתנו **באמת**, דרך react-dom/server, ובודק שהחסימה והחיוויים מגיעים
// לממשק ולא נשארו בשכבת ה-utils.
//
//   npm run gate:check
//
// למה בנפרד מ-render-check / review-check: אלה מסכים אחרים (דשבורד, טופס
// קנס, הגדרות) עם דאטה משלהם, והמלכודות כאן הן חדשות — אופציית סטטוס
// שחייבת **להיעלם** מהתפריט, באנר שחייב להופיע, והצהרה שחייבת להיראות.
//
// לא מדפיס שמות אמיתיים — הפיקסטורה בדויה.
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(ROOT, "node_modules", ".fleet-gate-render");
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, "entry.jsx");
const outfile = join(tmp, "out.mjs");
const p = (rel) => JSON.stringify(join(ROOT, rel).replace(/\\/g, "/"));

writeFileSync(
  entry,
  `
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard from ${p("src/components/Dashboard.jsx")};
import SettingsScreen from ${p("src/components/SettingsScreen.jsx")};
import { FineForm } from ${p("src/components/FineForm.jsx")};
import { Preview } from ${p("src/components/ImportScreen.jsx")};
import ReviewScreen from ${p("src/components/review/ReviewScreen.jsx")};
import { I18nProvider } from ${p("src/hooks/useI18n.jsx")};
import { translate } from ${p("src/i18n.js")};

const wrap = (lang, node) =>
  renderToStaticMarkup(<I18nProvider initialLang={lang}>{node}</I18nProvider>);

export const renderDashboard = (data, lang) =>
  wrap(lang, <Dashboard data={data} onOpenVehicle={() => {}} onOpenFines={() => {}} onOpenReview={() => {}} onOpenDriver={() => {}} />);

export const renderSettings = (data, lang) =>
  wrap(lang, <SettingsScreen data={data} orgId="org1" actions={{ setOrg: () => {}, setSettings: () => {} }} onResetLocal={() => {}} />);

export const renderFineForm = (data, fine, lang) =>
  wrap(lang, <FineForm open data={data} orgId="org1" fine={fine} onClose={() => {}} onSave={() => {}} />);

export const renderImportPreview = (plan, lang) =>
  wrap(lang, <Preview plan={plan} t={(k, v) => translate(lang, k, v)} lang={lang} />);

export const renderReview = (data, lang) =>
  wrap(lang, <ReviewScreen data={data} actions={{ resolveReview: () => {} }} onDone={() => {}} />);
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
            "export const isFirebaseConfigured=false;export const db=null;export const auth=null;export const storage=null;export const googleProvider=null;",
          loader: "js",
        }));
      },
    },
  ],
});

const R = await import(pathToFileURL(outfile).href);
const load = async (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { EMPTY } = await load("src/constants.js");
const { translate } = await load("src/i18n.js");
const { createVehicle, createDriver, createFine, createAssignment } = await load("src/schema.js");
const { analyzeImport } = await load("src/utils/importExcel.js");
const { buildImportWrite } = await load("src/utils/importBuild.js");

let pass = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) pass++;
  else {
    failed++;
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
const count = (html, s) => html.split(esc(s)).length - 1;
const section = (title) => console.log(`\n— ${title}`);

const ORG = "org1";
const NOTICE = { policyVersion: "1.0", acknowledgedAt: "2026-08-01T10:00:00.000Z", method: "admin_recorded" };

// -- פיקסטורה: רכב, שני עובדים (אחד עם יידוע ואחד בלי), קנס פתוח ----------
const vehicle = createVehicle({ orgId: ORG, plate: "10-111-22", status: "active" });
const noNoticeDrv = createDriver({ orgId: ORG, fullName: "אלמוני בדיקה", status: "active" });
const noticedDrv = createDriver({ orgId: ORG, fullName: "פלוני מיודע", status: "active", notice: NOTICE });
const assignment = createAssignment({
  orgId: ORG, vehicleId: vehicle.id, driverId: noNoticeDrv.id, fromDate: "2026-01-01",
});
const fine = createFine({
  orgId: ORG, vehicleId: vehicle.id, driverId: noNoticeDrv.id,
  violationDate: "2026-06-01", amount: 400, status: "received",
});
const data = {
  ...EMPTY,
  org: { id: ORG, name: "בדיקה", members: {} },
  settings: { ...EMPTY.settings, onboarded: true },
  vehicles: [vehicle],
  drivers: [noNoticeDrv, noticedDrv],
  assignments: [assignment],
  fines: [fine],
};
const dataNoticed = {
  ...data,
  drivers: data.drivers.map((d) => (d.id === noNoticeDrv.id ? { ...d, notice: NOTICE } : d)),
};

// ============================================================================
section("M4 — דשבורד: קבוצת \"נהגים ללא יידוע\"");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = R.renderDashboard(data, lang);
  ok(`${lang}: הדשבורד רונדר`, html.length > 2000);
  ok(`${lang}: כותרת הקבוצה מוצגת`, has(html, t("dash.driversWithoutNotice")));
  ok(`${lang}: עם ההסבר שהיא חוסמת`, has(html, t("dash.driversWithoutNotice.desc")));
  ok(`${lang}: העובד ללא היידוע מופיע בשמו`, has(html, "אלמוני בדיקה"));
  ok(`${lang}: העובד שכן יודע אינו מופיע בקבוצה`, !has(html, "פלוני מיודע"));
  ok(`${lang}: מסומן שהחסימה פעילה בפועל`, has(html, t("dash.noticeBlocking")));
  ok(`${lang}: ומוצג מספר הקנסות המשויכים`, has(html, t("dash.noticeFines", { n: 1 })));

  const after = R.renderDashboard(dataNoticed, lang);
  ok(`${lang}: אחרי רישום היידוע הקבוצה נעלמת`, !has(after, t("dash.driversWithoutNotice")));
}

// ============================================================================
section("M4 — טופס הקנס: אופציות הסטטוס החסומות נעלמות מהתפריט");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const blocked = R.renderFineForm(data, fine, lang);
  ok(`${lang}: הטופס רונדר`, blocked.length > 2000);
  ok(`${lang}: מוצגת אזהרת השער ליד הנהג`, has(blocked, t("fine.noticeGateNote")));
  // בודקים את ה-<option> עצמו ולא את הטקסט: "נמסרה הודעה לנהג" מופיע גם
  // בתיאור זרימת הסטטוסים מתחת לשדה, ולכן חיפוש טקסט היה עובר תמיד.
  ok(`${lang}: "נמסרה הודעה לנהג" אינו בתפריט`, !blocked.includes('value="notified_driver"'));
  ok(`${lang}: "הוסב לנהג" אינו בתפריט`, !blocked.includes('value="transferred"'));
  ok(`${lang}: "בוטל" כן נשאר זמין`, blocked.includes('value="cancelled"'));
  ok(`${lang}: והסטטוס הנוכחי נשאר בתפריט`, blocked.includes('value="received"'));

  const open = R.renderFineForm(dataNoticed, fine, lang);
  ok(`${lang}: לעובד עם יידוע — האזהרה נעלמת`, !has(open, t("fine.noticeGateNote")));
  ok(`${lang}: ו"נמסרה הודעה לנהג" חוזר לתפריט`, open.includes('value="notified_driver"'));
}

// ============================================================================
section("M3 — הגדרות: הצהרת הייבוא מוצגת כראיה");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const none = R.renderSettings(data, lang);
  ok(`${lang}: כרטיס ההצהרה קיים`, has(none, t("settings.importAck.title")));
  ok(`${lang}: בלי ייבוא — נאמר שאין הצהרה`, has(none, t("settings.importAck.none")));
  ok(`${lang}: עם ההבהרה שזו אינה הסכמת עובד`, has(none, t("settings.importAck.hint")));

  const withAck = {
    ...data,
    settings: {
      ...data.settings,
      importAck: {
        at: "2026-08-13T09:00:00.000Z", by: "admin-uid", policyVersion: "0.1-draft",
        file: "רכבים.xlsx", sheet: "20.7.26", vehicles: 36, drivers: 27,
      },
    },
  };
  const shown = R.renderSettings(withAck, lang);
  ok(`${lang}: ההצהרה שנרשמה מוצגת עם מי ומתי`, has(shown, "admin-uid") && has(shown, "0.1-draft"));
  ok(`${lang}: וגם הקובץ והגיליון`, has(shown, "רכבים.xlsx") && has(shown, "20.7.26"));
  ok(`${lang}: והמצב הריק כבר לא מוצג`, !has(shown, t("settings.importAck.none")));
}

// ============================================================================
section("M6 — מסך הייבוא: חיווי מיזוג-לפי-שם");
// ============================================================================
const HEADER = ["מסד", "מס' רישוי", "דגם", "שם נהג", "חברת ליסינג", "תאריך תחילת הסכם", "תאריך סיום הסכם", "עלות חודשית"];
const D = (iso) => new Date(`${iso}T00:00:00.000Z`);
const mergeGrid = [];
mergeGrid[0] = HEADER;
mergeGrid[3] = [1, 11111111, "דגם א", "כפול בדוי", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
mergeGrid[4] = [2, 22222222, "דגם ב", "כפול בדוי", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
mergeGrid[5] = [3, 33333333, "דגם ג", "יחיד בדוי", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
const mergePlan = analyzeImport(mergeGrid, EMPTY, { fileName: "m.xlsx", sheet: "s" });

const cleanGrid = [HEADER];
cleanGrid[3] = [1, 44444444, "דגם ד", "בודד בדוי", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
const cleanPlan = analyzeImport(cleanGrid, EMPTY, { fileName: "c.xlsx", sheet: "s" });

for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = R.renderImportPreview(mergePlan, lang);
  ok(`${lang}: כרטיס המיזוג מוצג`, has(html, t("importx.merge.title")));
  ok(`${lang}: עם ההסבר למה זה מסוכן`, has(html, t("importx.merge.intro")));
  ok(`${lang}: השם הכפול מוצג בכרטיס`, has(html, "כפול בדוי"));
  ok(`${lang}: מצוין שהוא חוזר בשתי שורות`, has(html, t("importx.merge.withinFile", { n: 2 })));
  ok(`${lang}: עם מספרי השורות`, has(html, t("importx.merge.rows", { rows: "4, 5" })));
  // סופרים את תגית ה-Pill עצמה (title=ההסבר), ולא את המילה "מיזוג" —
  // היא מופיעה גם בכותרת הכרטיס ובהסבר שלו.
  const badge = `title="${esc(t("importx.merge.intro"))}"`;
  ok(`${lang}: שתי השורות מסומנות בתגית מיזוג`, html.split(badge).length - 1 === 2);
  ok(`${lang}: השם היחיד אינו מסומן`, has(html, "יחיד בדוי"));

  const clean = R.renderImportPreview(cleanPlan, lang);
  ok(`${lang}: קובץ בלי מיזוגים אומר זאת במפורש`, has(clean, t("importx.merge.none")));
  ok(`${lang}: ובלי תגיות מיזוג`, clean.split(badge).length - 1 === 0);
}

// ============================================================================
section("M6 — מסך האימות: אזהרת \"נבחר לפי מיקום\"");
// ============================================================================
const FREE_TEXT = {
  4: "אלמוני פלוני 2.2.26", // ← נבחר לפי מיקום: אין מילת-הקשר
  5: "אצל מזכירה החל מ 8.2.2026", // ← נבחר אחרי מילת-הקשר
};
const reviewGrid = [HEADER];
for (let r = 4; r <= 5; r++) {
  reviewGrid[r - 1] = [r - 3, 25324400 + r, `דגם ${r}`, FREE_TEXT[r], "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
}
const reviewPlan = analyzeImport(reviewGrid, EMPTY, { fileName: "r.xlsx", sheet: "s" });
const built = buildImportWrite(reviewPlan, { orgId: ORG, data: EMPTY });
const imported = {
  ...EMPTY,
  vehicles: built.vehicles,
  vehiclesPrivate: built.vehiclesPrivate,
  drivers: built.drivers,
  assignments: built.assignments,
  leaseCompanies: built.leaseCompanies,
};
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = R.renderReview(imported, lang);
  ok(`${lang}: מסך האימות רונדר עם שני פריטים`, count(html, t("reviewx.rawTitle")) === 2);
  ok(`${lang}: אזהרת "נבחר לפי מיקום" מוצגת פעם אחת`, count(html, t("reviewx.confidencePositionNote")) === 1);
  ok(`${lang}: ותווית הביטחון הנמוך מלווה אותה`, has(html, t("reviewx.confidence.low")));
  ok(`${lang}: הפריט עם מילת-הקשר מסומן בביטחון סביר`, has(html, t("reviewx.confidence.high")));
  ok(`${lang}: אין מפתחות תרגום שדלפו`,
    [...html.matchAll(/>[^<]*\b(reviewx|importx|dash|fine|settings|driver)\.[a-zA-Z.]+[^<]*</g)]
      .filter((m) => !m[0].includes("importRaw")).length === 0);
}

rmSync(tmp, { recursive: true, force: true });

console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור של תיקוני השער עברו`);
