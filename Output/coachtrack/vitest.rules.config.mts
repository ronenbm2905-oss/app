import { defineConfig } from 'vitest/config';

/**
 * קונפיג נפרד לבדיקות firestore.rules.
 *
 * הן **לא** חלק מ-`npm test`, ובכוונה: הן דורשות אמולטור Firestore רץ, ו-`npm test`
 * חייב להישאר מהיר ובלי תלות חיצונית. ההרצה היא דרך `npm run test:rules`, שמרים
 * אמולטור, מריץ את הקובץ הזה, ומוריד אותו.
 *
 * בלי מקביליות: כל הבדיקות חולקות אמולטור אחד, וכל בדיקה מאפסת וזורעת אותו מחדש
 * (`beforeEach`). שתי בדיקות שירוצו במקביל היו מוחקות זו את הנתונים של זו.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    globals: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
