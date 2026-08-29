// ============================================================================
// harness.ts — תשתית לבדיקת `firestore.rules` מול האמולטור.
//
// ---------------------------------------------------------------------------
// למה זה קיים, בתבנית של `Output/coachtrack/rules-tests/harness.ts`
// ---------------------------------------------------------------------------
// > *"בדיקה שאי אפשר להריץ מחדש אינה בדיקה — היא זיכרון."*
//
// זה נכון פה כפליים, כי הכלל שהכי חשוב לבדוק הוא כלל **שלילי**:
// `oauthTokens` חסום גם לבעלים. כלל כזה אי אפשר לגלות שנשבר על ידי שימוש
// במוצר — שום מסך לא קורא את האוסף הזה, ולכן פתיחה שלו לא תשבור כלום ולא
// תיראה. היא פשוט תהיה שם.
//
// ---------------------------------------------------------------------------
// ★ שני משתמשים, למרות שיש משתמשת אחת
// ---------------------------------------------------------------------------
// אותה הכרעה כמו שני הארגונים ב-coachtrack: **רוב כללי הבידוד לא ניתנים
// לבדיקה בכלל עם משתמש אחד.** הכלל `request.auth.uid == uid` עובר כל בדיקה
// בעולם כשיש רק uid אחד במסד.
//
// ולכן: `dorit` (הבעלים) ו-`other` (משתמש מחובר אחר). ה"תוקף" כאן אינו
// היפותטי — הוא כל אחד שיש לו חשבון Google, כי מסך ההתחברות פתוח.
// ============================================================================

import { readFileSync } from 'node:fs';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

/** הבעלים — דורית. */
export const DORIT = 'uid_dorit';
/** משתמש מחובר אחר. לא "תוקף מתוחכם": מישהו עם חשבון Google. */
export const OTHER = 'uid_other';

export const ORDER_ID = 'ord-msg-101';
export const DAILY_ID = '2026-08-30';
export const LOG_ID = 'log-1';
export const RUN_ID = 'run-1';
export const STATE_ID = 'state-abc';

/** ★ כתובת אמיתית-למראה, כדי שאפשר יהיה לחפש אותה בתוצאות. */
export const RECIPIENT = {
  name: 'רונית שדה',
  phone: '050-555-0101',
  email: 'ronit.s@lakoach.example',
  street: 'רחוב הדוגמה 14, דירה 3',
  city: 'תל דוגמה',
  postalCode: '6100200',
  countryCode: 'IL',
};

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

  return initializeTestEnvironment({
    projectId: 'inbox-agent-rules-test',
    firestore: {
      // ★ ניתן להצביע על גרסה אחרת של הכללים, כדי לוודא שהבדיקה באמת תופסת
      // את מה שהיא מתיימרת לתפוס. אותה תבנית כמו `COACHTRACK_RULES_FILE`.
      rules: readFileSync(process.env.INBOX_RULES_FILE ?? 'firestore.rules', 'utf8'),
      host,
      port: Number(port),
    },
  });
}

/**
 * מאפס וזורע מצב התחלתי זהה לכל בדיקה.
 *
 * הזריעה עוקפת את הכללים (`withSecurityRulesDisabled`) — אחרת אי אפשר היה
 * ליצור את המצב שהכללים אמורים להגן עליו. זו גם בדיוק הדרך שבה ה-Admin SDK
 * כותב בפרודקשן.
 */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const put = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);

    await Promise.all([
      put(`users/${DORIT}`, {
        googleConnection: 'connected',
        lastReadCount: 20,
        lastReadSources: ['tranzila.com'],
        supportMode: { enabled: false, expiresAt: null, enabledAt: null },
      }),
      put(`users/${OTHER}`, { googleConnection: 'disconnected' }),

      // ⛔⛔ הפריט הרגיש ביותר במסד: המפתח לתיבה.
      put(`users/${DORIT}/oauthTokens/google`, {
        refreshToken: 'v1.aaa.bbb.ccc',
        grantedScopes: 'https://www.googleapis.com/auth/gmail.readonly',
        connectedAt: '2026-08-25T09:00:00.000Z',
        updatedAt: '2026-08-25T09:00:00.000Z',
      }),

      put(`users/${DORIT}/orders/${ORDER_ID}`, {
        userId: DORIT,
        kind: 'order',
        recipient: RECIPIENT,
        status: 'new',
        recipientPurged: false,
        receivedAt: '2026-08-26T05:12:00.000Z',
        purgeAfter: '2027-02-22T05:12:00.000Z',
      }),

      put(`users/${DORIT}/dailyLists/${DAILY_ID}`, {
        orderIds: [ORDER_ID],
        builtAt: '2026-08-30T05:00:00.000Z',
        purgeAfter: '2027-02-26T05:00:00.000Z',
      }),

      put(`users/${DORIT}/accessLog/${LOG_ID}`, {
        userId: DORIT,
        at: '2026-09-03T11:20:00.000Z',
        actor: 'holder',
        action: 'orderContentOpened',
        targetKind: 'order',
        targetCount: 1,
        sourceMessageId: 'msg-101',
      }),

      put(`users/${DORIT}/syncRuns/${RUN_ID}`, {
        userId: DORIT,
        kind: 'sync',
        at: '2026-09-03T03:30:00.000Z',
        scanned: 21,
        messagesRead: 20,
      }),

      // ה-`state` — אוסף שורש, ואיש לא נוגע בו מהקליינט.
      put(`oauthStates/${STATE_ID}`, {
        userId: DORIT,
        createdAt: '2026-09-03T11:00:00.000Z',
        expiresAt: '2026-09-03T11:10:00.000Z',
      }),
    ]);
  });
}
