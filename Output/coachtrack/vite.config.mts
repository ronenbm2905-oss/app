import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// הקובץ הוא .mts (ולא .ts) בכוונה: ל-package.json אין "type": "module",
// כדי ש-scripts/seed.js ו-scripts/reset-password.js (CommonJS) ימשיכו לרוץ
// עם `node scripts/seed.js` כפי שמתועד ב-START-HERE.md.
export default defineConfig({
  plugins: [react()],
  server: {
    // מאפשר בדיקה מטלפון אמיתי ברשת המקומית (כלל "מובייל-פירסט")
    host: true,
  },
});
