// ============================================================================
// render-check.mjs — מרנדר את מסך הייבוא **באמת** (React server render) ובודק
// שמה שמוצג הוא מה שהתוכנית אומרת. תופס מה ש-smoke לא תופס: JSX שבור, prop
// חסר, מפתח תרגום שלא קיים ומודפס כמפתח, טבלה שלא מציגה את כל השורות.
//
//   npm run render:check                 — פיקסטורה סינתטית (ברירת מחדל)
//   npm run render:check -- "<path.xlsx>" [sheet]   — קובץ אקסל אמיתי
//
// לא מדפיס שמות — רק ספירות ובדיקות.
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [, , filePath, sheetArg] = process.argv;

// -- הגריד: קובץ אמיתי אם ניתן נתיב, אחרת פיקסטורה סינתטית -----------------
async function makeGrid() {
  if (filePath) {
    const { default: readXlsxFile, readSheetNames } = await import("read-excel-file/node");
    const sheets = await readSheetNames(filePath);
    const target = sheetArg || sheets[0];
    return { rows: await readXlsxFile(filePath, { sheet: target }), sheet: target, label: `${filePath.split(/[\\/]/).pop()} · ${target}` };
  }
  const rows = [];
  rows[0] = ["מסד", "מס' רישוי", "דגם", "שם נהג", "חברת ליסינג", "תאריך תחילת הסכם", "תאריך סיום הסכם", "עלות חודשית"];
  rows[1] = [null, null, null, null, null, null, null, 2347];
  rows[2] = [null, null, null, null, null, null, null, null, null, "30.12.25"];
  const free = {
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
  for (let i = 1; i <= 36; i++) {
    const r = i + 3;
    rows[r - 1] = [
      i, 25324400 + i, `דגם ${i}`,
      free[r] ?? `נהג${i} בדיקה`,
      r === 20 ? "פרים ליס" : "פריים ליס",
      45621, 46716,
      r === 8 ? "052-1234567" : r === 19 ? new Date("2028-05-26T00:00:00Z") : r === 11 ? 2770 : null,
    ];
  }
  rows[39] = [null, "פריים ליס", "עמית", "052-3866645", null, "amitro@primelease.co.il", "איש קשר נוסף 052-7306374", null];
  return { rows, sheet: "20.7.26", label: "פיקסטורה סינתטית" };
}

// -- bundle של הרכיב האמיתי + רינדור ---------------------------------------
// הפלט חייב לשבת בתוך הפרויקט כדי ש-react/react-dom (externals) ייפתרו.
const tmp = join(ROOT, "node_modules", ".fleet-render");
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, "entry.jsx");
const outfile = join(tmp, "out.mjs");

writeFileSync(
  entry,
  `
import { renderToStaticMarkup } from "react-dom/server";
import { Preview } from ${JSON.stringify(join(ROOT, "src/components/ImportScreen.jsx").replace(/\\/g, "/"))};
import { I18nProvider } from ${JSON.stringify(join(ROOT, "src/hooks/useI18n.jsx").replace(/\\/g, "/"))};
import { translate } from ${JSON.stringify(join(ROOT, "src/i18n.js").replace(/\\/g, "/"))};
export function render(plan, lang) {
  const t = (k, v) => translate(lang, k, v);
  return renderToStaticMarkup(
    <I18nProvider>
      <Preview plan={plan} t={t} lang={lang} />
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
  // platform:node מעדיף CJS; lucide-react ב-CJS עושה require("react") שהוא
  // external ולכן נשבר. מכריחים את מסלול ה-ESM, בדיוק כמו ש-Vite עושה.
  mainFields: ["module", "main"],
  conditions: ["import", "module", "default"],
  define: { "import.meta.env": "undefined" },
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      // firebase.js גורר ב-node את מימוש ה-gRPC של Firestore, שאין לו מה
      // לעשות בבדיקת רינדור. הרכיב צורך ממנו רק isFirebaseConfigured —
      // מחליפים בסטאב "מצב מקומי", שזה גם המצב שבו הדמו רץ.
      name: "stub-firebase",
      setup(b) {
        b.onResolve({ filter: /(^|[\\/])firebase\.js$/ }, () => ({
          path: "stub-firebase",
          namespace: "stubfb",
        }));
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
const { EMPTY } = await import(pathToFileURL(join(ROOT, "src/constants.js")).href);

const { rows, sheet, label } = await makeGrid();
const plan = analyzeImport(rows, EMPTY, { fileName: "check.xlsx", sheet });
if (!plan.ok) {
  console.error("analyze failed:", plan.errorKey);
  process.exit(1);
}

let pass = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) pass++;
  else {
    failed++;
    console.error("  FAIL:", name);
  }
};

console.log(`מקור: ${label}`);

for (const lang of ["he", "en"]) {
  const html = render(plan, lang);
  console.log(`\n— רינדור ב-${lang}: ${html.length} תווים`);

  ok(`${lang}: המסך רונדר`, html.length > 2000);

  // כל שורת נתונים מופיעה בטבלה
  const missingRows = plan.rows.filter((r) => !html.includes(`>${r.rowNumber}</td>`));
  ok(`${lang}: כל ${plan.rows.length} שורות הנתונים מוצגות`, missingRows.length === 0);
  if (missingRows.length) console.error("    חסרות:", missingRows.map((r) => r.rowNumber).join(","));

  // כל לוחית מופיעה
  const missingPlates = plan.rows.filter((r) => !html.includes(r.plateRaw));
  ok(`${lang}: כל הלוחיות מוצגות`, missingPlates.length === 0);

  // הטקסט החופשי מוצג — אבל **רק** בטבלת ה-needsReview, כערך מסומן
  const review = plan.rows.filter((r) => r.assignment?.needsReview);
  ok(`${lang}: כל ${review.length} שורות ה-needsReview מציגות את importRaw`,
    review.every((r) => html.includes(escapeHtml(r.assignment.importRaw))));

  // הערכים שנדחו מוצגים עם הערך המקורי
  ok(`${lang}: כל ${plan.rejected.length} הערכים שנדחו מוצגים`,
    plan.rejected.every((r) => html.includes(escapeHtml(String(r.raw)))));

  // אזהרת ה-fromDateInferred
  ok(`${lang}: אזהרת התאריך המשוער מוצגת`,
    html.includes(escapeHtml(translateSnippet(lang, "inferred"))));

  // אין מפתח i18n שדלף לממשק (fail-visible): "importx.xxx" בגוף הטקסט
  const leaked = [...html.matchAll(/>[^<]*\b(importx|fine|assign|vehicle)\.[a-zA-Z.]+[^<]*</g)]
    .map((m) => m[0])
    .filter((s) => !s.includes("importRaw"));
  ok(`${lang}: אין מפתחות תרגום שדלפו לממשק`, leaked.length === 0);
  if (leaked.length) console.error("    דלף:", leaked.slice(0, 3));

  // ספירת התגיות "דורש בדיקה ידנית" בטבלה הראשית
  const badge = translateSnippet(lang, "needsReview");
  const badgeCount = html.split(escapeHtml(badge)).length - 1;
  ok(`${lang}: תגית "לבדיקה" מופיעה לכל שורה מסומנת (${badgeCount})`, badgeCount >= review.length);
}

rmSync(tmp, { recursive: true, force: true });

console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור עברו`);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function translateSnippet(lang, which) {
  const map = {
    inferred: { he: "תאריך תחילת ההחזקה משוער", en: "Assignment start date is inferred" },
    needsReview: { he: "דורש בדיקה ידנית", en: "Needs manual review" },
  };
  return map[which][lang];
}
