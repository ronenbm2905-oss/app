// ============================================================================
// build.mjs — אוגד את `src/` (כולל המנוע המשותף מ-`../src/utils/`) ל-`lib/`.
//
// **זה הלב של ההכרעה הארכיטקטונית:** אין העתק של המנוע בתוך `functions/`.
// הקוד כאן מייבא ישירות מ-`../../src/utils/`, ו-esbuild מאגד את הכול לקובץ
// אחד שנפרס. אם מישהו ישנה את הסולם ב-`src/constants.js`, הבנייה הבאה תיקח
// את הערך החדש — כי אין מאיפה לקחת ערך ישן.
//
// אותו דפוס בדיוק כמו פרויקט TypeScript ב-Firebase (`tsc` → `lib/`), רק עם
// esbuild. `main` ב-package.json מצביע ל-`lib/index.js`, ו-`predeploy`
// ב-firebase.json מריץ את הקובץ הזה.
//
// אם ייבוא מהמנוע לא נפתר — הבנייה נכשלת, וזה בדיוק הרצוי.
// ============================================================================

import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(HERE, "src", "index.js")],
  outfile: join(HERE, "lib", "index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // התלויות של סביבת הריצה נשארות חיצוניות — Firebase מספק אותן.
  external: ["firebase-admin", "firebase-admin/*", "firebase-functions", "firebase-functions/*"],
  logLevel: "info",
  banner: {
    js: "// נוצר ע\"י functions/build.mjs — אל תערוך. המקור: functions/src/ + src/utils/",
  },
});

console.log("✓ functions bundled → lib/index.js");
