// ============================================================================
// emu.mjs — מריץ פקודה **בתוך** אמולטורי Firebase (Auth + Firestore + Storage).
//
//   node scripts/emu.mjs "node scripts/rules-tests.mjs"
//
// זה מקומי לחלוטין. **אין כאן deploy ואין נגיעה בפרויקט אמיתי** — האמולטור
// רץ על localhost עם project-id פיקטיבי.
//
// ⚠️ שתי מלכודות שנפתרות כאן, ושתיהן עלו בפועל:
//
// 1. **`firebase-tools` הוא devDependency של הפרויקט, לא התקנה גלובלית.**
//    התקנה גלובלית שבורה כבר גרמה ל-MODULE_NOT_FOUND בפרויקט הכדורסל.
//    לכן קוראים ישירות ל-`node_modules/firebase-tools/lib/bin/firebase.js`.
//
// 2. **אמולטורי Firestore ו-Storage הם Java** (ה-Auth הוא Node בלבד).
//    firebase-tools מחפש `java` ב-PATH — לא ב-JAVA_HOME. הסקריפט מוסיף את
//    תיקיית ה-bin ל-PATH של תת-התהליך בלבד, בלי לגעת ב-PATH של המערכת.
//    מקור ה-JDK: משתנה הסביבה `NRCAR_JAVA_HOME`, או JAVA_HOME, או התקנה
//    מוכרת. אין JDK → יוצא עם הודעה ברורה, **ולא מדווח כאילו רץ**.
// ============================================================================

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CANDIDATE_JDKS = [
  process.env.NRCAR_JAVA_HOME,
  process.env.JAVA_HOME,
  "C:\\Program Files\\Eclipse Adoptium\\jdk-17",
  "C:\\Program Files\\Java\\jdk-17",
  "C:\\Program Files\\Microsoft\\jdk-17",
  "C:\\Program Files\\Android\\Android Studio\\jbr",
].filter(Boolean);

function findJavaBin() {
  // כבר ב-PATH?
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of (process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    const exe = join(dir, process.platform === "win32" ? "java.exe" : "java");
    if (existsSync(exe)) return null; // אין צורך להוסיף כלום
  }
  for (const home of CANDIDATE_JDKS) {
    const exe = join(home, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (existsSync(exe)) return join(home, "bin");
  }
  return undefined; // לא נמצא בכלל
}

const inner = process.argv.slice(2).join(" ");
if (!inner) {
  console.error('שימוש: node scripts/emu.mjs "<פקודה שתרוץ בתוך האמולטור>"');
  process.exit(1);
}

const javaBin = findJavaBin();
if (javaBin === undefined) {
  console.error(
    [
      "לא נמצא JDK — אמולטורי Firestore ו-Storage דורשים Java 11+.",
      "",
      "התקנה ניידת, בלי לגעת במערכת:",
      "  1. הורד JDK 17 (zip) מ-https://adoptium.net",
      "  2. חלץ לתיקייה כלשהי",
      "  3. הרץ עם:  NRCAR_JAVA_HOME=<נתיב לתיקייה> npm run emu:rules",
      "",
      "לא הרצתי כלום. שום בדיקה לא עברה ולא נכשלה.",
    ].join("\n")
  );
  process.exit(2);
}

const env = { ...process.env };
if (javaBin) {
  const sep = process.platform === "win32" ? ";" : ":";
  env.PATH = `${javaBin}${sep}${env.PATH}`;
}
// מכבה את בדיקת העדכונים והטלמטריה — הרצה מקומית, בלי רעש רשת.
env.FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true";

const args = [
  join(ROOT, "node_modules", "firebase-tools", "lib", "bin", "firebase.js"),
  "emulators:exec",
  "--only",
  "auth,firestore,storage",
  "--project",
  "nrcar-emulator",
  inner,
];

const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
