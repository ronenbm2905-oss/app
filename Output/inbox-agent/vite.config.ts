/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `shared/` יושב מחוץ ל-`src/` בכוונה: בפרוסה 1 אותה תיקייה בדיוק נצרכת גם
// על ידי ה-Cloud Functions (תבנית `Output/hachzarei-mas/scripts/sync-shared.mjs`).
// הכינוי `@shared` קיים כבר עכשיו כדי שהייבוא לא ישתנה כשזה יקרה.
//
// `fileURLToPath` ולא `__dirname`: הפרויקט הוא `"type": "module"`, ושם
// `__dirname` אינו מוגדר — הוא עובד רק בזכות shim של טוען הקונפיג של Vite,
// וזו תלות שקטה שלא כדאי להישען עליה.
const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': dir('./shared'),
      '@': dir('./src'),
    },
  },
  build: {
    // ★ מכבה את ה-polyfill של modulepreload.
    //
    // הוא הדבר היחיד שהחדיר `fetch(` לחבילה — הוא מושך מראש את קובצי ה-JS
    // שלנו עצמם, ולא פונה לשום שרת. ובכל זאת הוא כיבה בקרה אמיתית:
    // `scripts/check-dist.mjs` סורק את התוצר ומוודא שאין בו קריאת רשת, ו-
    // "חוץ מהשורה הזאת" הוא בדיוק סוג החריג שאחריו אף אחד לא מסתכל.
    //
    // המחיר אפס: אין באפליקציה ייבוא דינמי, ויש בה chunk אחד.
    modulePreload: { polyfill: false },
  },

  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
