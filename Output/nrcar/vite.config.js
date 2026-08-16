import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base:'./' → תיקיית dist נפתחת גם סטטית (Netlify Drop / קובץ מקומי)
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5179, strictPort: false },
});
