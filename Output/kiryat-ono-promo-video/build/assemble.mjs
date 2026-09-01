// מרכיב את שלושת החתכים מהקליפים הגולמיים, מכרטיסי הטקסט ומדף ההוכחה.
//
// שימוש: node build/assemble.mjs [demo|short|vertical ...]
//
// שלושה עקרונות:
// 1. כל קטע נבחר לפי תוויות ביט, לא לפי סטופר. הקלטה חוזרת לא שוברת את החיתוך.
// 2. כל קליפ מנורמל קודם ל-CFR: הווידאו של Playwright הוא VP8 בתזמון משתנה, ושרשור
//    או xfade על מקור כזה מייצר גמגום וסחיפה.
// 3. כל הטקסט מגיע כ-PNG מרונדר. ffmpeg רק מרכיב שכבות — הוא לא מרנדר עברית.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FF = process.env.FFMPEG_PATH || require("ffmpeg-static");
const FFPROBE = process.env.FFPROBE_PATH || require("ffprobe-static").path;
const run = promisify(execFile);
const sh = (args, label) =>
  run(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 28 })
    .catch((e) => { throw new Error(`ffmpeg נכשל ב-${label}:\n${String(e.stderr || e).slice(-1500)}`); });

const ROOT = path.resolve(".");
const WORK = path.join(ROOT, "work");
const SEG = path.join(WORK, "seg");
const FINAL = path.join(ROOT, "final");
const FPS = 30;

const cuts = JSON.parse(await readFile(path.join(ROOT, "build/cuts.json"), "utf8"));
const DELIVER = { "16x9": [1920, 1080], "9x16": [1080, 1920] };

async function duration(file) {
  const { stdout } = await run(FFPROBE, [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  return parseFloat(stdout.trim());
}

const cueCache = new Map();
async function cues(preset, clip) {
  const key = `${preset}/${clip}`;
  if (!cueCache.has(key)) {
    const f = path.join(WORK, "cues", preset, `${clip}.json`);
    cueCache.set(key, JSON.parse(await readFile(f, "utf8")));
  }
  return cueCache.get(key);
}

async function span(preset, clip, from, to, max) {
  const list = await cues(preset, clip);
  const at = (label) => {
    const hit = list.find((c) => c.label === label);
    if (!hit) throw new Error(`אין ביט "${label}" ב-${clip} (${preset})`);
    return hit.t;
  };
  const start = from ? at(from) : 0;
  let end = to ? at(to) : start + (max || 8);
  if (max && end - start > max) end = start + max;
  return { start: Math.max(0, start - 0.25), end: end + 0.25 };
}

// ---------- קטעים ----------
async function clipSegment(preset, ratio, clip, start, end, out) {
  const [W, H] = DELIVER[ratio];
  const src = path.join(ROOT, "raw", preset, `${clip}.webm`);
  if (!existsSync(src)) throw new Error(`חסר קליפ: ${src}`);
  await sh([
    "-ss", String(start), "-to", String(end), "-i", src,
    "-vf", `fps=${FPS},scale=${W}:${H}:flags=lanczos,setsar=1,format=yuv420p`,
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-an", out,
  ], `קטע ${clip}`);
}

async function stillSegment(png, ratio, seconds, out, { fadeIn = 0.35, fadeOut = 0.35 } = {}) {
  const [W, H] = DELIVER[ratio];
  const d = Number(seconds.toFixed(2));
  await sh([
    "-loop", "1", "-t", String(d), "-i", png,
    "-vf",
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x122A50,` +
    `fps=${FPS},setsar=1,format=yuv420p,` +
    `fade=in:st=0:d=${fadeIn},fade=out:st=${(d - fadeOut).toFixed(2)}:d=${fadeOut}`,
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-an", out,
  ], `כרטיס ${path.basename(png)}`);
}

// כתובית תחתונה: PNG שקוף שנכנס ויוצא ב-fade מעל הפוטג'.
async function overlayLowerThird(base, png, ratio, out) {
  const d = await duration(base);
  const inAt = 0.6;
  const dur = Math.min(4.6, Math.max(2.4, d - inAt - 0.8));
  const outAt = Math.min(d - 0.4, inAt + dur);
  // ‎`-loop 1` על ה-PNG הוא זרם אינסופי. בלי `shortest=1` ה-overlay ממשיך לייצר
  // פריימים גם אחרי שהפוטג' נגמר, ו-ffmpeg כותב קובץ שגדל בלי גבול — נתקלנו בזה:
  // 48MB ועוד, שתים-עשרה דקות, על קטע של שלוש שניות. ‎`-t` על הקלט וגם על הפלט
  // אינם מספיקים; מה שעוצר את זה הוא `shortest=1` על הפילטר עצמו.
  await sh([
    "-i", base, "-loop", "1", "-t", d.toFixed(2), "-i", png,
    "-filter_complex",
    `[1:v]format=rgba,fade=in:st=0:d=0.32:alpha=1,` +
    `fade=out:st=${(outAt - inAt - 0.32).toFixed(2)}:d=0.32:alpha=1,` +
    `setpts=PTS-STARTPTS+${inAt}/TB[lt];` +
    `[0:v][lt]overlay=0:0:shortest=1:enable='between(t,${inAt},${outAt.toFixed(2)})'[v]`,
    "-map", "[v]", "-t", d.toFixed(2),
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-an", out,
  ], `כתובית ${path.basename(png)}`);
}

// ---------- הרכבה ----------
async function buildCut(name) {
  const cut = cuts[name];
  if (!cut) throw new Error(`אין חתך בשם ${name}`);
  const { preset, ratio } = cut;
  const dir = path.join(SEG, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await mkdir(FINAL, { recursive: true });

  const cards = path.join(WORK, "cards");
  const parts = [];

  for (const [i, step] of cut.timeline.entries()) {
    const n = String(i).padStart(2, "0");
    let seg = path.join(dir, `${n}.mp4`);

    if (step.card) {
      const png = path.join(cards, `${step.card}-${ratio}.png`);
      if (!existsSync(png)) { console.log(`  · דילוג על כרטיס חסר ${step.card}`); continue; }
      await stillSegment(png, ratio, step.hold ?? 2.2, seg);
    } else if (step.whatsapp || step.proof) {
      const id = step.proof || "whatsapp";
      const png = path.join(WORK, "proof", `${id}-${ratio}.png`);
      if (!existsSync(png)) { console.log(`  · אין הוכחה ${id} — מדלגת`); continue; }
      await stillSegment(png, ratio, step.hold ?? 3.5, seg, { fadeIn: 0.4, fadeOut: 0.4 });
    } else if (step.clip || step.over) {
      const clip = step.clip || step.over;
      const { start, end } = await span(preset, clip, step.from, step.to, step.max);
      const raw = path.join(dir, `${n}-raw.mp4`);
      await clipSegment(preset, ratio, clip, start, end, raw);
      const ltName = step.lt && typeof step.lt === "string" ? step.lt : step.card;
      const ltPng = ltName ? path.join(cards, `${ltName}-${ratio}.png`) : null;
      if (ltPng && existsSync(ltPng)) {
        await overlayLowerThird(raw, ltPng, ratio, seg);
      } else {
        seg = raw;
      }
    } else continue;

    parts.push(seg);
    process.stdout.write(".");
  }

  if (!parts.length) throw new Error(`לא נבנה אף קטע ל-${name}`);

  const listFile = path.join(dir, "list.txt");
  await writeFile(listFile, parts.map((p) => `file '${p}'`).join("\n"), "utf8");

  const [W, H] = DELIVER[ratio];
  const out = path.join(FINAL, `${cut.title}.mp4`);

  // קריינות: מחפשים audio/<שם-החתך>.(m4a|mp3|wav|aac|ogg). אם יש — ממסכנים אותה
  // לתוך הקובץ הסופי; אם אין — הסרטון יוצא שקט, בדיוק כמו קודם. כך אפשר להקליט
  // את הקול פעם אחת ולקבל את הגרסה המדוברת בפקודה אחת, בלי לצלם מחדש.
  const audio = ["m4a", "mp3", "wav", "aac", "ogg"]
    .map((e) => path.join(ROOT, "audio", `${name}.${e}`))
    .find((f) => existsSync(f));

  const vArgs = [
    "-f", "concat", "-safe", "0", "-i", listFile,
    ...(audio ? ["-i", audio] : []),
    "-vf", `scale=${W}:${H},setsar=1,format=yuv420p`,
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.2",
    "-preset", "slow", "-crf", "20",
    "-r", String(FPS), "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
    "-movflags", "+faststart",
  ];
  // -shortest חותך לאורך הווידאו: קריינות ארוכה מדי לא תמתח את הסרטון, וקצרה
  // מדי פשוט תיגמר מוקדם. אין כאן ניסיון "למתוח" — התסריט מתוזמן לחתך.
  const aArgs = audio
    ? ["-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000", "-shortest"]
    : ["-an"];
  await sh([...vArgs, ...aArgs, out], `קידוד סופי ${name}`);
  if (audio) console.log(`  ♪ קריינות: ${path.relative(ROOT, audio)}`);

  // פוסטר לדף נחיתה / תצוגה מקדימה בפיד
  await sh(["-ss", "2.2", "-i", out, "-frames:v", "1", "-q:v", "2",
    path.join(FINAL, `${cut.title}-poster.jpg`)], "פוסטר");

  const d = await duration(out);
  console.log(`\n✓ ${cut.title}.mp4 — ${d.toFixed(1)} שנ'`);
  return { file: out, seconds: d };
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cuts).filter((k) => !k.startsWith("_"));
const results = [];
for (const n of names) {
  console.log(`\n[${n}]`);
  results.push(await buildCut(n));
}
console.log("\nמוכן ב-", FINAL);
