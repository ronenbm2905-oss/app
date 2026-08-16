import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// קונסולת הלידים של משה. אפליקציה פרטית מאחורי התחברות — לא דף ציבורי.
// דף הנחיתה הציבורי הוא של עומר, והוא טוען רק את `lead-intake.js`
// (ראה vite.intake.config.js).
export default defineConfig({
  plugins: [react()],
  server: { port: 5186, strictPort: true },
  preview: { port: 5186, strictPort: true },
  build: { outDir: "dist", sourcemap: false },
});
