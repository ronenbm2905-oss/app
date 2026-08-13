import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // תמונות תכשיטים כבדות — לא ממירים ל-base64 (הן צריכות להיות lazy ו-cacheable).
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase SDK הוא ~300KB — לא צריך להיות ב-chunk הראשי של הקטלוג.
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "firebase";
          }
        },
      },
    },
  },
});
