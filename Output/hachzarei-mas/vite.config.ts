import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * בנייה רב-עמודית (MPA).
 *
 * שני דפי הנחיתה הם כניסות React נפרדות — כך לכל אחד יש `<title>`, מטא ו-OG משלו
 * בלי SSR, וכל דף שולח לדפדפן רק את השאלון שלו.
 *
 * שלושת עמודי המשפט הם HTML סטטי בלי bundle — הם טקסט בלבד.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    // בפיתוח מקומי הבקשה מנותבת לאמולטור הפונקציות, כך שהקוד בלקוח
    // משתמש באותו נתיב יחסי גם כאן וגם בפרודקשן.
    proxy: {
      '/api/submit-lead': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: () =>
          '/' +
          (process.env.FIREBASE_PROJECT_ID ?? 'demo-hachzarei-mas') +
          '/me-west1/submitLead',
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        'mas-hachnasa': resolve(__dirname, 'index.html'),
        'mas-shevach': resolve(__dirname, 'mas-shevach.html'),
        takanon: resolve(__dirname, 'takanon.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        accessibility: resolve(__dirname, 'accessibility.html'),
      },
    },
  },
});
