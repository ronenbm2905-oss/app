// מפיק מפת תזמונים אמיתית מהחתכים שנבנו בפועל.
//
// למה זה נחוץ: התסריט של שירה נכתב מול מבנה מתוכנן (2:45). האורך בפועל נקבע מהפוטג'
// — כמה זמן באמת לקח למלא טופס, כמה החזיק הספינר של הייצוא. כשהשניים נפרדים,
// הקריינות מדברת על משהו שכבר לא על המסך. הקובץ הזה נגזר מהקטעים שנבנו, ולכן הוא
// המקור לתזמון — לא ההערכה שבתסריט.
//
// שימוש: node build/timing-map.mjs > shira/…/timing.md  (או פשוט להסתכל בפלט)

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FFPROBE = process.env.FFPROBE_PATH || require("ffprobe-static").path;
const run = promisify(execFile);

const cuts = JSON.parse(await readFile("build/cuts.json", "utf8"));

const dur = async (f) => {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]);
  return parseFloat(stdout.trim());
};
const tc = (s) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
};

// תיאור קריא לכל שלב בציר הזמן
function describe(step) {
  if (step.card) return `כרטיס — ${step.card}`;
  if (step.whatsapp) return "הוכחת שיתוף — התמונה בוואטסאפ";
  const clip = step.clip || step.over;
  return `${clip}: ${step.from || "התחלה"} → ${step.to || "…"}${step.lt ? `  [כתובית: ${step.lt}]` : ""}`;
}

for (const [name, cut] of Object.entries(cuts)) {
  if (name.startsWith("_")) continue;
  const segDir = path.join("work/seg", name);
  let files;
  try {
    files = (await readdir(segDir)).filter((f) => /^\d+\.mp4$/.test(f)).sort();
  } catch {
    console.log(`\n## ${cut.title} — לא נבנה עדיין\n`);
    continue;
  }

  console.log(`\n## ${cut.title}\n`);
  console.log("| מ־ | עד | משך | מה על המסך |");
  console.log("|---|---|---|---|");

  let t = 0;
  const steps = cut.timeline.filter((s) => s.card || s.whatsapp || s.clip || s.over);
  for (const [i, f] of files.entries()) {
    const d = await dur(path.join(segDir, f));
    console.log(`| ${tc(t)} | ${tc(t + d)} | ${d.toFixed(1)}s | ${describe(steps[i] || {})} |`);
    t += d;
  }
  console.log(`\n**אורך כולל: ${tc(t)}**`);
}
