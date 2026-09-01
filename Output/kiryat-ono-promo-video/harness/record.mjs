// מריץ את הסצנות ומוציא קליפ webm + יומן ביטים לכל אחת.
//
// שימוש:
//   node harness/record.mjs                     כל הסצנות, מעבר רוחבי
//   node harness/record.mjs --only=02-weekly    סצנה אחת (להקלטה חוזרת)
//   node harness/record.mjs --vertical          מעבר אנכי (מקור לחתך 9:16)
//
// הקשר דפדפן נפרד לכל סצנה = קליפ נפרד = יחידת כישלון אחת. סצנה שנפלה מוקלטת
// מחדש לבדה, בלי לגעת בשאר.

import { rename, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { launch, newClip, BASE_URL, settle, assertLocalMode, cueLog } from "./harness.mjs";
import { SCENES } from "./scenes.mjs";

const args = process.argv.slice(2);
const preset = args.includes("--vertical") ? "vertical" : "landscape";
const only = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];

const RAW = path.resolve("raw", preset);
const CUES = path.resolve("work/cues", preset);
await mkdir(RAW, { recursive: true });
await mkdir(CUES, { recursive: true });

const names = only ? [only] : Object.keys(SCENES);
const browser = await launch();
const ctx = {};

for (const name of names) {
  const fn = SCENES[name];
  if (!fn) { console.log("✗ אין סצנה בשם", name); continue; }

  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    const clip = await newClip(browser, { preset, outDir: RAW, name });
    const { context, page, videoDir } = clip;
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await settle(page, 700);
      await assertLocalMode(page);

      const cue = cueLog();
      await fn(page, cue, ctx);
      await settle(page, 400);
      await context.close(); // חייב להיסגר לפני שהווידאו נכתב לדיסק

      const files = await readdir(videoDir);
      const webm = files.find((f) => f.endsWith(".webm"));
      if (!webm) throw new Error("לא נוצר קובץ וידאו");
      await rename(path.join(videoDir, webm), path.join(RAW, `${name}.webm`));
      await cue.save(path.join(CUES, `${name}.json`));
      await rm(path.dirname(videoDir), { recursive: true, force: true }).catch(() => {});

      console.log(`✓ ${name} (${preset}) — ${cue.cues.length} ביטים`);
      ok = true;
    } catch (e) {
      await context.close().catch(() => {});
      await rm(videoDir, { recursive: true, force: true }).catch(() => {});
      console.log(`  ניסיון ${attempt} נכשל ב-${name}: ${e.message}`);
      if (attempt === 2) console.log(`✗ ${name} נכשל`);
    }
  }
}

await browser.close();
console.log("\nקליפים:", RAW);
