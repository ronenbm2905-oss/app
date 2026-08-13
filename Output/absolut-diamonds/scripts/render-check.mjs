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

// ============================================================================
// 🔴 A1(ד) — ארבעת התנאים, כאסרשנים.
//
// המקור: `src/utils/disclosure.js` (הקבועים) → הרכיבים פולטים אותם כ-
// `data-a1d-*` → כאן בודקים על ה-HTML האמיתי.
//
// ⚠️ מגבלה מוצהרת: רינדור סטטי אינו מודד פריסה. תנאי 4 נבדק כ**צעד ריווח
// מוצהר** בין בלוק התמונה (שהתווית היא שוליו התחתונים) לבלוק הטקסט שנושא
// את המחיר, ולא כמדידת פיקסלים. מדידה אמיתית מחייבת דפדפן.
// ============================================================================
console.log("— 🔴 A1(ד): תווית הגילוי מול המחיר");

const attrOf = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const tagsWith = (html, re) => [...html.matchAll(re)].map((m) => m[0]);

// -- ניגודיות אמיתית, לא הצהרה --
const srgb = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// שכבה שקופה מעל רקע — כאן: ה-scrim מעל **הפיקסל הבהיר ביותר האפשרי** בצילום.
const composite = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

const labelTags = tagsWith(catalog, /<span[^>]*data-a1d="label"[^>]*>/g);
const priceTags = tagsWith(catalog, /<p[^>]*data-a1d="price"[^>]*>/g);
const clusterTags = tagsWith(catalog, /<a[^>]*data-a1d-cluster="1"[^>]*>/g);

ok("★ קיים לפחות אשכול תווית+מחיר אחד בקטלוג", clusterTags.length > 0);
ok(
  "★ לכל אשכול יש גם תווית וגם מחיר",
  labelTags.length >= clusterTags.length && priceTags.length >= clusterTags.length
);

const labelSize = Number(attrOf(labelTags[0] || "", "data-a1d-size"));
const labelWeight = Number(attrOf(labelTags[0] || "", "data-a1d-weight"));
const priceSize = Number(attrOf(priceTags[0] || "", "data-a1d-size"));
const priceWeight = Number(attrOf(priceTags[0] || "", "data-a1d-weight"));

// (1) גודל
ok(
  `★ A1ד(1) גודל התווית ≥ 0.8× המחיר (${labelSize}/${priceSize} = ${(labelSize / priceSize).toFixed(2)})`,
  labelSize > 0 && priceSize > 0 && labelSize / priceSize >= 0.8
);
// (2) משקל
ok(
  `★ A1ד(2) משקל התווית ≥ משקל המחיר (${labelWeight} ≥ ${priceWeight})`,
  labelWeight > 0 && priceWeight > 0 && labelWeight >= priceWeight
);
// (3) ניגודיות — סף מוחלט, מחושב מול הפיקסל הבהיר ביותר שיכול להיות מתחת ל-scrim
let labelContrast = 0;
if (labelTags[0]) {
  const fg = rgb(attrOf(labelTags[0], "data-a1d-fg"));
  const scrim = rgb(attrOf(labelTags[0], "data-a1d-bg"));
  const alpha = Number(attrOf(labelTags[0], "data-a1d-alpha"));
  labelContrast = contrast(fg, composite(scrim, [255, 255, 255], alpha));
}
ok(
  `★ A1ד(3) ניגודיות התווית ≥ 7:1 מעל הפיקסל הבהיר ביותר (${labelContrast.toFixed(2)}:1)`,
  labelContrast >= 7
);
// (4) מרחק
const gaps = clusterTags.map((c) => Number(attrOf(c, "data-a1d-gap")));
ok(
  `★ A1ד(4) המרחק המוצהר בין התווית למחיר ≤ 12px (${gaps.join(", ") || "—"})`,
  gaps.length > 0 && gaps.every((g) => Number.isFinite(g) && g <= 12)
);
// והתווית קיימת גם בדף הדגם, באותם טוקנים
ok(
  "★ אותה תווית, באותם טוקנים, גם בדף הדגם",
  model.includes('data-a1d="label"') &&
    model.includes(`data-a1d-size="${labelSize}"`) &&
    model.includes(`data-a1d-weight="${labelWeight}"`)
);

// ============================================================================
// ניגודיות הפלטה — הערכים שהשפה מבטיחה, מחושבים ולא מועתקים.
// ============================================================================
console.log("— ניגודיות הפלטה");
const PAPER = "#F7F7F7";
const ALT = "#EDE8E0";
const SURFACE = "#FFFFFF";
const ratio = (a, b) => contrast(rgb(a), rgb(b));

for (const [bgName, bg] of [
  ["paper", PAPER],
  ["alt", ALT],
  ["surface", SURFACE],
]) {
  ok(`muted #63605A על ${bgName} ≥ 4.5 (${ratio("#63605A", bg).toFixed(2)})`, ratio("#63605A", bg) >= 4.5);
}
ok(`ink80 על paper ≥ 4.5 (${ratio("#45413D", PAPER).toFixed(2)})`, ratio("#45413D", PAPER) >= 4.5);
ok(`goldInk על paper ≥ 4.5 (${ratio("#7A5F35", PAPER).toFixed(2)})`, ratio("#7A5F35", PAPER) >= 4.5);
ok(`danger על paper ≥ 4.5 (${ratio("#8A2C22", PAPER).toFixed(2)})`, ratio("#8A2C22", PAPER) >= 4.5);
ok(`paper על ink ≥ 4.5 (${ratio("#F7F7F7", "#14110F").toFixed(2)})`, ratio("#F7F7F7", "#14110F") >= 4.5);
// WCAG 1.4.11 — גבול רכיב אינטראקטיבי, סף 3:1
ok(
  `lineStrong כגבול רכיב ≥ 3 על paper/alt (${ratio("#837E77", PAPER).toFixed(2)} / ${ratio("#837E77", ALT).toFixed(2)})`,
  ratio("#837E77", PAPER) >= 3 && ratio("#837E77", ALT) >= 3
);
// ההיפוך — התיעוד של **למה** `line` אסור כגבול רכיב
ok(
  `line #E2E0DC נכשל ב-1.4.11 ולכן אינו גבול רכיב (${ratio("#E2E0DC", PAPER).toFixed(2)} < 3)`,
  ratio("#E2E0DC", PAPER) < 3
);

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

// ============================================================================
// שומרי שפת העיצוב — "נייר אחד, דיו אחד, קו אחד" נאכף בקוד, לא בזיכרון.
// כל אחד מאלה הוא כלל מפורש ב-§6 "מה לא לעשות".
// ============================================================================
console.log("— שומרי שפת העיצוב");
const SRC = walk(join(ROOT, "src"));
const CSS = readFileSync(join(ROOT, "src", "index.css"), "utf8");
const isAdmin = (f) => f.endsWith("AdminPage.jsx");

// בכל ה-hits מתעלמים משורות הערה — הן מתעדות מה **ירד**, וזה רצוי.
function hitsFor(re, { skipAdmin = false } = {}) {
  const out = [];
  for (const f of SRC) {
    if (skipAdmin && isAdmin(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const code = line.replace(/\/\/.*$/, "").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
      // ⚠️ שומרים את השורה **המלאה** לבדיקה, ומקצרים רק לתצוגה — אחרת
      // אסרשן כמו "מופיע רק עם uppercase" נכשל על חיתוך המחרוזת ולא על הקוד.
      if (re.test(code)) out.push({ file: f.split(/[\\/]/).pop(), code: code.trim() });
    }
  }
  return out;
}
const show = (hits) => (hits.length ? ` (${hits[0].file}: ${hits[0].code.slice(0, 60)})` : "");

const shadowHits = hitsFor(/\bshadow-(sm|md|lg|xl|2xl|inner|card|sheet)\b/);
ok(`★ אין צללים בשום קומפוננטה${show(shadowHits)}`, shadowHits.length === 0);

const radiusHits = hitsFor(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
ok(`★ radius 0 — אין rounded פרט ל-none/pill${show(radiusHits)}`, radiusHits.length === 0);

// פלטת ברירת המחדל של Tailwind עדיין קיימת (rose/amber/red...) — כלומר
// `text-rose-700` שנשכח **לא** היה נשבר, רק מחזיר ורוד לאתר בשקט.
const paletteHits = hitsFor(
  /\b(bg|text|border|ring|divide|outline|accent|from|to|via)-(rose|pink|amber|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|red|slate|gray|zinc|neutral|stone)-\d{2,3}\b/
);
ok(`★ אין צבע מפלטת ברירת המחדל של Tailwind${show(paletteHits)}`, paletteHits.length === 0);

const cardHits = hitsFor(/className="[^"]*\bcard\b/);
ok(`★ ‎.card נמחק${show(cardHits)}`, cardHits.length === 0 && !/\.card\s*\{/.test(CSS));

// 1.4.11 — גבול של רכיב אינטראקטיבי חייב להיות `line.strong`.
ok("★ גבול ה-input הוא line.strong ולא line", /\.input\s*\{[\s\S]*?border-line-strong/.test(CSS));
// המצב הלא-נבחר של Chip ושל Selector. `border-line` עצמו מותר במקום
// דקורטיבי (טבעת ה-Spinner), ולכן הבדיקה ממוקדת בשורות של הרכיבים האלה.
const unselected = hitsFor(/hover:border-ink-80/);
ok(
  `★ צ׳יפ/בורר לא-נבחר משתמשים ב-line.strong${show(unselected)}`,
  unselected.length >= 2 && unselected.every((h) => h.code.includes("border-line-strong"))
);

// משקל 200 מתפורר בעברית מתחת ל-44px.
const w200 = hitsFor(/font-extralight/);
ok(
  `★ משקל 200 מופיע רק לצד גודל ≥44px${show(w200)}`,
  w200.every((h) => h.code.includes("display1Lg"))
);

// tracking רחב הוא מנגנון לטיני — בעברית הוא מפרק מילים.
const enTracking = hitsFor(/tracking-(enLabel|enSection|wordmarkEn)/);
ok(
  `★ tracking לטיני מופיע רק עם uppercase${show(enTracking)}`,
  enTracking.every((h) => h.code.includes("uppercase"))
);

// `Notice tone="warn"` הענבר הוחלף ב-`.flag` — באתר הפומבי, לא באדמין.
const warnHits = hitsFor(/tone="warn"/, { skipAdmin: true });
ok(
  `★ אין Notice tone="warn" באתר הפומבי${warnHits.length ? ` (${warnHits[0]})` : ""}`,
  warnHits.length === 0
);

rmSync(TMP, { recursive: true, force: true });

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור עברו`);
