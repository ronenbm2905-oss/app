// ============================================================================
// firestore.rules.test.ts — ★ A5′. הכללים, מול אמולטור אמיתי.
//
// ---------------------------------------------------------------------------
// שני עקרונות, בתבנית של coachtrack
// ---------------------------------------------------------------------------
//  1. **לכל חסימה יש ביקורת חיובית לצידה.** כלל שחוסם הכול עובר כל בדיקת
//     חסימה בעולם. רק הזוג — "זה נחסם, וזה עובר" — מוכיח שהכלל **מבחין**.
//     בקובץ deny-all זה קריטי במיוחד: קל מאוד לכתוב כללים שגם דורית לא
//     יכולה לקרוא כלום, ולגלות את זה רק כשהמסך ריק בפרודקשן.
//  2. **הטענה הנבדקת היא זו שנוסחה בסקירה:** משתמש אחר לא קורא `orders`,
//     ו-`oauthTokens` חסום **לכולם** — כולל לבעלים.
//
// הרצה: `npm run test:rules` (מרים אמולטור Firestore, מריץ, ומוריד).
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import {
  createTestEnv,
  seed,
  DAILY_ID,
  DORIT,
  LOG_ID,
  ORDER_ID,
  OTHER,
  RUN_ID,
  STATE_ID,
} from './harness';

let env: RulesTestEnvironment;

const asDorit = () => env.authenticatedContext(DORIT).firestore() as unknown as Firestore;
const asOther = () => env.authenticatedContext(OTHER).firestore() as unknown as Firestore;
const asAnon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await seed(env);
});

// ============================================================================
// ⛔⛔ oauthTokens — הכלל שאין לו מקרה קצה
// ============================================================================

describe('⛔⛔ oauthTokens — חסום לכולם, כולל לבעלים', () => {
  it('★★ הבעלים אינו קורא את הטוקן של עצמה', async () => {
    // זה נראה מוזר — זה הטוקן שלה. אבל אין מסך שצריך את הערך הזה, ואין
    // פעולה בקליינט שנעשית איתו. הרשאת קריאה שאיש לא צריך היא "זה לא אמור
    // לרוץ" בשכבת ההרשאות, והפריט הזה הוא המפתח לתיבה עצמה.
    await assertFails(getDoc(doc(asDorit(), `users/${DORIT}/oauthTokens/google`)));
  });

  it('★★ משתמש אחר אינו קורא את הטוקן', async () => {
    await assertFails(getDoc(doc(asOther(), `users/${DORIT}/oauthTokens/google`)));
  });

  it('לא-מחובר אינו קורא את הטוקן', async () => {
    await assertFails(getDoc(doc(asAnon(), `users/${DORIT}/oauthTokens/google`)));
  });

  it('★ גם שאילתה על האוסף כולו נחסמת — לא רק מסמך בודד', async () => {
    await assertFails(getDocs(collection(asDorit(), `users/${DORIT}/oauthTokens`)));
  });

  it('אף אחד לא כותב לטוקן — גם לא הבעלים', async () => {
    await assertFails(
      setDoc(doc(asDorit(), `users/${DORIT}/oauthTokens/google`), { refreshToken: 'זיוף' }),
    );
    await assertFails(
      setDoc(doc(asOther(), `users/${DORIT}/oauthTokens/google`), { refreshToken: 'זיוף' }),
    );
  });

  it('אף אחד לא מוחק את הטוקן מהקליינט', async () => {
    await assertFails(deleteDoc(doc(asDorit(), `users/${DORIT}/oauthTokens/google`)));
  });
});

// ============================================================================
// ★★ בידוד: משתמש אחר לא קורא orders
// ============================================================================

describe('★★ ההזמנות — קריאה לבעלים בלבד', () => {
  it('✅ הבעלים קוראת את ההזמנות שלה', async () => {
    // ★ הביקורת החיובית. בלעדיה, כללים שחוסמים הכול היו עוברים את כל
    // הקובץ הזה — והמסך של דורית היה ריק.
    await assertSucceeds(getDoc(doc(asDorit(), `users/${DORIT}/orders/${ORDER_ID}`)));
    await assertSucceeds(getDocs(collection(asDorit(), `users/${DORIT}/orders`)));
  });

  it('★★ משתמש אחר אינו קורא הזמנה בודדת', async () => {
    await assertFails(getDoc(doc(asOther(), `users/${DORIT}/orders/${ORDER_ID}`)));
  });

  it('★★ משתמש אחר אינו מריץ שאילתה על אוסף ההזמנות', async () => {
    // ההבחנה חשובה: כלל שמסתמך על `resource.data` יכול לחסום מסמך בודד
    // ולהיכשל בשאילתה, ולהפך.
    await assertFails(getDocs(collection(asOther(), `users/${DORIT}/orders`)));
  });

  it('לא-מחובר אינו קורא הזמנות', async () => {
    await assertFails(getDoc(doc(asAnon(), `users/${DORIT}/orders/${ORDER_ID}`)));
  });
});

// ============================================================================
// ⛔ כתיבה מהקליינט — לאף אחד, בשום אוסף
// ============================================================================

describe('⛔ כל כתיבה עוברת ב-Admin SDK', () => {
  it('★★ הבעלים אינה מסמנת "נשלח" ישירות במסד', async () => {
    // הסימון עובר ב-`onCall`. אילו הקליינט יכול היה לכתוב, `shippedAt`
    // ו-`purgeAfter` היו נתונים לשליטת הדפדפן — כלומר מדיניות המחיקה
    // הייתה ניתנת לדחייה מהמסך.
    await assertFails(
      updateDoc(doc(asDorit(), `users/${DORIT}/orders/${ORDER_ID}`), { status: 'shipped' }),
    );
  });

  it('★★ הבעלים אינה מזייפת `recipientPurged` — "נמחק" חייב להיות אמת', async () => {
    await assertFails(
      updateDoc(doc(asDorit(), `users/${DORIT}/orders/${ORDER_ID}`), { recipientPurged: true }),
    );
  });

  it('★★ הבעלים אינה דוחה את `purgeAfter`', async () => {
    await assertFails(
      updateDoc(doc(asDorit(), `users/${DORIT}/orders/${ORDER_ID}`), {
        purgeAfter: '2099-01-01T00:00:00.000Z',
      }),
    );
  });

  it('הבעלים אינה מוחקת הזמנה מהקליינט', async () => {
    await assertFails(deleteDoc(doc(asDorit(), `users/${DORIT}/orders/${ORDER_ID}`)));
  });

  it('★★ הבעלים אינה מדליקה את מצב התמיכה בכתיבה ישירה', async () => {
    // הפקיעה מחושבת בשרת. כתיבה ישירה הייתה מאפשרת `expiresAt` רחוק.
    await assertFails(
      updateDoc(doc(asDorit(), `users/${DORIT}`), {
        supportMode: { enabled: true, expiresAt: '2099-01-01T00:00:00.000Z', enabledAt: null },
      }),
    );
  });

  it('★★ אף אחד לא כותב ליומן הגישה — יומן שנושא המידע יכול לערוך אינו יומן', async () => {
    await assertFails(
      setDoc(doc(asDorit(), `users/${DORIT}/accessLog/forged`), { action: 'x' }),
    );
    await assertFails(deleteDoc(doc(asDorit(), `users/${DORIT}/accessLog/${LOG_ID}`)));
  });

  it('משתמש אחר לא כותב לשום מקום אצל הבעלים', async () => {
    await assertFails(setDoc(doc(asOther(), `users/${DORIT}/orders/hacked`), { x: 1 }));
    await assertFails(setDoc(doc(asOther(), `users/${DORIT}`), { googleConnection: 'connected' }));
  });
});

// ============================================================================
// ✅ מה שדורית כן צריכה לראות
// ============================================================================

describe('✅ מה שהמסך קורא', () => {
  it('מסמך המשתמשת — מצב החיבור והמונה', async () => {
    await assertSucceeds(getDoc(doc(asDorit(), `users/${DORIT}`)));
  });

  it('★★ יומן הגישה — B3′.2. בלי זה הוא לא תיעוד עבורה', async () => {
    await assertSucceeds(getDocs(collection(asDorit(), `users/${DORIT}/accessLog`)));
  });

  it('ריצות הסנכרון והמחיקה', async () => {
    await assertSucceeds(getDoc(doc(asDorit(), `users/${DORIT}/syncRuns/${RUN_ID}`)));
  });

  it('הרשימה היומית', async () => {
    await assertSucceeds(getDoc(doc(asDorit(), `users/${DORIT}/dailyLists/${DAILY_ID}`)));
  });

  it('★ ומשתמש אחר אינו קורא אף אחד מהם', async () => {
    await assertFails(getDoc(doc(asOther(), `users/${DORIT}`)));
    await assertFails(getDocs(collection(asOther(), `users/${DORIT}/accessLog`)));
    await assertFails(getDoc(doc(asOther(), `users/${DORIT}/syncRuns/${RUN_ID}`)));
    await assertFails(getDoc(doc(asOther(), `users/${DORIT}/dailyLists/${DAILY_ID}`)));
  });
});

// ============================================================================
// ⛔ ברירת המחדל
// ============================================================================

describe('⛔ {document=**} — מה שאין לו כלל, אין לו גישה', () => {
  it('★★ אוסף חדש שאיש לא כתב לו כלל — חסום', async () => {
    // זה מה שמגן על הפיצ'ר הבא: מי שיוסיף אוסף בקוד ולא בכללים יקבל מסך
    // שלא עובד, ולא מידע שנחשף.
    await assertFails(getDoc(doc(asDorit(), 'somethingNew/doc1')));
    await assertFails(setDoc(doc(asDorit(), 'somethingNew/doc1'), { x: 1 }));
  });

  it('★ תת-אוסף חדש תחת המשתמשת — חסום גם הוא', async () => {
    await assertFails(getDoc(doc(asDorit(), `users/${DORIT}/futureCollection/doc1`)));
    await assertFails(getDocs(collection(asDorit(), `users/${DORIT}/futureCollection`)));
  });

  it('⛔ ה-state של זרימת ההרשאה — חסום לכולם', async () => {
    // הוא מחזיק את ה-uid, והוא מה שקושר בין הקולבק לזהות.
    await assertFails(getDoc(doc(asDorit(), `oauthStates/${STATE_ID}`)));
    await assertFails(getDoc(doc(asOther(), `oauthStates/${STATE_ID}`)));
    await assertFails(setDoc(doc(asOther(), 'oauthStates/forged'), { userId: DORIT }));
  });
});
