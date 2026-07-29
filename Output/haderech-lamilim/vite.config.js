import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: './' — נכסים נטענים בנתיב יחסי כדי שהבנייה תרוץ גם מפתיחה ישירה של index.html
// וגם מכל static host (Netlify Drop / תת-תיקייה) בלי שרת.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5174, strictPort: true },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // אל תטמיע תמונות ל-base64 — שומר על bundle קטן וטעינה עצלה
  },
});
