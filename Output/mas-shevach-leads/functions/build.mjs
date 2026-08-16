// אורז את functions/src ל-lib/index.js.
// ⚠️ ה-bundling הוא מה שמאפשר ל-functions לייבא את `src/utils/retention.js`
//    ואת `src/constants.js` של האפליקציה — כלומר **מקור אמת אחד** למדיניות
//    השמירה. מה שהקונסולה מבטיחה ("נמחק בעוד X ימים") הוא בדיוק מה שהשרת
//    מבצע. בלי זה, השניים היו נפרדים ומתפצלים בשקט.

import { build } from "esbuild";

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "lib/index.js",
  // תלויות הריצה של Firebase נשארות חיצוניות — הן מותקנות בסביבת הפונקציות.
  external: ["firebase-admin", "firebase-functions", "firebase-functions/*"],
  logLevel: "info",
});
