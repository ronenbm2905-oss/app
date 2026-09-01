// מפיק קובץ כתוביות .srt לכל חתך, מהתזמונים שנבנו בפועל.
//
// זו לא נוחות — זו דרישת נגישות. סרטון שקט הוא תוכן video-only, ו-WCAG 2.x
// SC 1.2.1 ברמה A דורש לו חלופה טקסטואלית. הניסוח של הסעיף הזה זהה בין גרסאות
// התקן, ולכן הוא לא תלוי במחלוקת על גרסת ת"י 5568 שרלוונטית.
//
// הכתוביות נגזרות מהקטעים שנבנו ומהקופי ב-cards.json — לא מהערכה של אורך.
//
// שימוש: node build/captions.mjs

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FFPROBE = process.env.FFPROBE_PATH || require("ffprobe-static").path;
const run = promisify(execFile);

const cuts = JSON.parse(await readFile("build/cuts.json", "utf8"));
const cards = JSON.parse(await readFile("cards/cards.json", "utf8"));

const lookup = new Map();
for (const lt of [...cards.lowerThirds, ...cards.pain]) lookup.set(lt.id, lt.t);
for (const b of cards.beats) lookup.set(`beat-${b.n}`, `${b.t} — ${b.s}`);
lookup.set("title", "מועדון נוער שלם. במקום אחד.");
lookup.set("end", `${cards.end.t1} ${cards.end.t2} ${cards.end.t3}`);

const dur = async (f) => {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]);
  return parseFloat(stdout.trim());
};

const stamp = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:` +
         `${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

function textFor(step) {
  if (step.card) return lookup.get(step.card) || "";
  if (step.whatsapp) return "הלוח שנוצר, מוכן לשליחה בקבוצת המאמנים.";
  const id = typeof step.lt === "string" ? step.lt : step.card;
  return lookup.get(id) || "";
}

await mkdir("final", { recursive: true });

for (const [name, cut] of Object.entries(cuts)) {
  if (name.startsWith("_")) continue;
  const segDir = path.join("work/seg", name);
  let files;
  try {
    files = (await readdir(segDir)).filter((f) => /^\d+\.mp4$/.test(f)).sort();
  } catch { continue; }

  const steps = cut.timeline.filter((s) => s.card || s.whatsapp || s.clip || s.over);
  const lines = [];
  let t = 0, n = 0;

  for (const [i, f] of files.entries()) {
    const d = await dur(path.join(segDir, f));
    const txt = textFor(steps[i] || {});
    if (txt) {
      // הכתובית לא נמתחת על כל הקטע: היא נכנסת רבע שנייה אחרי תחילתו ויוצאת
      // לפני סופו, כמו ה-overlay בווידאו עצמו.
      const from = t + 0.3;
      const to = Math.min(t + d - 0.2, from + 5);
      if (to > from) lines.push(`${++n}\n${stamp(from)} --> ${stamp(to)}\n${txt}\n`);
    }
    t += d;
  }

  const out = path.join("final", `${cut.title}.he.srt`);
  await writeFile(out, lines.join("\n"), "utf8");
  console.log(`✓ ${path.basename(out)} — ${n} כתוביות, ${t.toFixed(1)} שנ'`);
}
