import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * שני מצבי בנייה:
 *
 * · רגיל (`npm run build`) — dist רגיל, לשרת סטטי או ל-Firebase Hosting.
 * · עצמאי (`npm run build:standalone`) — **קובץ HTML אחד** עם כל ה-JS וה-CSS
 *   בפנים. לחיצה כפולה פותחת אותו בדפדפן; אין צורך ב-Node, בשרת או בהתקנה.
 *   זה מה שמאפשר להשתמש במערכת בלי להתקין כלום — כולל קריאת האקסל, שרצה
 *   בדפדפן דרך אותו `importWorkbook` של ה-CLI.
 *
 * הקובץ העצמאי גדול (~2MB) כי SheetJS מוטמע בתוכו. זו העלות של אפס-התקנה,
 * והיא משתלמת: הוא נטען מהדיסק, לא מהרשת.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "standalone" ? [viteSingleFile()] : [])],
  server: { port: 5193 },
  build:
    mode === "standalone"
      ? { outDir: "dist-standalone", chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 }
      : { chunkSizeWarningLimit: 700 },
}));
