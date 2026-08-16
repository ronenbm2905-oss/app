// ============================================================================
// review-render.mjs — מרנדר את **מסך 7** (תיקון ההחזקות שסומנו לבדיקה) באמת,
// דרך react-dom/server, ובודק שמה שמוצג הוא מה שהנתונים אומרים.
//
//   npm run review:check
//
// למה בנפרד מ-render-check: זה מסך אחר, עם דאטה אחר (מצב **אחרי** ייבוא),
// ועם מלכודות משלו — טקסט חופשי שחייב להופיע רק בבלוק המסומן, הצעה שחייבת
// להיראות כהצעה, ומצב-ריק שאסור לו להשתמש באותו טקסט של כפתור.
//
// לא מדפיס שמות — רק ספירות ותוצאות.
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(ROOT, "node_modules", ".fleet-review-render");
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, "entry.jsx");
const outfile = join(tmp, "out.mjs");
const p = (rel) => JSON.stringify(join(ROOT, rel).replace(/\\/g, "/"));

writeFileSync(
  entry,
  `
import { renderToStaticMarkup } from "react-dom/server";
import ReviewScreen from ${p("src/components/review/ReviewScreen.jsx")};
import { I18nProvider } from ${p("src/hooks/useI18n.jsx")};
export function render(data, lang) {
  return renderToStaticMarkup(
    <I18nProvider initialLang={lang}>
      <ReviewScreen data={data} actions={{ resolveReview: () => {} }} onDone={() => {}} />
    </I18nProvider>
  );
}
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

const { render } = await import(pathToFileURL(outfile).href);
const { analyzeImport } = await import(pathToFileURL(join(ROOT, "src/utils/importExcel.js")).href);
const { buildImportWrite } = await import(pathToFileURL(join(ROOT, "src/utils/importBuild.js")).href);
const { buildReviewWrite } = await import(pathToFileURL(join(ROOT, "src/utils/reviewBuild.js")).href);
const { reviewAssignments, reviewProgress } = await import(pathToFileURL(join(ROOT, "src/utils/review.js")).href);
const { parseImportRaw } = await import(pathToFileURL(join(ROOT, "src/utils/reviewParse.js")).href);
const { EMPTY } = await import(pathToFileURL(join(ROOT, "src/constants.js")).href);
const { translate } = await import(pathToFileURL(join(ROOT, "src/i18n.js")).href);

// -- הדאטה: אותה פיקסטורה של מסך הייבוא, בשמות בדויים -----------------------
const FREE_TEXT = {
  7: "החל מ 28.4.2026 עבר לעובד חדש",
  10: "פלונית אלמונית החל מ 11.1.2026 (קודמת לשעבר)",
  14: "עובד אחזקה באתר החל 6.5.26",
  15: "החל מתאריך 17.6.2026 אצל עובד אחר",
  19: "אצל מזכירה החל מ 8.2.2026",
  21: "עבור קבלן משנה אחזקות",
  22: "אלמוני 2.2.26",
  25: "רכב מסתובב - חברה אצל רכזת",
  26: "פלוני אלמוני - אחים קבלן",
};
// 27 שמות בדויים "נקיים" — בלי ספרות ובלי מילות-הקשר, אחרת הם ייחשבו בעצמם
// לטקסט חופשי ויציפו את המסך.
const CLEAN_NAMES = [
  "כהן - לוי", "אורית בן דוד", "יניר שפירא", "רונית מזרחי", "דנה ברק", "עופר שגיא",
  "רחלי נאור", "טל אבידן", "שירן קדם", "אמיר גלעד", "נועה שחר", "יובל ארז",
  "מיכל אשד", "רון פלד", "ליאת אדרי", "גיא נבון", "הילה ברנע", "אסף רימון",
  "מאיה כרמי", "עידו שני", "תמר אלון", "ניר עומר", "שני להב", "בר אשכנזי",
  "עמית רוזן", "יעל שוהם", "דור מלכה",
];
const rows = [];
rows[0] = ["מסד", "מס' רישוי", "דגם", "שם נהג", "חברת ליסינג", "תאריך תחילת הסכם", "תאריך סיום הסכם", "עלות חודשית"];
let cleanIdx = 0;
for (let i = 1; i <= 36; i++) {
  const r = i + 3;
  const driver = FREE_TEXT[r] ?? CLEAN_NAMES[cleanIdx++];
  rows[r - 1] = [i, 25324400 + i, `דגם ${i}`, driver, "פריים ליס", 45621, 46716, null];
}

const plan = analyzeImport(rows, EMPTY, { fileName: "check.xlsx", sheet: "20.7.26" });
const built = buildImportWrite(plan, { orgId: "org1", data: EMPTY });
const imported = {
  ...EMPTY,
  vehicles: built.vehicles,
  vehiclesPrivate: built.vehiclesPrivate,
  drivers: built.drivers,
  assignments: built.assignments,
  leaseCompanies: built.leaseCompanies,
};

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
const count = (html, needle) => html.split(esc(needle)).length - 1;

const pending = reviewAssignments(imported);
console.log(`דאטה: ${imported.assignments.length} החזקות · ${pending.length} לבדיקה`);

for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = render(imported, lang);
  console.log(`\n— רינדור ב-${lang}: ${html.length} תווים`);

  ok(`${lang}: המסך רונדר`, html.length > 3000);
  ok(`${lang}: הכותרת מוצגת`, html.includes(esc(t("reviewx.title"))));
  ok(
    `${lang}: מונה ההתקדמות מציג 0 מתוך 9`,
    html.includes(esc(t("reviewx.progress", { resolved: 0, total: 9 })))
  );
  ok(`${lang}: מוצג כמה חסומות`, html.includes(esc(t("reviewx.blockedCount", { n: 9 }))));

  // כל 9 הטקסטים המקוריים מוצגים — בבלוק המסומן, עם ההסבר שהם שדה מבודד
  const raws = pending.map((a) => a.importRaw);
  ok(`${lang}: כל ${raws.length} הטקסטים המקוריים מוצגים`, raws.every((r) => html.includes(esc(r))));
  ok(`${lang}: כל טקסט מוצג פעם אחת בלבד`, raws.every((r) => count(html, r) === 1));
  ok(`${lang}: כותרת הבלוק המבודד מופיעה לכל פריט`, count(html, t("reviewx.rawTitle")) === raws.length);
  ok(`${lang}: הערת עקבות-הביקורת מוצגת`, html.includes(esc(t("reviewx.rawNote"))));

  // ההצעות מוצגות — ומסומנות במפורש כהצעה
  ok(`${lang}: כותרת ההצעה מופיעה לכל פריט עם הצעה`, count(html, t("reviewx.suggestionTitle")) === raws.length);
  ok(`${lang}: הכיתוב "לא מוחל אוטומטית" מוצג`, html.includes(esc(t("reviewx.suggestionNote"))));
  const withName = pending.filter((a) => parseImportRaw(a.importRaw).nameSuggestion);
  ok(`${lang}: כפתור מילוי-שם לכל ${withName.length} ההצעות`, count(html, t("reviewx.applyName")) === withName.length);
  const withDate = pending.filter((a) => parseImportRaw(a.importRaw).suggestedFromDate);
  ok(`${lang}: כפתור מילוי-תאריך ל-${withDate.length} פריטים`, count(html, t("reviewx.applyDate")) === withDate.length);
  const withFormer = pending.filter((a) => parseImportRaw(a.importRaw).formerSuggestion);
  ok(`${lang}: כפתור פיצול ל-${withFormer.length} פריט`, count(html, t("reviewx.applySplit")) === withFormer.length);
  const poolish = pending.filter((a) => parseImportRaw(a.importRaw).isPool);
  ok(`${lang}: הצעת רכב מאגר ל-${poolish.length} פריט`, count(html, t("reviewx.suggestPool")) === poolish.length);

  // שמות מוצעים מוצגים כטקסט של הצעה
  const nameSug = parseImportRaw(pending[1].importRaw).nameSuggestion;
  ok(`${lang}: השם המוצע מוצג`, html.includes(esc(t("reviewx.suggestName", { name: nameSug.text }))));

  // הטופס: בורר מצב, יצירת נהג חדש, תאריך, פיצול
  ok(`${lang}: אפשרות "רכב מאגר / ללא מחזיק" קיימת לכל פריט`, count(html, t("reviewx.mode.pool")) >= raws.length);
  ok(`${lang}: אפשרות "נהג חדש" קיימת לכל פריט`, count(html, t("reviewx.driverNew")) === raws.length);
  ok(`${lang}: תיבת הפיצול קיימת לכל פריט`, count(html, t("reviewx.split")) === raws.length);
  ok(`${lang}: תיבת "התאריך משוער" קיימת לכל פריט`, count(html, t("reviewx.keepInferred")) === raws.length);
  ok(`${lang}: כפתור שמירה לכל פריט`, count(html, t("reviewx.resolve")) === raws.length);
  ok(`${lang}: שדה תאריך תחילת החזקה קיים`, count(html, t("reviewx.fromDate")) === raws.length);
  ok(`${lang}: מספר השורה בקובץ מוצג`, html.includes(esc(t("reviewx.sourceRow", { n: 10 }))));

  // מצב-ריק ומצב-סיום **לא** מוצגים כשיש עבודה
  ok(`${lang}: מצב-ריק לא מוצג כשיש פריטים`, !html.includes(esc(t("reviewx.emptyTitle"))));
  ok(`${lang}: הודעת "הכל אומת" לא מוצגת`, !html.includes(esc(t("reviewx.allDoneTitle"))));

  // אין מפתח תרגום שדלף לממשק
  const leaked = [...html.matchAll(/>[^<]*\b(reviewx|importx|assign|fine|dash|common)\.[a-zA-Z.]+[^<]*</g)]
    .map((m) => m[0])
    .filter((s) => !s.includes("importRaw"));
  ok(`${lang}: אין מפתחות תרגום שדלפו`, leaked.length === 0);
  if (leaked.length) console.error("    דלף:", leaked.slice(0, 3));
}

// ============================================================================
// מצב אחרי פתרון הכל: ההודעה מתחלפת, והמסך לא נשאר "תקוע" עם פריטים
// ============================================================================
let solved = { ...imported };
for (const a of reviewAssignments(solved).filter((x) => x.needsReview)) {
  const parsed = parseImportRaw(a.importRaw);
  const w = buildReviewWrite(
    solved,
    a.id,
    {
      mode: parsed.isPool ? "pool" : "driver",
      driverId: parsed.isPool ? "" : "__new__",
      newDriverName: parsed.isPool ? "" : parsed.nameSuggestion?.text || "נהג בדיקה",
      fromDate: parsed.suggestedFromDate || a.fromDate,
      fromDateInferred: !parsed.suggestedFromDate,
    },
    { orgId: "org1", actor: "admin" }
  );
  if (!w.ok) {
    console.error("  FAIL: פתרון נכשל", w.errors);
    failed++;
    continue;
  }
  const drivers = [...solved.drivers, ...w.drivers];
  const assignments = solved.assignments.map((x) => w.assignments.find((y) => y.id === x.id) || x);
  for (const y of w.assignments) if (!assignments.some((x) => x.id === y.id)) assignments.push(y);
  const vehicles = w.vehicle ? solved.vehicles.map((v) => (v.id === w.vehicle.id ? w.vehicle : v)) : solved.vehicles;
  solved = { ...solved, drivers, assignments, vehicles };
}

const prog = reviewProgress(solved);
ok("כל 9 הפריטים נפתרו", prog.pending === 0 && prog.total === 9);
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = render(solved, lang);
  console.log(`\n— רינדור אחרי פתרון (${lang}): ${html.length} תווים`);
  ok(`${lang}: הודעת "הכל אומת" מוצגת`, html.includes(esc(t("reviewx.allDoneTitle"))));
  ok(`${lang}: המונה מציג 9 מתוך 9`, html.includes(esc(t("reviewx.progress", { resolved: 9, total: 9 }))));
  ok(`${lang}: לא נותרו כפתורי שמירה`, count(html, t("reviewx.resolve")) === 0);
  ok(`${lang}: הטקסטים המקוריים אינם מוצגים כברירת מחדל (הפריטים מוסתרים)`,
    reviewAssignments(solved).every((a) => !html.includes(esc(a.importRaw))));
  ok(`${lang}: כפתור "הצגת אלה שנפתרו" קיים`, html.includes(esc(t("reviewx.showResolved"))));
}

// ============================================================================
// מצב ריק — ארגון בלי ייבוא. מצב-ריק חייב טקסט משלו, לא טקסט של כפתור.
// ============================================================================
for (const lang of ["he", "en"]) {
  const t = (k, v) => translate(lang, k, v);
  const html = render(EMPTY, lang);
  ok(`${lang}: מצב-ריק מוצג`, html.includes(esc(t("reviewx.emptyTitle"))));
  ok(`${lang}: עם הסבר`, html.includes(esc(t("reviewx.emptyHint"))));
  ok(`${lang}: בלי מונה התקדמות`, !html.includes(esc(t("reviewx.progress", { resolved: 0, total: 0 }))));
  ok(`${lang}: כותרת מצב-ריק אינה חוזרת פעמיים`, count(html, t("reviewx.emptyTitle")) === 1);
  ok(`${lang}: כותרת מצב-ריק שונה מטקסט הכפתורים`,
    t("reviewx.emptyTitle") !== t("reviewx.resolve") && t("reviewx.emptyTitle") !== t("reviewx.showResolved"));
}

rmSync(tmp, { recursive: true, force: true });

console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור של מסך 7 עברו`);
