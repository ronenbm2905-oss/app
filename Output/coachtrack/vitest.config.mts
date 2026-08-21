import { defineConfig } from 'vitest/config';

// קונפיג נפרד מ-vite.config.mts בכוונה: הטסטים רצים בסביבת node בלי DOM
// (גם טסטי הרינדור — הם משתמשים ב-react-dom/server), ולכן אין להם צורך בפלאגין React.
//
// TZ מקובע ל-UTC כדי שהטסטים יריצו את המקרה הכי מסוכן: מכשיר שאזור הזמן שלו
// אינו ישראל. אם חישוב תאריך יזלוג לשעון המכשיר — הטסט ייפול כאן ולא אצל שחקן.
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    environment: 'node',

    // ⚠️ קונפיג Firebase דמה — ובכוונה.
    //
    // Vitest טוען `.env.local` כמו Vite, כלומר בלי החסימה הזו הטסטים היו נטענים
    // עם המפתחות של הפרויקט **החי** (coachtrack-e6355). משלב 2 יש קומפוננטות
    // שמייבאות את `lib/firebase.ts`, ולכן צריך קונפיג תקין כדי שהמודול לא יזרוק —
    // אבל הוא חייב להצביע לשומקום. `test.env` גובר על `.env.local` (נבדק).
    //
    // הטסטים מרנדרים עם react-dom/server, שלא מריץ useEffect, ולכן שום מאזין
    // onSnapshot לא נרשם ואין תעבורת רשת בכלל.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'coachtrack-test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'coachtrack-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'coachtrack-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:testtesttest',
    },

    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});
