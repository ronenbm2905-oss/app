import { defineConfig } from 'vitest/config';

// קונפיג נפרד מ-vite.config.mts בכוונה: הטסטים של שלב 1 הם על פונקציות טהורות
// (lib/dates.ts, lib/calculations.ts ו-lib/auth.ts) ורצים בסביבת node בלי DOM,
// ולכן אין להם צורך בפלאגין של React.
//
// TZ מקובע ל-UTC כדי שהטסטים יריצו את המקרה הכי מסוכן: מכשיר שאזור הזמן שלו
// אינו ישראל. אם חישוב תאריך יזלוג לשעון המכשיר — הטסט ייפול כאן ולא אצל שחקן.
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});
