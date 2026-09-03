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
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "standalone" ? [viteSingleFile()] : [])],
  server: { port: 5193 },
  resolve: mode === "standalone"
    ? { alias: { "firebase/app": STUB, "firebase/firestore": STUB, "firebase/auth": STUB } }
    : {},
  build:
    mode === "standalone"
      ? { outDir: "dist-standalone", chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 }
      : { chunkSizeWarningLimit: 700 },
}));
