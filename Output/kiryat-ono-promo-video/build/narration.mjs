// מפיק תסריט קריינות מתוזמן לכל חתך, מהקטעים שנבנו בפועל.
//
// למה נגזר ולא נכתב ביד: אורך כל קטע נקבע מהפוטג' — כמה זמן באמת לקח למלא טופס,
// כמה החזיק הספינר של הייצוא. תסריט שנכתב מול מבנה מתוכנן סוטה מהתמונה כבר
// בביט השני. כאן כל חלון זמן הוא החלון האמיתי.
//
// לכל שורה מחושב תקציב מילים לפי ~2.6 מילים/שנייה בעברית מדוברת, ומסומן אם
// הטקסט חורג מהחלון.
//
// שימוש: node build/narration.mjs

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FFPROBE = process.env.FFPROBE_PATH || require("ffprobe-static").path;
const run = promisify(execFile);

const WPS = 2.6; // מילים לשנייה — קצב דיבור נינוח בעברית

const cuts = JSON.parse(await readFile("build/cuts.json", "utf8"));
const cards = JSON.parse(await readFile("cards/cards.json", "utf8"));

// טקסט הקריינות לכל ביט. זה לא הכתובית — הכתובית היא הכותרת, הקריינות ההסבר.
const LINES = {
  title: "מועדון נוער שלם. במקום אחד.",
  "beat-1": "הכול מתחיל בלוח השבועי.",
  "beat-2": "ומשם, המשחקים וההסעות.",
  "beat-3": "לכל מאמן מסך משלו.",
  "beat-4": "ומאחורי הקלעים — הניהול.",
  "lt-constraints-1": "מאמן שלא פנוי, אולם שמושכר בערב.",
  "lt-constraints-2": "רושמים אותם פעם אחת, והמערכת זוכרת אותם כל שבוע מחדש.",
  "lt-weekly-1": "כאן הלוח נבנה. קבוצה, מאמן, אולם, שעה.",
  "lt-weekly-2": "מאמן לא זמין? מסומן לפני שהלוח יוצא.",
  "lt-weekly-3": "רוב השבועות חוזרים על עצמם, אז אפשר לשכפל את השבוע הקודם.",
  "lt-share": "וכשהלוח מוכן — לחיצה אחת, והוא יוצא כתמונה.",
  whatsapp: "זה מה שנוחת בקבוצת המאמנים.",
  "lt-games-1": "לוח המשחקים מגיע מקובץ האיגוד.",
  "lt-games-2": "המערכת מראה בדיוק מה השתנה, ואתה רק מאשר.",
  "lt-transport": "ולכל משחק חוץ — רשימת הסעות מלאה.",
  "lt-coach-1": "המאמן נכנס ורואה רק את השבוע שלו.",
  "lt-coach-2": "את מערך האימון הוא כותב כאן.",
  "lt-sketch": "ואת התרגיל הוא פשוט מצייר על המגרש.",
  "lt-coach-report": "ובסוף — הלוח של הקבוצה שלו יוצא להורים.",
  "coach-report": "בדיוק ככה, ישירות לקבוצת ההורים.",
  "lt-players": "רשימות השחקנים מיובאות מאקסל.",
  "lt-availability": "היעדרות של מאמן נרשמת פעם אחת ומופיעה מיד בלוח.",
  "lt-report": "ובסוף החודש — דוח שעות לפי מאמן.",
  "lt-disclaimer": "",
  "pain-1": "כל שינוי מתחיל סבב הודעות.",
  end: "רוצה לראות אותה על הלוח שלך?",
};

const dur = async (f) => {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]);
  return parseFloat(stdout.trim());
};
const tc = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function keyFor(step) {
  if (step.card) return step.card;
  if (step.proof) return step.proof;
  if (step.whatsapp) return "whatsapp";
  return typeof step.lt === "string" ? step.lt : null;
}

await mkdir("work", { recursive: true });
const out = [];

for (const [name, cut] of Object.entries(cuts)) {
  if (name.startsWith("_")) continue;
  let files;
  try {
    files = (await readdir(path.join("work/seg", name))).filter((f) => /^\d+\.mp4$/.test(f)).sort();
  } catch { continue; }

  const steps = cut.timeline.filter((s) => s.card || s.whatsapp || s.proof || s.clip || s.over);
  const rows = [];
  let t = 0, over = 0, words = 0;

  for (const [i, f] of files.entries()) {
    const d = await dur(path.join("work/seg", name, f));
    const key = keyFor(steps[i] || {});
    const line = (key && LINES[key]) || "";
    if (line) {
      const w = line.split(/\s+/).filter(Boolean).length;
      const budget = Math.floor(d * WPS);
      const tight = w > budget;
      if (tight) over++;
      words += w;
      rows.push(`| ${tc(t)} | ${d.toFixed(1)}s | ${line} | ${w}/${budget}${tight ? " ⚠" : ""} |`);
    } else {
      rows.push(`| ${tc(t)} | ${d.toFixed(1)}s | *(שקט)* | — |`);
    }
    t += d;
  }

  out.push(`\n## ${cut.title}\n`);
  out.push(`**אורך: ${tc(t)}** · ${words} מילים · קצב יעד ${WPS} מילים/שנייה\n`);
  out.push("| מ־ | חלון | קריינות | מילים/תקציב |");
  out.push("|---|---|---|---|");
  out.push(...rows);
  if (over) out.push(`\n> ⚠ ${over} שורות חורגות מהחלון. קצר אותן או דבר מהר יותר.\n`);
  console.log(`✓ ${cut.title} — ${tc(t)}, ${words} מילים${over ? `, ${over} חריגות` : ""}`);
}

const header = `# תסריט קריינות — מתוזמן לחתכים שנבנו

נגזר מ-\`work/seg/\` ב-\`node build/narration.mjs\`. **אל תערוך ידנית** — הרץ מחדש
אחרי כל שינוי בעריכה.

## איך מקליטים

1. פתח את הסרטון השקט מ-\`final/\` על מסך אחד ואת הטבלה הזאת על השני.
2. הקלט ברצף אחד, בטלפון או במחשב — לא צריך אולפן. חדר שקט, המכשיר במרחק
   טפח מהפה, בלי מאוורר ברקע.
3. **התחל לדבר בדיוק עם תחילת הסרטון.** העמודה "מ־" היא הזמן מתחילת הקובץ.
4. שמור בשם החתך ב-\`audio/\`: \`demo\`, \`short\`, או \`vertical\`.
5. \`node build/assemble.mjs\` — והקול נכנס פנימה. אין צורך לצלם מחדש.

עמודת "מילים/תקציב" אומרת כמה מילים יש בשורה מול כמה נכנסות בנוחות בחלון.
סימון ⚠ = השורה צפופה.
`;

await writeFile("work/narration.md", header + out.join("\n") + "\n", "utf8");
console.log("\nנשמר ב- work/narration.md");
