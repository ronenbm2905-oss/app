// מרנדר את דף ההוכחה: התמונה שהאפליקציה באמת ייצרה, בתוך מסגרת שיחה.
//
// הצורך: בהדלס אין מדף הורדות ואין navigator.share, ולכן הלחיצה על "שיתוף / שמירת
// תמונה" מסתיימת בספינר והתוצר נעלם. הוא הביט הכי משכנע בסרטון, ואי אפשר להשאיר
// אותו בלי פאנץ' ויזואלי. התמונה כאן היא הקובץ שירד בפועל מההקלטה — לא מוקאפ.

import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUT = path.resolve("work/proof");
await mkdir(OUT, { recursive: true });

const board = path.resolve("work/downloads/board.png");
if (!existsSync(board)) {
  console.log("✗ אין work/downloads/board.png — הרץ קודם את סצנת הלוח השבועי.");
  process.exit(1);
}
const dataUri = "data:image/png;base64," + (await readFile(board)).toString("base64");

const SIZES = { "16x9": { width: 1600, height: 900 }, "9x16": { width: 900, height: 1600 } };
const browser = await chromium.launch();

for (const [ratio, size] of Object.entries(SIZES)) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1.2 });
  const url = new URL(pathToFileURL(path.resolve("cards/whatsapp.html")));
  url.searchParams.set("cap", "הלו״ז לשבוע הקרוב 🏀");
  url.searchParams.set("reveal", "1");
  await page.goto(url.href, { waitUntil: "load" });
  await page.evaluate((src) => { document.getElementById("shot").src = src; }, dataUri);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const i = document.getElementById("shot");
    return i && i.complete && i.naturalWidth > 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `whatsapp-${ratio}.png`) });
  await page.close();
  console.log("  ✓ whatsapp-" + ratio + ".png");
}

await browser.close();
console.log("הוכחת השיתוף מוכנה ב-", OUT);
