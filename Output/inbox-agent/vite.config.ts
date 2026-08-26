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
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
