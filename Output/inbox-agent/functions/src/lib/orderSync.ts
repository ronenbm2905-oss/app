// ============================================================================
// orderSync.ts — הצינור בענן. **אותו צינור בדיוק כמו המקומי.**
//
//   ORDER_SOURCE_QUERY → messages.list → messages.get(format:'raw')
//                      → gmailMessageToCandidate  ← ★★ השער
//                      → readOrderBodies          ← ★★ אתר הקריאה היחיד
//                      → parseOrderMessage → orders/
//
// ---------------------------------------------------------------------------
// ★★ אתר הקריאה נשאר יחיד — וזו הנקודה שהכי קל לפספס כאן
// ---------------------------------------------------------------------------
// היה מתבקש לכתוב כאן לולאה שקוראת מהודעה את הגוף ומעבירה לפרסר. זה היה
// עובד, וזה היה **מסלול קריאה שני** — כלומר B12 נשבר בשקט, כי מסך ההסבר
// והפסקה באתר ממשיכים להבטיח "רק מחברת התשלומים" בזמן שיש נתיב שאף אחד לא
// בודק בו את השולח.
//
// לכן הקובץ הזה **לא נוגע ב-`bodyRaw`** בשום שורה. הוא אוסף candidates
// ומעביר את כולם ל-`readOrderBodies`, שהוא היחיד שבודק שולח ואז ניגש לגוף.
// `scripts/check-order-source.mjs` רץ עכשיו גם על גרף ה-Functions ומפיל
// build אם השורה הזאת תשתנה.
//
// ---------------------------------------------------------------------------
// ★ ומה שלא נכתב לשום מקום
// ---------------------------------------------------------------------------
// אין `console.` באף שורה — נאכף ב-`check-order-logging.mjs`, שרץ גם כאן.
// סיכום הריצה נכתב ל-`syncRuns` כ**ספירות וקודים**, בלי נושא, בלי כתובת
// ובלי שם. זו הדרישה של M4 אחרי שהמודל ירד: Cloud Logging הוא הדרך היחידה
// שנשארה שבה כתובת מגורים יוצאת מהמערכת.
// ============================================================================

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, collectionPath, docPath, userDocPath } from '../shared/lib/firestorePaths';
import {
  assertCandidateComplete,
  FetchContractError,
  type FetchContractCode,
} from '../shared/lib/gmailContract';
import { readOrderBodies, type OrderSourceCandidate } from '../shared/lib/orderSource';
import { isOrderSubject, parseOrderMessage } from '../shared/lib/orderParse';
import { domainOf } from '../shared/lib/addresses';
import { purgeDateFor } from '../shared/lib/orderRetention';
import { contentFingerprint } from '../shared/lib/fingerprint';
import type { GmailClient } from './gmailFetch';
import { TokenStore, TokenStoreError } from './tokenStore';

/** ★ 90 יום — ריצות סנכרון הן מטא-נתונים, ואין להן סיבה לשרוד יותר. */
const SYNC_RUN_RETENTION_DAYS = 90;

export interface SyncSummary {
  scanned: number;
  written: number;
  /** הודעות שנקרא מהן גוף. **המספר שמוצג לדורית** (M18). */
  messagesRead: number;
  /** הדומיינים שמהם נקרא גוף בפועל. אמור להיות `['tranzila.com']`. */
  readSources: string[];
  /** מאיזה חלק MIME נקרא. אמור להיות `['text']`. */
  readParts: string[];
  /** ★★ הודעות שהיה בהן זנב לא חתום שנחתך. */
  unsignedTail: number;
  needsAttention: number;
  /** ★★ הודעות שנפסלו בשער החוזה, לפי קוד. */
  contractRefusals: Partial<Record<FetchContractCode, number>>;
  errorHe: string | null;
}

export interface SyncDeps {
  db: Firestore;
  tokens: TokenStore;
  /** מוזרק כדי שאפשר יהיה להריץ את הצינור מול Gmail מדומה. */
  makeClient: (accessToken: string) => GmailClient;
  now?: () => Date;
}

const emptySummary = (): SyncSummary => ({
  scanned: 0,
  written: 0,
  messagesRead: 0,
  readSources: [],
  readParts: [],
  unsignedTail: 0,
  needsAttention: 0,
  contractRefusals: {},
  errorHe: null,
});

/**
 * ★★ ריצת סנכרון אחת למשתמשת אחת.
 *
 * מחזירה סיכום ולא זורקת: המתזמן צריך להמשיך למשתמשת הבאה, והשגיאה צריכה
 * להגיע למסך שלה ולא ליומן שרק רונן רואה.
 */
export async function syncOrdersForUser(uid: string, deps: SyncDeps): Promise<SyncSummary> {
  const summary = emptySummary();
  const now = deps.now ?? (() => new Date());

  let accessToken: string;
  try {
    accessToken = await deps.tokens.getAccessToken(uid);
  } catch (err) {
    // ★ `invalid_grant` הוא המצב היחיד שדורש פעולה ממנה. הוא נתפס
    // ב-`tokenStore` ומגיע לכאן כקוד — ולא כמחרוזת שצריך לנחש.
    const expired = err instanceof TokenStoreError && err.code === 'invalidGrant';
    await deps.db
      .doc(userDocPath(uid))
      .set({ googleConnection: expired ? 'expired' : 'error' }, { merge: true });
    summary.errorHe = expired
      ? 'החיבור לגוגל פג. צריך להתחבר מחדש — שום דבר לא נמחק.'
      : 'לא הצלחתי להתחבר לגוגל. אנסה שוב אוטומטית.';
    await writeRun(deps.db, uid, summary, now());
    return summary;
  }

  const client = deps.makeClient(accessToken);

  let ids: string[];
  try {
    ids = await client.listOrderMessageIds();
  } catch {
    summary.errorHe = 'לא הצלחתי לקבל מגוגל את רשימת ההודעות. אנסה שוב אוטומטית.';
    await writeRun(deps.db, uid, summary, now());
    return summary;
  }
  summary.scanned = ids.length;

  // --- ★★ שליפה: כל הודעה עוברת בשער החוזה, ואין מסלול עוקף. --------------
  const candidates: OrderSourceCandidate[] = [];
  for (const id of ids) {
    try {
      const candidate = await client.getOrderMessage(id);
      // רשת שנייה, לפני שהמסמך נכנס לרשימה. ראה ההערה ב-`gmailContract.ts`:
      // היא תופסת גם מסלול שליפה שעוד לא נכתב.
      assertCandidateComplete(candidate);
      candidates.push(candidate);
    } catch (err) {
      if (err instanceof FetchContractError) {
        summary.contractRefusals[err.code] = (summary.contractRefusals[err.code] ?? 0) + 1;
        continue;
      }
      // שגיאת רשת/HTTP על הודעה בודדת. ממשיכים — הודעה אחת שלא נמשכה אינה
      // סיבה לבטל את הרשימה כולה.
      summary.contractRefusals.rawBodyMissing =
        (summary.contractRefusals.rawBodyMissing ?? 0) + 1;
    }
  }

  // --- ★★ אתר הקריאה היחיד. השורה הזאת היא כל B12. ------------------------
  const read = readOrderBodies(candidates);
  summary.messagesRead = read.readCount;
  summary.readSources = read.sources;
  summary.readParts = read.parts;
  summary.unsignedTail = read.unsignedTailCount;

  const at = now();
  const ts = at.toISOString();
  const ordersRef = deps.db.collection(collectionPath(uid, COLLECTIONS.orders));

  // ★ מפתחות תוכן של הזמנות שכבר נשמרו — לזיהוי כפילות. נטענים פעם אחת.
  const existing = await ordersRef.get();
  const seenContentKeys = new Set<string>();
  for (const d of existing.docs) {
    const key = (d.data() as { contentKey?: unknown }).contentKey;
    if (typeof key === 'string') seenContentKeys.add(key);
  }

  for (const msg of candidates) {
    const part = read.bodies.get(msg.messageId);
    const parsed = parseOrderMessage({
      fromAddress: msg.fromAddress,
      subject: msg.subject,
      bodyText: part?.kind === 'text' ? part.body : undefined,
      bodyHtml: part && part.kind !== 'text' ? part.body : undefined,
      authenticationResults: msg.authenticationResults,
      dkimSignature: msg.dkimSignature,
      unsignedTailBytes: part?.unsignedBytes ?? 0,
    });

    if (!parsed.isOrderCandidate) {
      // הודעה שנשאה את הנושא ולא עברה אימות שולח — נשמרת כשאלה פתוחה, בלי
      // שום פרט ממנה. ראה `openQuestions` בצינור המקומי.
      if (isOrderSubject(msg.subject)) {
        await ordersRef.doc(`q-${msg.messageId}`).set({
          userId: uid,
          kind: 'openQuestion',
          sourceMessageId: msg.messageId,
          fromDomain: domainOf(msg.fromAddress),
          receivedAt: msg.receivedAt,
          reasonHe:
            'ההודעה הזאת נראית כמו הודעת הזמנה, אבל היא לא הגיעה מכתובת הסליקה. לא קראתי ממנה כלום, וכדאי לא ללחוץ על שום דבר בתוכה',
          purgeAfter: purgeDateFor(
            { status: 'new', shippedAt: null, receivedAt: msg.receivedAt },
            {},
          ),
          createdAt: ts,
          updatedAt: ts,
        });
      }
      continue;
    }

    const id = `ord-${msg.messageId}`;
    const prior = existing.docs.find((d) => d.id === id);
    const priorData = prior?.data() as
      | { status?: string; shippedAt?: string | null; recipientPurged?: boolean }
      | undefined;

    // ★ סימון "נשלח" של המשתמשת שורד סנכרון. הצינור לא כותב מצב — הוא כותב
    // תוכן, והמצב שייך לה.
    const status = (priorData?.status === 'shipped' ? 'shipped' : 'new') as 'new' | 'shipped';
    const shippedAt = priorData?.shippedAt ?? null;

    // ★ רשומה שכבר נמחקה לא נכתבת מחדש. בלי התנאי הזה כל ריצת סנכרון הייתה
    // מחזירה לחיים כתובת שהמדיניות מחקה — כלומר מבטלת את המדיניות בשקט.
    if (priorData?.recipientPurged === true) continue;

    const contentKey = parsed.contentKey;
    const isDuplicate =
      typeof contentKey === 'string' &&
      contentKey.length > 0 &&
      seenContentKeys.has(contentKey) &&
      !prior;
    if (typeof contentKey === 'string') seenContentKeys.add(contentKey);

    const issues = isDuplicate
      ? [
          ...parsed.issues,
          {
            field: 'document' as const,
            code: 'duplicateOrder' as const,
            severity: 'block' as const,
            messageHe:
              'ההזמנה הזאת זהה לגמרי להזמנה אחרת שכבר קיבלת, עד הפרט האחרון. לא הצגתי ממנה כתובת — ייתכן שאותה הודעה נשלחה פעמיים, וכדאי לוודא לפני שאורזים חבילה נוספת',
          },
        ]
      : parsed.issues;

    const needsHumanReview = parsed.needsHumanReview || isDuplicate;
    if (needsHumanReview) summary.needsAttention++;

    await ordersRef.doc(id).set(
      {
        userId: uid,
        kind: 'order',
        id,
        sourceMessageId: msg.messageId,
        threadId: msg.threadId,
        fromDomain: domainOf(msg.fromAddress),
        receivedAt: msg.receivedAt,
        recipient: parsed.recipient,
        items: parsed.items,
        paidTotal: parsed.paidTotal,
        currency: parsed.currency,
        installments: parsed.installments,
        status,
        shippedAt,
        recipientPurged: false,
        needsHumanReview,
        issues,
        contentKey: contentKey ?? contentFingerprint(msg.messageId),
        purgeAfter: purgeDateFor({ status, shippedAt, receivedAt: msg.receivedAt }, {}),
        createdAt: prior ? (prior.data() as { createdAt?: string }).createdAt ?? ts : ts,
        updatedAt: ts,
      },
      { merge: true },
    );
    summary.written++;
  }

  await deps.db.doc(userDocPath(uid)).set(
    {
      googleConnection: 'connected',
      lastSyncAt: ts,
      // ★ M18 — המונה שמוצג במסך. **נגזר ממה שנקרא בפועל.**
      lastReadCount: summary.messagesRead,
      lastReadSources: summary.readSources,
    },
    { merge: true },
  );

  await writeRun(deps.db, uid, summary, at);
  return summary;
}

/**
 * ★ סיכום הריצה — **ספירות וקודים בלבד.**
 *
 * אין כאן `subject`, אין `fromAddress` ואין שום שדה מהודעה. זה האוסף שרונן
 * יסתכל בו כדי לדבג, ולכן הוא בדיוק המקום שבו "רק נוסיף את הנושא כדי להבין
 * מה קרה" הופך לכותרות מיילים שנשמרות לנצח. הן לא, והן לא יהיו.
 */
async function writeRun(
  db: Firestore,
  uid: string,
  summary: SyncSummary,
  at: Date,
): Promise<void> {
  const ts = at.toISOString();
  await db.collection(collectionPath(uid, COLLECTIONS.syncRuns)).add({
    userId: uid,
    kind: 'sync',
    at: ts,
    scanned: summary.scanned,
    written: summary.written,
    messagesRead: summary.messagesRead,
    readSources: summary.readSources,
    readParts: summary.readParts,
    unsignedTail: summary.unsignedTail,
    needsAttention: summary.needsAttention,
    contractRefusals: summary.contractRefusals,
    errorHe: summary.errorHe,
    purgeAfter: new Date(
      at.getTime() + SYNC_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** נתיב מסמך ההזמנה. מיוצא כדי שאף קורא לא יבנה מחרוזת נתיב משלו. */
export const orderDocPath = (uid: string, orderId: string): string =>
  docPath(uid, COLLECTIONS.orders, orderId);
