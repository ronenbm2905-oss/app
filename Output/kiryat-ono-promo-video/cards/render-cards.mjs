// מרנדר את כל כרטיסי הטקסט ל-PNG דרך Chromium.
//
// למה לא drawtext של ffmpeg: הבילדים הנפוצים של libavfilter נבנים בלי HarfBuzz ובלי
// מעבר bidi, ולכן עברית יוצאת בסדר הפוך. שורה שמערבבת עברית עם ספרות או עם לועזית
// נשברת לגמרי. Chromium עושה bidi מלא, ובנוסף נותן את הטיפוגרפיה של המותג. ffmpeg
// רק מרכיב שכבות.
//
// שימוש: node cards/render-cards.mjs

import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.resolve("cards");
const OUT = path.resolve("work/cards");
await mkdir(OUT, { recursive: true });

const cards = JSON.parse(await readFile(path.join(HERE, "cards.json"), "utf8"));
let contact = { line1: "", line2: "", line3: "" };
try { contact = JSON.parse(await readFile(path.join(HERE, "contact.json"), "utf8")); } catch {}

const SCALE = 1.2; // 1600×900 → 1920×1080 ; 900×1600 → 1080×1920
const SIZES = {
  "16x9": { width: 1600, height: 900 },
  "9x16": { width: 900, height: 1600 },
};

const browser = await chromium.launch();

async function shot(file, params, out, { transparent = false, ratio = "16x9" } = {}) {
  const { width, height } = SIZES[ratio];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: SCALE });
  const url = new URL(pathToFileURL(path.join(HERE, file)));
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  await page.goto(url.href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  // אם הפונט לא נטען הכרטיס יוצא בתיבות ריקות — עדיף להיכשל כאן מאשר בפריים.
  const w = await page.evaluate(() => {
    const el = document.querySelector("h1,h2,.t,#t");
    return el ? el.getBoundingClientRect().width : 1;
  });
  if (!w) throw new Error(`טקסט ריק ב-${file}`);
  await page.screenshot({ path: path.join(OUT, out), omitBackground: transparent });
  await page.close();
  console.log("  ✓", out);
}

for (const ratio of ["16x9", "9x16"]) {
  const suffix = ratio;
  const ltFile = ratio === "16x9" ? "03-lower-third-16x9.html" : "04-lower-third-9x16.html";
  const beatFile = ratio === "16x9" ? "05-beat-16x9.html" : "06-beat-9x16.html";
  const endFile = ratio === "16x9" ? "07-end-16x9.html" : "08-end-9x16.html";

  console.log(`\n[${ratio}]`);
  await shot(cards.title[ratio].file, {}, `title-${suffix}.png`, { ratio });

  for (const b of cards.beats) {
    await shot(beatFile, { n: b.n, of: cards.beats.length, t: b.t, s: b.s },
      `beat-${b.n}-${suffix}.png`, { ratio });
  }

  for (const lt of [...cards.lowerThirds, ...cards.pain]) {
    await shot(ltFile, { k: lt.k ?? "", t: lt.t, s: lt.s ?? "", disc: lt.disc ?? 0 },
      `${lt.id}-${suffix}.png`, { transparent: true, ratio });
  }

  await shot(endFile, {
    t1: cards.end.t1, t2: cards.end.t2, t3: cards.end.t3,
    c1: contact.line1, c2: contact.line2, c3: contact.line3,
  }, `end-${suffix}.png`, { ratio });
}

await browser.close();
const filled = [contact.line1, contact.line2, contact.line3].some(Boolean);
console.log(`\nכרטיסים ב-${OUT}`);
if (!filled) {
  console.log("⚠ cards/contact.json ריק — שקף הסיום רונדר בלי פרטי קשר.");
  console.log("  מלא אותו והרץ שוב את הסקריפט הזה בלבד; אין צורך להקליט מחדש.");
}
