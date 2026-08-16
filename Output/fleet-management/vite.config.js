import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// __FLEET_DEV_EMULATOR__ — קבוע **בזמן build**, לא בדיקה בזמן ריצה.
// כך קוד האמולטור (חיבור ל-localhost + כניסה אנונימית) נמחק לגמרי מכל
// בנייה לפרודקשן ואינו יכול להגיע לאוויר גם אם המשתנה נשאר בסביבה בטעות.
// הפעלה בפיתוח:  $env:VITE_FB_USE_EMULATOR="1" ; npm run dev
// base:'./' → תיקיית dist נפתחת גם סטטית (Netlify Drop / קובץ מקומי)
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  base: "./",
  server: { port: 5177, strictPort: false },
  define: {
    __FLEET_DEV_EMULATOR__: JSON.stringify(
      command === "serve" && mode !== "production" && process.env.VITE_FB_USE_EMULATOR === "1"
    ),
  },
}));
