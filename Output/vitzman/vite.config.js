import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const STUB = fileURLToPath(new URL("./src/firebase-stub.js", import.meta.url));

/**
 * שני מצבי בנייה:
 *
 * · רגיל (`npm run build`) — dist רגיל, לשרת סטטי או ל-Firebase Hosting.
 * · עצמאי (`npm run build:standalone`) — **קובץ HTML אחד** עם כל ה-JS וה-CSS
 *   בפנים. לחיצה כפולה פותחת אותו בדפדפן; אין צורך ב-Node, בשרת או בהתקנה.
 *   זה מה שמאפשר להשתמש במערכת בלי להתקין כלום — כולל קריאת האקסל, שרצה
 *   בדפדפן דרך אותו `importWorkbook` של ה-CLI.
 *
 * הקובץ העצמאי גדול (~630KB) כי SheetJS מוטמע בתוכו. זו העלות של אפס-התקנה,
 * והיא משתלמת: הוא נטען מהדיסק, לא מהרשת.
 *
 * ⚠ **Firebase מוחלף ב-stub בבנייה העצמאית.** הקובץ נפתח מהדיסק בלי `.env`,
 * ולכן `isFirebaseConfigured` שם הוא תמיד `false` ואף קריאת ענן לא תרוץ — אבל
 * ה-import עצמו קיים בקוד, וגרר 540KB של SDK מת. ה-alias מוריד אותם.
 *
 * · ענן-בקובץ-אחד (`npm run build:cloudfile`) — **קובץ HTML אחד עם Firebase
 *   בפנים.** נועד למסלול אפס-התקנה: הקובץ נבנה כאן עם ה-config של רונן,
 *   והוא גורר אותו לשירות אחסון סטטי ומקבל כתובת. בלי Node אצלו, בלי CLI,
 *   בלי ריפו מקומי.
 *
 *   ⚠ **חייב אחסון אמיתי ולא `file://`.** התחברות Google דורשת דומיין מורשה,
 *   ול-`file://` אין דומיין — ה-popup ייכשל. זו הסיבה היחידה שהמסלול הזה
 *   מצריך העלאה בכלל.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "standalone" || mode === "cloudfile" ? [viteSingleFile()] : [])],
  server: { port: 5193 },
  /**
   * ⚠ **הדגל הזה מונע קריסה, לא סתם מייעל.**
   *
   * Vite טוען את `.env` **בכל המצבים**, ולכן ברגע שנוצר `.env` עם ה-config של
   * רונן, גם הבנייה העצמאית קיבלה `isFirebaseConfigured === true` — בזמן
   * ש-Firebase שם מוחלף ב-stub שזורק. התוצאה הייתה **מסך לבן** בקובץ שרונן
   * פותח בלחיצה כפולה, בלי שום הודעה.
   *
   * נתפס בבדיקה שחיפשה את מפתח ה-API בתוך `dist-standalone`.
   */
  define: { __CLOUD_ENABLED__: JSON.stringify(mode !== "standalone") },
  resolve: mode === "standalone"
    ? { alias: { "firebase/app": STUB, "firebase/firestore": STUB, "firebase/auth": STUB } }
    : {},
  build:
    mode === "standalone"
      ? { outDir: "dist-standalone", chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 }
      : mode === "cloudfile"
        ? { outDir: "dist-cloudfile", chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 }
        : { chunkSizeWarningLimit: 700 },
}));
