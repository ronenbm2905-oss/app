/**
 * רישום ה-service worker (TASKS שלב 6 — PWA).
 *
 * ה-service worker עצמו יושב ב-`public/sw.js` וההסבר המלא שם. מה שחשוב כאן:
 *
 * 1. **בפיתוח לא רושמים — ומבטלים רישום קיים.** Vite מגיש את `public/` גם
 *    ב-`npm run dev`, ולכן בלי החסימה הזו ה-SW היה נרשם על `localhost:5173`
 *    ומתערב ב-HMR. הביטול הפעיל הוא ההגנה על התרחיש שמפחיד באמת: מי שהריץ
 *    `npm run preview` על אותה כתובת נשאר עם SW רשום שממשיך לחיות אחר כך.
 *
 * 2. **`register` נקרא אחרי `load`.** רישום בזמן הטעינה מתחרה על רוחב הפס
 *    עם ה-JS של האפליקציה עצמה, ואין שום דבר שדחוף בו.
 *
 * 3. **`update()` נקרא בכל טעינה.** הדפדפן בודק גרסה חדשה של סקריפט ה-SW
 *    בעצמו בכל ניווט, אבל לשונית שנשארה פתוחה יומיים לא מנווטת לשום מקום.
 *    הקריאה המפורשת היא מה שמבטיח שגם היא תקבל את הגרסה החדשה בטעינה הבאה.
 *
 * 4. **כשל ברישום אינו קורס.** PWA היא שכבת נוחות; אפליקציה שלא נטענת כי
 *    `navigator.serviceWorker` התנהג באופן לא צפוי היא מחיר שאין שום סיבה
 *    לשלם. הכשל נרשם לקונסולה וזהו.
 */

const SW_URL = '/sw.js';

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    void unregisterAll();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => registration.update())
      .catch((error: unknown) => {
        console.error('[CoachTrack] רישום ה-service worker נכשל', error);
      });
  });
}

/** מבטל כל רישום קיים. רץ רק בפיתוח — ראה ההסבר בראש הקובץ. */
async function unregisterAll(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn('[CoachTrack] ביטול רישום ה-service worker נכשל', error);
  }
}
