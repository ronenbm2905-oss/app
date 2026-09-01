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

// שני תוצרים אמיתיים שהאפליקציה ייצרה בהקלטה: לוח המועדון שיוצא לקבוצת המאמנים,
// והדוח השבועי של קבוצה אחת שיוצא להורים. שניהם מוצגים במסגרת שיחה — כי בהדלס
// אין מדף הורדות, והתוצר היה נעלם מהמסך.
const PROOFS = [
  { id: "whatsapp", file: "board.png",
    who: "מאמנים — קרית אונו", cap: "הלו״ז לשבוע הקרוב 🏀" },
  { id: "coach-report", file: "coach-report.png",
    who: "הורים — ילדים א'", cap: "לו״ז האימונים לשבוע הקרוב 🏀" },
];

const SIZES = { "16x9": { width: 1600, height: 900 }, "9x16": { width: 900, height: 1600 } };
const browser = await chromium.launch();

for (const proof of PROOFS) {
  const src = path.resolve("work/downloads", proof.file);
  if (!existsSync(src)) {
    console.log(`  · אין ${proof.file} — מדלגת (הרץ את הסצנה שמייצרת אותו)`);
    continue;
  }
  const dataUri = "data:image/png;base64," + (await readFile(src)).toString("base64");

  for (const [ratio, size] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1.2 });
    const url = new URL(pathToFileURL(path.resolve("cards/whatsapp.html")));
    url.searchParams.set("cap", proof.cap);
    url.searchParams.set("who", proof.who);
    url.searchParams.set("reveal", "1");
    await page.goto(url.href, { waitUntil: "load" });
    await page.evaluate((s2) => { document.getElementById("shot").src = s2; }, dataUri);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      const i = document.getElementById("shot");
      return i && i.complete && i.naturalWidth > 0;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, `${proof.id}-${ratio}.png`) });
    await page.close();
    console.log(`  ✓ ${proof.id}-${ratio}.png`);
  }
}

await browser.close();
console.log("הוכחת השיתוף מוכנה ב-", OUT);
