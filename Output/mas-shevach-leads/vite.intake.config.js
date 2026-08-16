import { defineConfig } from "vite";
import { resolve } from "node:path";

// ============================================================================
// בנייה נפרדת ל-`lead-intake.js` — הקובץ היחיד שעומר טוען בדף הנחיתה.
//
// למה build נפרד ולמה IIFE:
//   · **אפס תלויות.** ה-SDK של Firebase שוקל ~90KB gzip. דף נחיתה לקמפיין
//     ממומן משלם על כל קילובייט בכסף אמיתי (Quality Score, נטישה במובייל
//     ברשת סלולרית). הקובץ הזה מדבר ישירות מול Firestore REST + App Check
//     REST ב-`fetch` — ומגיע ל-~4KB gzip.
//   · **אפס בקשות רשת בטעינת הדף.** reCAPTCHA נטען עצלנית, רק כשהמבקר
//     נוגע בטופס בפועל. מבקר שגלל וירד לא שילם על כלום ולא נחשף לצד ג'.
//   · IIFE ולא ESM — עומר טוען `<script defer src="lead-intake.js">` בלי
//     build ובלי type=module. זה החוזה מולו.
//
// ⚠️ אין כאן `define` של קונפיג: הקונפיג מוזרק בזמן ריצה דרך
//    `window.MAS_SHEVACH_CONFIG`, כדי שאותו קובץ בדיוק יעבוד בסביבת בדיקה
//    ובפרודקשן בלי rebuild. מפתחות Web של Firebase ציבוריים ממילא —
//    ההגנה האמיתית היא ה-rules + App Check.
// ============================================================================
export default defineConfig({
  build: {
    outDir: "dist-intake",
    emptyOutDir: true,
    lib: {
      entry: resolve(process.cwd(), "intake/lead-intake.js"),
      name: "MasShevachLeads",
      formats: ["iife"],
      fileName: () => "lead-intake.min.js",
    },
    minify: "esbuild",
    sourcemap: false,
    target: "es2018",
  },
});
