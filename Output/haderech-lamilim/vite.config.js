import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base: './' — נכסים נטענים בנתיב יחסי כדי שהבנייה תרוץ גם מפתיחה ישירה של index.html
// וגם מכל static host (Netlify Drop / תת-תיקייה) בלי שרת.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // הכלל את כל הנכסים ב-precache: 24 הקלפים (jpg), הפונט (woff2), אייקונים (png/svg)
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "icon.svg",
        "fonts/*.woff2",
        "cards/*.jpg",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,jpg,woff2,svg,png}"],
        // הקלפים גדולים יחסית — מרימים את תקרת הקובץ ל-precache כדי שכולם ייכנסו
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "הדרך למילים",
        short_name: "הדרך למילים",
        description:
          "משחקים חינוכיים לילדים 2–8 לפיתוח שיח רגשי, מבוסס ערכת הקלפים מאת דורית בן מאיר.",
        lang: "he",
        dir: "rtl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#8ECFDD",
        background_color: "#FAF7EF",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  base: "./",
  server: { port: 5174, strictPort: true },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // אל תטמיע תמונות ל-base64 — שומר על bundle קטן וטעינה עצלה
  },
});
