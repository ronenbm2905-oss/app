// בדיקת שפיות לפני שמצלמים: זורע, נכנס לכל מסך, ומצלם סטילס.
// כאן הסרטון נקבע — אם מסך נראה ריק או שבור בסטילס, הוא ייראה כך גם בווידאו.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { launch, newClip, BASE_URL, settle, wait, assertLocalMode } from "./harness.mjs";

const OUT = path.resolve("work/smoke");

// ניווט: אין סרגל טאבים קבוע — מסך הבית הוא רשת אריחים, וחוזרים אליו בכפתור.
const SCREENS = [
  "לוח שבועי",
  "משחקים",
  "תצוגת מאמן",
  "שחקנים",
  'דו"ח שעות',
  "זמינות מאמנים",
  "סרטוני אימון",
  "ניהול",
];

async function shoot(page, name) {
  await settle(page, 500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("  ✓", name);
}

async function goHome(page) {
  const back = page.getByRole("button", { name: /חזרה לבית/ });
  if (await back.count()) {
    await back.first().click();
    await settle(page, 400);
  }
}

const preset0 = process.argv.includes("--vertical") ? "vertical" : "landscape";
const browser = await launch(preset0);
const preset = preset0;
const { context, page } = await newClip(browser, { preset, outDir: OUT, name: "smoke" });

await mkdir(OUT, { recursive: true });
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await settle(page, 800);

await assertLocalMode(page);
console.log("✓ מצב מקומי מאומת, הזריעה נקלטה");

// הבאנר הצהוב חייב להיעלם — הוא הדבר שהכי מהר שורף אמינות בסרטון מכירה.
const banner = await page.locator("p", { hasText: "⚠ מצב מקומי" }).count();
console.log(banner === 0 ? "✓ באנר מצב מקומי מוסתר" : `✗ הבאנר עדיין על המסך (${banner})`);

await shoot(page, `00-home-${preset}`);

for (const [i, label] of SCREENS.entries()) {
  await goHome(page);
  const tile = page.getByRole("button").filter({ hasText: label }).first();
  if (!(await tile.count())) { console.log("  ✗ לא נמצא אריח:", label); continue; }
  await tile.click();
  await wait(600);
  await shoot(page, `${String(i + 1).padStart(2, "0")}-${label.replace(/[״"']/g, "")}-${preset}`);
}

await context.close();
await browser.close();
console.log("\nסטילס נשמרו ב-", OUT);
