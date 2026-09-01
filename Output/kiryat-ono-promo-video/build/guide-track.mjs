// מפיק "רצועת הדרכה" — קריינות סינתטית ממוקמת בטיימקודים האמיתיים.
//
// **זו לא רצועה למשלוח.** espeak קורא עברית לא מנוקדת ולכן מבטא חלק מהמילים
// שגוי, והקול רובוטי. מה שהיא כן נותנת: לשמוע איפה כל משפט נופל ביחס לתמונה,
// ולתרגל את הקצב לפני שמקליטים בקול אמיתי.
//
// שימוש: node build/guide-track.mjs [vertical|short|demo]

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FF = process.env.FFMPEG_PATH || require("ffmpeg-static");
const FFPROBE = process.env.FFPROBE_PATH || require("ffprobe-static").path;
const run = promisify(execFile);

const name = process.argv[2] || "vertical";
const cuts = JSON.parse(await readFile("build/cuts.json", "utf8"));
const cut = cuts[name];
if (!cut) { console.log(`אין חתך ${name}`); process.exit(1); }

// אותה טבלה שמזינה את התסריט — כדי שהרצועה והמסמך לא ייפרדו.
const src = await readFile("build/narration.mjs", "utf8");
const LINES = Object.fromEntries(
  [...src.matchAll(/^\s+"?([\w-]+)"?:\s*"([^"]*)",$/gm)].map((m) => [m[1], m[2]])
);

const dur = async (f) => {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]);
  return parseFloat(stdout.trim());
};

const TMP = path.resolve("work/guide", name);
await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });

const files = (await readdir(path.join("work/seg", name)))
  .filter((f) => /^\d+\.mp4$/.test(f)).sort();
const steps = cut.timeline.filter((s) => s.card || s.whatsapp || s.proof || s.clip || s.over);

const keyFor = (s) =>
  s.vo ? { literal: s.vo } : s.card || s.proof || (s.whatsapp ? "whatsapp" : (typeof s.lt === "string" ? s.lt : null));

let t = 0;
const pieces = [];
for (const [i, f] of files.entries()) {
  const d = await dur(path.join("work/seg", name, f));
  const k = keyFor(steps[i] || {});
  const line = k && k.literal ? k.literal : (k && LINES[k]) || "";
  if (line) {
    const wav = path.join(TMP, `${String(i).padStart(2, "0")}.wav`);
    await run("espeak-ng", ["-v", "he", "-s", "150", "-p", "45", "-w", wav, line]);
    pieces.push({ at: t + 0.15, wav });
  }
  t += d;
}

if (!pieces.length) { console.log("אין שורות קריינות"); process.exit(1); }

// מצע שקט באורך הסרטון, וכל משפט מעורבב לתוכו בזמן שלו.
const inputs = ["-f", "lavfi", "-t", t.toFixed(2), "-i", "anullsrc=r=22050:cl=mono"];
pieces.forEach((p) => inputs.push("-i", p.wav));
const delays = pieces
  .map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[a${i}]`)
  .join(";");
const mix = pieces.map((_, i) => `[a${i}]`).join("");
const out = path.resolve("work/audio", `guide-${name}.mp3`);
await mkdir(path.dirname(out), { recursive: true });

await run(FF, ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
  "-filter_complex",
  `${delays};[0:a]${mix}amix=inputs=${pieces.length + 1}:normalize=0[m];[m]highpass=f=90,dynaudnorm[o]`,
  "-map", "[o]", "-t", t.toFixed(2), "-c:a", "libmp3lame", "-b:a", "112k", out]);

console.log(`✓ ${path.relative(process.cwd(), out)} — ${pieces.length} משפטים על ${t.toFixed(1)} שנ'`);
console.log("  זו רצועת תרגול בלבד: espeak מבטא עברית לא מנוקדת לא מדויק.");
