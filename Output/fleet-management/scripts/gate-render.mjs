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
import DriversScreen from ${p("src/components/DriversScreen.jsx")};
import DriverPage from ${p("src/components/DriverPage.jsx")};
import NoticeDeliveryModal from ${p("src/components/NoticeDeliveryModal.jsx")};
import { ReadingForm } from ${p("src/components/tabs/OdometerTab.jsx")};
import { I18nProvider } from ${p("src/hooks/useI18n.jsx")};
import { translate } from ${p("src/i18n.js")};

const noopActions = {
  upsert: () => {}, archiveDriver: () => {}, anonymizeDriver: () => {},
  recordNoticeDelivery: async () => ({ ok: true, count: 0, errors: [], skipped: [] }),
  acknowledgeNotice: async () => ({ ok: true }),
};

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

export const renderDrivers = (data, lang) =>
  wrap(lang, <DriversScreen data={data} orgId="org1" actions={noopActions} onOpenDriver={() => {}} />);

export const renderDriverPage = (data, driverId, lang) =>
  wrap(lang, <DriverPage driverId={driverId} data={data} orgId="org1" actions={noopActions} onBack={() => {}} onOpenVehicle={() => {}} />);

export const renderNoticeModal = (data, candidates, lang) =>
  wrap(lang, <NoticeDeliveryModal data={data} candidates={candidates} actions={noopActions} onClose={() => {}} />);

export const renderOdometerForm = (data, vehicle, lang) =>
  wrap(lang, <ReadingForm vehicle={vehicle} data={data} orgId="org1" onClose={() => {}} onSave={() => {}} />);
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

// ============================================================================
section("G1 (א) — רשימת הנבחרים מוצגת לפני האישור, ולא \"סמן הכל\" עיוור");
// ============================================================================
const { NOTICE_METHODS } = await load("src/constants.js");
const { noticeCandidates, buildNoticeRecord } = await load("src/utils/notice.js");
const { todayIso } = await load("src/utils/dates.js");
const TODAY = todayIso();

const candidates = noticeCandidates(data);
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const drivers = R.renderDrivers(data, lang);
  ok(`${lang}: כפתור הרישום הקבוצתי מוצג עם מונה`,
    has(drivers, t("notice.bulkActionCount", { n: candidates.length })));
  const allNoticed = R.renderDrivers(dataNoticed, lang);
  ok(`${lang}: וכשאין למי לרשום — הכפתור נעלם`,
    !has(allNoticed, t("notice.bulkActionCount", { n: 1 })) &&
    !has(allNoticed, t("notice.bulkAction")));

  const modal = R.renderNoticeModal(data, candidates, lang);
  ok(`${lang}: המסך רונדר`, modal.length > 1500);
  ok(`${lang}: כותרת רשימת הנבחרים`, has(modal, t("notice.selectTitle")));
  ok(`${lang}: שם העובד הנבחר מוצג בפועל`, has(modal, "אלמוני בדיקה"));
  ok(`${lang}: עם מונה נבחרים מתוך סך הכל`,
    has(modal, t("notice.selectedCount", { n: candidates.length, total: candidates.length })));
  const shownToday =
    lang === "he"
      ? `${Number(TODAY.slice(8))}.${Number(TODAY.slice(5, 7))}.${TODAY.slice(0, 4)}`
      : `${TODAY.slice(8)}/${TODAY.slice(5, 7)}/${TODAY.slice(0, 4)}`;
  ok(`${lang}: וסיכום מפורש של מה בדיוק ייכתב`,
    has(modal, t("notice.summary", {
      n: candidates.length,
      version: "0.1-draft",
      date: shownToday,
      method: t("notice.method.admin_recorded"),
    })));
  ok(`${lang}: תיבת סימון לכל עובד — בחירה, לא סימון גורף`,
    (modal.match(/type="checkbox"/g) || []).length === candidates.length);
  ok(`${lang}: אזהרת התיארוך-לאחור מוצגת`, has(modal, t("notice.backdateWarning")));
}

// ============================================================================
section("G1 (ב) — תאריך מסירה מפורש, עתיד חסום, ורגע הלחיצה בנפרד");
// ============================================================================
const deliveredDrv = {
  ...noticedDrv,
  notice: buildNoticeRecord({
    policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "signed_form",
    deliveryId: "ndl_test", recordedBy: "admin-uid", recordedAt: "2026-08-14T09:00:00.000Z",
  }),
};
const dataDelivered = { ...data, drivers: [noNoticeDrv, deliveredDrv] };
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const modal = R.renderNoticeModal(data, candidates, lang);
  ok(`${lang}: שדה תאריך המסירה קיים`, has(modal, t("notice.deliveredAt")));
  ok(`${lang}: ברירת המחדל היא היום`, modal.includes(`value="${TODAY}"`));
  ok(`${lang}: ותאריך עתידי חסום בשדה עצמו`, modal.includes(`max="${TODAY}"`));
  ok(`${lang}: מוסבר שזה לא רגע הלחיצה`, has(modal, t("notice.deliveredAtHint")));

  const card = R.renderDriverPage(dataDelivered, deliveredDrv.id, lang);
  const shownDate = lang === "he" ? "10.8.2026" : "10/08/2026";
  const clickDate = lang === "he" ? "14.8.2026" : "14/08/2026";
  ok(`${lang}: כרטיס הנהג מציג את תאריך ה**מסירה**`,
    has(card, t("driver.noticeGiven", { version: "0.1-draft", date: shownDate })));
  ok(`${lang}: ורגע הרישום מוצג בנפרד, לא במקומו`,
    has(card, t("driver.noticeRecordedLine", { date: clickDate })));
  ok(`${lang}: וגם שיטת המסירה`,
    has(card, t("driver.noticeMethodLine", { method: t("notice.method.signed_form") })));
}

// ============================================================================
section("G1 (ג) — enum שיטות, וחיווי שקט על תיעוד חלש");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const modal = R.renderNoticeModal(data, candidates, lang);
  for (const m of NOTICE_METHODS) {
    ok(`${lang}: השיטה ${m} מופיעה כאופציה`, modal.includes(`value="${m}"`));
  }
  ok(`${lang}: ברירת המחדל היא החלשה ביותר — לא מצהירים ראיה שלא הייתה`,
    modal.includes('value="admin_recorded" selected=""'));

  // חיווי — לא חסימה.
  const weakData = { ...data, drivers: [{ ...noticedDrv, notice: buildNoticeRecord({
    policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "admin_recorded" }) }] };
  const weak = R.renderDriverPage(weakData, noticedDrv.id, lang);
  ok(`${lang}: רישום ידני מקבל חיווי שהתיעוד חלש`, has(weak, t("driver.noticeWeakEvidence")));
  ok(`${lang}: אבל הרישום עצמו מוצג כתקף — חיווי, לא חסימה`,
    has(weak, t("driver.noticeGiven", { version: "0.1-draft", date: lang === "he" ? "10.8.2026" : "10/08/2026" })));
  ok(`${lang}: וכפתור הרישום כבר לא מוצג`, !has(weak, t("driver.recordNotice")));

  const strong = R.renderDriverPage(dataDelivered, deliveredDrv.id, lang);
  ok(`${lang}: טופס חתום — בלי חיווי חולשה`, !has(strong, t("driver.noticeWeakEvidence")));
}

// ============================================================================
section("G1 (ד) — odo.purposeLink בנקודת האיסוף, עם הגרסה מ-settings");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const form = R.renderOdometerForm(data, vehicle, lang);
  ok(`${lang}: הצהרת המטרה הקיימת נשארה כלשונה`, has(form, t("odo.purposeNote")));
  ok(`${lang}: והקישור לגרסת ההודעה נוסף מתחתיה`,
    has(form, t("odo.purposeLink", { version: "0.1-draft" })));

  // הגרסה נלקחת מה-settings ולכן מתעדכנת מעצמה — לא מחרוזת קשיחה.
  const v2 = { ...data, settings: { ...data.settings, policyVersion: "1.0" } };
  const form2 = R.renderOdometerForm(v2, vehicle, lang);
  ok(`${lang}: בעליית גרסה הטקסט מתעדכן מעצמו`,
    has(form2, t("odo.purposeLink", { version: "1.0" })) &&
    !has(form2, t("odo.purposeLink", { version: "0.1-draft" })));
}

// ============================================================================
section("G1 — הגדרות: רשומת אירוע המסירה, בתבנית importAck");
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const none = R.renderSettings(data, lang);
  ok(`${lang}: הכרטיס קיים`, has(none, t("settings.noticeDelivery.title")));
  ok(`${lang}: ובלי אירוע — נאמר שאין`, has(none, t("settings.noticeDelivery.none")));

  const withDelivery = {
    ...data,
    settings: {
      ...data.settings,
      noticeDelivery: {
        id: "ndl_1", at: "2026-08-14T09:00:00.000Z", by: "admin-uid",
        deliveredAt: "2026-08-10", method: "email_bulk", policyVersion: "0.1-draft",
        drivers: 26, driverIds: [], evidenceRef: "מייל 10.8.2026",
      },
    },
  };
  const shown = R.renderSettings(withDelivery, lang);
  ok(`${lang}: מוצגים מתי נמסר, באיזו שיטה, לכמה עובדים ולאיזו גרסה`,
    has(shown, t("settings.noticeDelivery.value", {
      deliveredAt: lang === "he" ? "10.8.2026" : "10/08/2026",
      method: t("notice.method.email_bulk"), n: 26, version: "0.1-draft",
    })));
  ok(`${lang}: ומי הצהיר ומתי נרשם — בנפרד מתאריך המסירה`,
    has(shown, t("settings.noticeDelivery.recorded", {
      at: lang === "he" ? "14.8.2026" : "14/08/2026", by: "admin-uid",
    })));
  ok(`${lang}: והאסמכתה החיצונית`, has(shown, "מייל 10.8.2026"));
}

rmSync(tmp, { recursive: true, force: true });

console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור של תיקוני השער עברו`);
