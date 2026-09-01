// מרנדר את תסריט הקריינות ל-PDF להדפסה ולקריאה מהמסך בזמן ההקלטה.
//
// למה PDF ולא Markdown: קובץ .md לא נפתח בכל קליינט, ודף הקלטה שאי אפשר לפתוח
// הוא דף הקלטה שלא קיים. PDF נפתח בכל מקום וגם מודפס.
//
// שימוש: node build/narration-pdf.mjs

import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const md = await readFile("work/narration.md", "utf8");
await mkdir("final", { recursive: true });

// פירוק הטבלאות של narration.md לכדי מבנה — שורה אחת לכל כניסת קריינות.
const cuts = [];
let cur = null;
for (const line of md.split("\n")) {
  const h = line.match(/^## (.+)$/);
  if (h) { cur = { title: h[1].trim(), meta: "", rows: [] }; cuts.push(cur); continue; }
  if (!cur) continue;
  const m = line.match(/^\*\*אורך: (.+?)\*\* · (\d+) מילים/);
  if (m) { cur.meta = `${m[1]} · ${m[2]} מילים`; continue; }
  if (!line.startsWith("|") || line.startsWith("|---") || line.includes("מ־")) continue;
  const c = line.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
  if (c.length < 4) continue;
  cur.rows.push({ t: c[0], win: c[1], line: c[2], budget: c[3] });
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const body = cuts.filter((c) => c.rows.length).map((c) => `
  <section>
    <h2>${esc(c.title)}</h2>
    <p class="meta">${esc(c.meta)}</p>
    ${c.rows.map((r) => r.line === "*(שקט)*" ? `
      <div class="row silent">
        <div class="t">${esc(r.t)}</div>
        <div class="body"><em>שקט — ${esc(r.win)}. אל תמלא; תן לתמונה לעבוד.</em></div>
      </div>` : `
      <div class="row">
        <div class="t">${esc(r.t)}<span class="win">${esc(r.win)}</span></div>
        <div class="body">
          <p class="say">${esc(r.line)}</p>
          <span class="bud">${esc(r.budget)} מילים</span>
        </div>
      </div>`).join("")}
  </section>`).join("");

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="../cards/fonts/heebo.css">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Heebo,Arial,sans-serif;color:#122A50;line-height:1.5;font-size:12pt}
  h1{font-size:22pt;font-weight:800;margin-bottom:4mm}
  .lede{font-size:11pt;color:#41506b;margin-bottom:3mm}
  .how{background:#F2F6FC;border-inline-start:4px solid #F58634;
       padding:4mm 5mm;border-radius:3mm;margin-bottom:8mm;font-size:10.5pt}
  .how ol{margin:2mm 5mm 0 0}
  .how li{margin-bottom:1.5mm}
  code{background:#e6ecf6;padding:.5mm 1.5mm;border-radius:1.5mm;font-size:10pt}
  section{margin-bottom:9mm;break-inside:auto}
  h2{font-size:14pt;font-weight:800;border-bottom:2px solid #F58634;
     padding-bottom:1.5mm;margin-bottom:1mm}
  .meta{font-size:10pt;color:#5b6a86;margin-bottom:4mm}
  .row{display:flex;gap:5mm;padding:2.5mm 0;border-bottom:1px solid #e3e9f3;
       break-inside:avoid;align-items:baseline}
  .t{flex:0 0 26mm;font-weight:800;font-size:11pt;font-variant-numeric:tabular-nums}
  .win{display:block;font-weight:500;font-size:8.5pt;color:#7b88a1}
  .body{flex:1}
  .say{font-size:13.5pt;font-weight:600;line-height:1.45}
  .bud{font-size:8.5pt;color:#7b88a1}
  .silent .body{color:#8b97ad;font-size:11pt}
</style></head><body>
  <h1>תסריט קריינות — סרטון מערכת שעות אימוני הכדורסל</h1>
  <p class="lede">קרית אונו — דור העתיד · הטקסט לקריאה בקול מול הסרטון השקט</p>
  <div class="how">
    <strong>איך מקליטים</strong>
    <ol>
      <li>פתח את הסרטון השקט מ-<code>final/</code> ואת הדף הזה זה לצד זה.</li>
      <li>הקלט ברצף אחד — טלפון בחדר שקט מספיק. בלי מאוורר ומזגן ברקע.</li>
      <li><strong>התחל לדבר בדיוק עם תחילת הסרטון.</strong> עמודת הזמן היא מתחילת הקובץ.</li>
      <li>שמור כ-<code>audio/short.m4a</code> או <code>audio/demo.m4a</code>.</li>
      <li>הרץ <code>node build/assemble.mjs</code> — והקול נכנס פנימה. אין צורך לצלם מחדש.</li>
    </ol>
  </div>
  ${body}
</body></html>`;

const tmp = path.resolve("work/narration.html");
await (await import("node:fs/promises")).writeFile(tmp, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + tmp, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const out = path.resolve("final", "תסריט-קריינות.pdf");
await page.pdf({ path: out, format: "A4", printBackground: true });
await browser.close();

console.log(`✓ ${path.relative(process.cwd(), out)}`);
console.log(`  (גם ${path.relative(process.cwd(), tmp)} — נפתח בכל דפדפן)`);
