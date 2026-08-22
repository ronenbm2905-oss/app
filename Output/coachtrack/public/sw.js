/* eslint-env serviceworker */

/**
 * CoachTrack — service worker.
 *
 * =====================================================================
 *  קרא את זה לפני שאתה נוגע בקובץ הזה.
 * =====================================================================
 *
 * לרונן כבר הייתה תקלה בפרויקט אחר: אחרי deploy הטלפון המשיך להציג גרסה
 * ישנה. שם זה נפתר בכותרות Cache ב-`firebase.json` (`no-cache` ל-index.html,
 * `immutable` ל-/assets/**), והן כבר שם.
 *
 * **service worker שמוגדר לא נכון הופך את זה מ"רענון פותר" ל"תקוע לנצח":**
 * הוא יושב לפני הרשת, ואם הוא הגיש index.html מ-cache — הדפדפן לא יראה
 * לעולם את הכותרות של השרת. משתמש כזה תקוע עד שהוא מוחק את נתוני האתר,
 * ובאנדרואיד באפליקציה שהותקנה למסך הבית זה לא טריוויאלי.
 *
 * לכן ה-service worker הזה נכתב ביד ומכוון להיות **המינימלי האפשרי**:
 *
 *  1. **הוא שומר ב-cache דבר אחד בדיוק: `/offline.html`.**
 *     לא index.html. לא JS. לא CSS. לא פונטים. לא אייקונים.
 *
 *  2. **index.html לעולם לא נכנס ל-cache.** לא בהתקנה, ולא כשהוא נטען
 *     בהצלחה. ניווטים הם `network-first`, ומה שמוגש כשאין רשת הוא מסך
 *     "אין חיבור" — לא עותק ישן של האפליקציה. זה מבטיח שאי אפשר להיתקע:
 *     ברגע שיש רשת, מה שמגיע הוא מה שעל השרת.
 *
 *  3. **כל בקשה שאינה ניווט לא נוגעת בו בכלל.** ה-handler פשוט לא קורא
 *     ל-`respondWith`, והדפדפן מטפל בה כרגיל. זה מה שמבטיח מבנית —
 *     ולא ברשימת חסימות שאפשר לשכוח לעדכן — ש**תשובות של Firestore
 *     ושל Auth לא נשמרות ב-cache**, וגם לא ה-JS וה-CSS.
 *
 *  4. **אין precaching, אין Workbox, אין vite-plugin-pwa.** הכלים האלה
 *     מביאים precaching אגרסיבי כברירת מחדל, וזה בדיוק מה שאסור כאן.
 *
 * מה כן נותן מהירות? ה-HTTP cache של הדפדפן: `/assets/**` נשלח עם
 * `immutable, max-age=31536000` והשמות ממילא נושאים hash. עותק שני
 * ב-Cache Storage לא היה מוסיף כלום — רק עוד מקום שיכול להתיישן.
 *
 * ---------------------------------------------------------------------
 * מנגנון העדכון: `skipWaiting` + `clients.claim`, בלי באנר ובלי רענון כפוי.
 *
 * הבחירה הזו בטוחה **דווקא בגלל** שאין precache: גרסה חדשה של ה-SW לא
 * מחליפה שום קובץ אפליקציה, אלא רק את ה-proxy שמעביר הכל לרשת. אין מצב
 * של "חצי ישן חצי חדש", ולכן אין סיבה להטריד את המשתמש בבאנר, ובוודאי
 * שלא לרענן לו את הדף באמצע הקלדת יעד.
 *
 * `self.registration.update()` נקרא במפורש בכל טעינה של האפליקציה
 * (`src/lib/pwa.ts`) כדי שגם לשונית שנשארה פתוחה ימים תבדוק אם יש חדש.
 */

/**
 * שם ה-cache. **מעלים את המספר רק אם משנים את `/offline.html`.**
 * ה-`activate` מוחק כל cache ששמו אינו זה, ולכן העלאה כאן היא ניקוי מלא.
 */
const CACHE_NAME = 'coachtrack-offline-v1';

const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `cache: 'reload'` מכריח מעבר לרשת: בלעדיו ההתקנה עלולה לשמור
      // עותק ישן של מסך ה-offline מתוך ה-HTTP cache של הדפדפן.
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // ⚠️ שלוש היציאות המוקדמות האלה הן הלב של הקובץ.
  //
  // בלי `respondWith` הדפדפן מטפל בבקשה בעצמו — בדיוק כאילו אין service
  // worker. כך POST-ים, ערוץ ה-Listen של Firestore, בקשות ה-Auth, קבצי
  // ה-JS/CSS והפונטים עוברים ישירות לרשת ול-HTTP cache, ואף אחד מהם לא
  // נוגע ב-Cache Storage שלנו.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode !== 'navigate') return;

  // ניווט = network-first. אין כאן שום כתיבה ל-cache: מה שהרשת החזירה
  // נמסר כמו שהוא, עם הכותרות של Firebase Hosting, ונגמר.
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(OFFLINE_URL))
        .then(
          (cached) =>
            cached ??
            new Response('אין חיבור לאינטרנט', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }),
        ),
    ),
  );
});
