// ============================================================================
// render-check.mjs — מרנדר את המסכים באמת (React server render) ובודק שמה
// שיוצא הוא מה שהסקירה המשפטית והאפיון דורשים.
//
// זה תופס: JSX שבור, prop חסר, **מפתח תרגום שלא קיים**, וגילוי משפטי שנעלם
// מהמסך (מונח המקור, תווית תמונת הדגם, ה-disclaimer, אטומיות התעודה).
//
// ⚠️ **אינו תחליף ל-QA בדפדפן.** אין כאן effects, אין לחיצות, אין קונסול
// ואין רשת. הוא הרצפה — לא התקרה.
//
//   npm run render:check
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
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
  mainFields: ["module", "main"],
  conditions: ["import", "module", "default"],
  loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" },
  jsx: "automatic",
  logLevel: "error",
});

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

// אזהרות i18n חסרות נאספות — מפתח חסר הוא כשל, לא הערה.
const missingKeys = [];
const origWarn = console.warn;
console.warn = (...args) => {
  if (String(args[0]).includes("[i18n] missing key")) missingKeys.push(args.join(" "));
  else origWarn(...args);
};

async function renderRoute(hash, { lang = "he" } = {}) {
  globalThis.localStorage = makeStorage();
  globalThis.window = {
    location: { hash, replace() {} },
    history: { length: 1 },
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
  };
  globalThis.document = { documentElement: {}, querySelector: () => null };
  const mod = await import(`${pathToFileURL(join(TMP, "entry.mjs")).href}?v=${Math.random()}`);
  return mod.render(lang);
}

const all = [];
const rec = (html) => {
  all.push(html);
  return html;
};

// ============================================================================
console.log("— בית");
const home = rec(await renderRoute("#/"));
ok("נטען בלי לזרוק", home.length > 500);
ok("כותרת ה-hero מ-settings", home.includes("בשיבוץ שאתם בוחרים"));
ok("שלושת שלבי ההסבר", home.includes("בוחרים דגם") && home.includes("בוחרים יהלום"));
ok("ארבע הקטגוריות", ["טבעות", "עגילים", "שרשראות", "צמידים"].every((c) => home.includes(c)));
ok("★ FAQ מזכיר את פער הערך בין מעבדה לטבעי (A2.6)", home.includes("שווי המכירה החוזרת"));

console.log("— קטלוג");
const catalog = rec(await renderRoute("#/catalog"));
ok("כותרת הקטלוג", catalog.includes("הדגמים"));
ok("★ מוצג מחיר ׳החל מ־׳ מחושב", /החל מ־/.test(catalog));
ok("★ ומוסבר שהוא כולל יהלום (A5.6)", catalog.includes("המחיר כולל יהלום"));
ok("★ תווית תמונת הדגם על התמונה (A1ד)", catalog.includes("תמונת דגם"));
ok("מונה תוצאות עם aria-live", catalog.includes('aria-live="polite"'));
ok("צ׳יפים עם aria-pressed", catalog.includes("aria-pressed"));

console.log("— 🔴 דף דגם + קונפיגורטור");
const model = rec(await renderRoute("#/model/m-r101"));
ok("הדגם נטען", model.includes("סוליטר קלאסי"));
ok("שלושת שלבי הקונפיגורטור", model.includes("גוון המתכת") && model.includes("היהלום"));
ok("פירוק המחיר מוצג", model.includes("שיבוץ בסיסי"));
ok("★ disclaimer הצעת המחיר צמוד לסכום (A5.8א)", model.includes("אינו מהווה הצעה מחייבת"));
ok("★ נאמר שהמחירים כוללים מע״מ (A5)", model.includes("כוללים מע״מ"));
ok("★ ׳מה כלול במחיר׳ מוצג (A5.4)", model.includes("אינו כולל התאמת מידה"));
ok("★ הודעת הוואטסאפ נושאת מפרט מלא (O1)", model.includes("wa.me") && model.includes("%D7%99%D7%94%D7%9C%D7%95%D7%9D"));
ok("★ גילוי שהוואטסאפ הוא פלטפורמת Meta (A7.5)", model.includes("WhatsApp/Meta"));
ok("★ תווית תמונת הדגם בגלריה (A1ד)", model.includes("הפריט מיוצר לפי הזמנה"));
ok("★ שתי הסכמות נפרדות בטופס (A7.1)", model.includes("שתחזרו אליי בנוגע לפנייה זו") && model.includes("עדכונים על קולקציות"));
ok("★ ההסכמות אינן מסומנות מראש", !/type="checkbox"[^>]*checked/.test(model));
ok("★ היידוע צמוד לטופס (O2)", model.includes("המסירה וולונטרית"));
ok("aria-live על הסכום", model.includes('aria-live="polite"'));

console.log("— 🔴 מלאי היהלומים: גילוי מקור וטיפולים");
const diamondsPage = rec(await renderRoute("#/diamonds"));
ok("★ מונח המקור הנגזר לטבעי (A2.2)", diamondsPage.includes("יהלום טבעי"));
ok("★ ומונח המעבדה עם הסיוג (A2.2)", diamondsPage.includes("יהלום מעבדה (Lab-Grown)"));
ok("★ אבן מטופלת מסומנת (A3)", diamondsPage.includes("מילוי סדקים"));
ok("★ מספרי תעודה מוצגים", diamondsPage.includes("IGI-"));
ok("★ אבן שנמכרה אינה מופיעה בקטלוג הפומבי (A4.5)", !diamondsPage.includes("D-1017"));

console.log("— אודות / משפטי");
const about = rec(await renderRoute("#/about"));
ok("FAQ מלא", about.includes("מה זו תעודה גמולוגית"));
ok("★ הסבר על אבן מטופלת (A3)", about.includes("אבן מטופלת"));

const privacy = rec(await renderRoute("#/privacy"));
ok("★ באנר טיוטה כשאין נוסח משפטי", privacy.includes("טרם נכתב ואושר"));

console.log("— אנגלית");
const modelEn = rec(await renderRoute("#/model/m-r101", { lang: "en" }));
ok("★ disclaimer באנגלית", modelEn.includes("not a binding offer"));
ok("אין עברית קשיחה בניווט האנגלי", !modelEn.includes(">בית</a>"));
// מונח המקור מופיע על כרטיסי האבנים — שם הוא הגילוי, לא בדף דגם בלי אבן.
const diamondsEn = rec(await renderRoute("#/diamonds", { lang: "en" }));
ok("★ מונח המעבדה באנגלית (A2.2)", diamondsEn.includes("Lab-Grown Diamond"));
ok("★ ומונח הטבעי באנגלית", diamondsEn.includes("Natural Diamond"));

console.log("— בדיקות רוחב");
for (const html of all) {
  ok("אין undefined בתצוגה", !html.includes(">undefined<"));
  ok("אין NaN בתצוגה", !html.includes(">NaN<"));
  ok("אין [object Object]", !html.includes("[object Object]"));
  ok("אין ₪0 מזויף במקום ׳מחיר בפנייה׳", !html.includes(">₪0<"));
  ok("קישור דילוג לתוכן", /skip to main content|דילוג לתוכן/i.test(html));
}

console.log("— מפתחות i18n");
ok(`אין מפתחות תרגום חסרים${missingKeys.length ? ` (${missingKeys.slice(0, 5).join(" | ")})` : ""}`, missingKeys.length === 0);

// A9.2 — שם המותג ממקור-אמת יחיד.
console.log("— A9: שם המותג");
const { readFileSync, readdirSync, statSync } = await import("node:fs");
function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(f)) out.push(p);
  }
  return out;
}
// ⚠️ `absolut(?!e)` — אחרת כל `class="absolute"` של Tailwind נספר כהיט.
const hits = walk(join(ROOT, "src")).filter((f) =>
  /absolut(?!e)/i.test(readFileSync(f, "utf8"))
);
ok(
  `★ "absolut" מופיע רק ב-brand.js${hits.length ? ` (${hits.map((h) => h.split(/[\\/]/).pop()).join(", ")})` : ""}`,
  hits.length === 1 && hits[0].endsWith("brand.js")
);

rmSync(TMP, { recursive: true, force: true });

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור עברו`);
