// ============================================================================
// index.ts — נקודות הכניסה של שכבת הענן.
//
//   googleAuthStart      onCall      — מתחיל זרימת הרשאה. מחזיר URL.
//   googleAuthCallback   onRequest   — הקולבק מגוגל. פודה code, שומר טוקן.
//   checkConnection      onCall      — "האם החיבור חי?" בלי לגעת בתוכן.
//   setSupportMode       onCall      — ★ B3′. **רק הבעלים.**
//   syncOrdersNow        onCall      — "לבדוק אם הגיעו הזמנות חדשות".
//   syncOrders           onSchedule  — כל בוקר, שעון ישראל. ★ מדווח ריצה.
//   purgeOrders          onSchedule  — 03:15, שעון ישראל. ★ A7.
//
// ---------------------------------------------------------------------------
// ★ `me-west1` — תל אביב
// ---------------------------------------------------------------------------
// כתובת המגורים של הלקוחה נשארת בישראל. זה לא נדרש בחוק הישראלי (אין בו
// איסור העברה כללי), אבל הוא מייתר את כל שאלת ההעברה לחו"ל — וזו עמדה חזקה
// יותר מהצדקה מוצלחת. אותה הכרעה בדיוק כמו ב-hachzarei-mas.
//
// ---------------------------------------------------------------------------
// ⛔ שלושה סודות — ו**אין ביניהם `ANTHROPIC_API_KEY`**
// ---------------------------------------------------------------------------
// זה לא "לא הוגדר עדיין". B13 קובע: *"אין `ANTHROPIC_API_KEY` בקונפיג,
// בסודות או ב-`.env.example`"* — ואין מודל בפרויקט הזה. `scripts/check-no-model.mjs`
// מפיל build אם המחרוזת תופיע באחד מקובצי ה-env.
//
// ---------------------------------------------------------------------------
// ⚠️ ואין `console.` באף שורה
// ---------------------------------------------------------------------------
// גם לא לסיכומי ריצה. `check-order-logging.mjs` רץ עכשיו גם על גרף ה-Functions
// ומפיל build על כל `console.`. סיכום הריצה נכתב ל-`syncRuns` — ספירות
// וקודים, בלי נושא, בלי שם ובלי כתובת. זה גם מה שהופך אותו לדבר **שדורית
// רואה**, ולא רק רונן.
// ============================================================================

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS, collectionPath, userDocPath } from './shared/lib/firestorePaths';
import { runPurge, purgeSummaryHe } from './shared/lib/purgePolicy';
import { SCOPE_DESCRIPTION_HE, SCOPE_PARAM } from './shared/lib/googleScopes';
import { AccessLog } from './lib/accessLog';
import { FirestorePurgeStore } from './lib/firestorePurgeStore';
import { GmailClient } from './lib/gmailFetch';
import {
  completeAuthorization,
  OAuthFlowError,
  purgeExpiredStates,
  startAuthorization,
} from './lib/oauthFlow';
import { syncOrdersForUser, writeFailedRun } from './lib/orderSync';
import { TokenStore } from './lib/tokenStore';

setGlobalOptions({ region: 'me-west1', maxInstances: 4 });

initializeApp();
const db = getFirestore();

// --- ★ סודות ופרמטרים -------------------------------------------------------
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
/** ★★ base64 של 32 בתים. ראה README — `openssl rand -base64 32`. */
const TOKEN_ENC_KEY = defineSecret('TOKEN_ENC_KEY');

/** ה-client id אינו סוד (הוא נשלח בכל בקשת הרשאה), ולכן פרמטר ולא secret. */
const GOOGLE_OAUTH_CLIENT_ID = defineString('GOOGLE_OAUTH_CLIENT_ID');
const OAUTH_REDIRECT_URI = defineString('OAUTH_REDIRECT_URI');

const SECRETS = [GOOGLE_OAUTH_CLIENT_SECRET, TOKEN_ENC_KEY];

const makeTokenStore = (): TokenStore =>
  new TokenStore({
    db,
    encryptionKey: TOKEN_ENC_KEY.value(),
    clientId: GOOGLE_OAUTH_CLIENT_ID.value(),
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
  });

const oauthDeps = () => ({
  db,
  tokens: makeTokenStore(),
  config: {
    clientId: GOOGLE_OAUTH_CLIENT_ID.value(),
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
    redirectUri: OAUTH_REDIRECT_URI.value(),
  },
});

/** מזהה המשתמש המחובר, או שגיאה. אין מסלול אנונימי לשום פונקציה כאן. */
function requireUid(auth: { uid?: string } | undefined): string {
  const uid = auth?.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new HttpsError('unauthenticated', 'צריך להתחבר קודם');
  }
  return uid;
}

// ---------------------------------------------------------------------------
// ★ זרימת ההרשאה
// ---------------------------------------------------------------------------

/**
 * מחזיר את ה-URL של מסך ההסכמה.
 *
 * ★ הפונקציה מחזירה גם את `scopeDescriptionHe` — הטקסט שיוצג לצד הכפתור.
 * הוא נגזר מ-`googleScopes.ts` ולא נכתב במסך, כדי ששינוי בהרשאה ישנה את מה
 * שכתוב לדורית **באותו commit**. מסך שמתאר scope ישן הוא מצג שווא.
 */
export const googleAuthStart = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireUid(request.auth);
  const url = await startAuthorization(uid, oauthDeps());
  return { url, scope: SCOPE_PARAM, scopeDescriptionHe: SCOPE_DESCRIPTION_HE };
});

/**
 * הקולבק מגוגל.
 *
 * `onRequest` ולא `onCall` כי גוגל מפנה לכאן את הדפדפן — אין כאן בקשת SDK.
 * התשובה היא עמוד HTML קטן בעברית, כי זה מה שדורית תראה על המסך.
 */
export const googleAuthCallback = onRequest({ secrets: SECRETS }, async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';

  if (error.length > 0 || state.length === 0 || code.length === 0) {
    res.status(400).send(page('החיבור לא הושלם', 'לא אושרה הרשאה. אפשר לנסות שוב מהמסך.'));
    return;
  }

  try {
    await completeAuthorization(state, code, oauthDeps());
    res.status(200).send(page('התיבה מחוברת', 'אפשר לסגור את החלון הזה ולחזור לרשימת ההזמנות.'));
  } catch (err) {
    // ★ הודעה לפי סיבה, בלי פרטים טכניים. `scopeMismatch` מקבל ניסוח משלו
    // כי הוא היחיד שבו הבעיה אינה אצלה — ואסור שהיא תנסה שוב ותקבל אותו שוב.
    const code2 = err instanceof OAuthFlowError ? err.code : 'codeExchangeFailed';
    const body =
      code2 === 'scopeMismatch'
        ? 'ההרשאה שהתקבלה שונה ממה שהכלי מבקש, ולכן לא שמרתי אותה. רונן צריך להסתכל על זה.'
        : code2 === 'stateExpired' || code2 === 'stateMissing'
          ? 'הקישור פג. אפשר להתחיל שוב מהמסך.'
          : 'משהו השתבש בחיבור. אפשר לנסות שוב, ואם זה חוזר — רונן צריך להסתכל.';
    res.status(400).send(page('החיבור לא הושלם', body));
  }
});

/**
 * ★ "האם החיבור חי?" — **בלי לקרוא אף הודעה.**
 *
 * זו הדרך שבה המסך יודע להציג את הבאנר לפני שהסנכרון של הבוקר רץ. היא
 * מחדשת טוקן ותו לא: אין `messages.list`, אין גישה לתיבה, ואין שום דבר
 * שנכתב חוץ מ-`googleConnection`.
 */
export const checkConnection = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireUid(request.auth);
  const tokens = makeTokenStore();

  if (!(await tokens.hasTokens(uid))) {
    await db.doc(userDocPath(uid)).set({ googleConnection: 'disconnected' }, { merge: true });
    return { state: 'disconnected' as const };
  }

  try {
    await tokens.getAccessToken(uid);
    await db.doc(userDocPath(uid)).set({ googleConnection: 'connected' }, { merge: true });
    return { state: 'connected' as const };
  } catch (err) {
    // ★★ **רק** `invalid_grant` הופך ל-`expired`. ראה `googleConnection.ts`:
    // כל שאר השגיאות הן "אנסה שוב", ואין מה שדורית צריכה לעשות בהן.
    const state =
      err && typeof err === 'object' && (err as { code?: string }).code === 'invalidGrant'
        ? ('expired' as const)
        : ('error' as const);
    await db.doc(userDocPath(uid)).set({ googleConnection: state }, { merge: true });
    return { state };
  }
});

/** ניתוק יזום. מוחק את הטוקן — **ולא נוגע בהזמנות.** */
export const disconnectGoogle = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireUid(request.auth);
  await makeTokenStore().revoke(uid);
  await db.doc(userDocPath(uid)).set({ googleConnection: 'disconnected' }, { merge: true });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// ★★ B3′ — מצב תמיכה
// ---------------------------------------------------------------------------

/**
 * ★★ **רק הבעלים מדליק.**
 *
 * `request.auth.uid === uid` הוא כל הסעיף: אם המחזיק יכול להדליק לעצמו את
 * ההיתר, ההיתר אינו הסכמה אלא טופס. אין כאן פרמטר `uid` שאפשר לשלוח — ה-uid
 * נלקח מהאסימון, נקודה.
 *
 * ⚠️ ומה שזה לא עושה, וכתוב לדורית במפורש: רונן מחזיק את פרויקט Firebase
 * ולכן יכול לכתוב לשדה דרך הקונסולה. המתג **מתעד**, הוא לא חוסם אותו.
 */
export const setSupportMode = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const enabled = request.data?.enabled === true;
  const log = new AccessLog({ db });
  const state = await log.setSupportMode(uid, enabled, 'owner');
  return { supportMode: state };
});

// ---------------------------------------------------------------------------
// ★ הסנכרון
// ---------------------------------------------------------------------------

/**
 * ★ כל בוקר ב-06:30, שעון ישראל.
 *
 * `Asia/Jerusalem` ולא UTC: הרשימה נועדה להיות מוכנה כשהיא מגיעה לשולחן
 * האריזה, ו-UTC היה מזיז אותה בשעה פעמיים בשנה.
 */
export const syncOrders = onSchedule(
  { schedule: 'every day 06:30', timeZone: 'Asia/Jerusalem', secrets: SECRETS },
  async () => {
    const tokens = makeTokenStore();
    const users = await db.collection('users').get();

    for (const user of users.docs) {
      try {
        await syncOrdersForUser(user.id, {
          db,
          tokens,
          makeClient: (accessToken) => new GmailClient({ accessToken }),
          // ★★ **מי הריץ.** בלי זה `syncRuns` לא יכול לענות על "האם הריצה
          //    של הבוקר קרתה" — רשומה מלחיצה של דורית נראתה זהה לרשומה
          //    מהמתזמן.
          trigger: 'schedule',
        });
      } catch {
        // ★★ שתי הבטחות בבלוק הזה, ושתיהן נלמדו מ-`purgeOrders`:
        //
        //  1. **הריצה מדווחת גם כשהיא נפלה.** `syncOrdersForUser` מחזירה
        //     סיכום בכל מסלול חזרה — אבל זריקה (כשל Firestore, באג עתידי)
        //     עוקפת אותה לגמרי, ואז הבוקר הזה נראה בדיוק כמו בוקר שבו
        //     המתזמן לא רץ. **ריצה שלא מדווחת נראית כמו ריצה שלא קרתה.**
        //
        //  2. **משתמשת אחת שנפלה אינה מפילה את השאר.** בלי ה-`catch`,
        //     הלולאה מתה על הראשונה ואף אחת מהבאות לא נבדקת — בשקט.
        //
        // ⚠️ אין כאן `console.error`, ולא במקרה: `check-order-logging.mjs`
        // מפיל build על כל `console.` בגרף ה-Functions, כי Cloud Logging
        // הוא דרך הדליפה היחידה שנשארה. מה שצריך להישמר נכתב ל-`syncRuns`
        // כספירות וקוד — וזה גם מה שהופך אותו לדבר **שדורית רואה**.
        await writeFailedRun(db, user.id, 'schedule');
      }
    }
  },
);

/** הרצה ידנית של הסנכרון — "רענני עכשיו" במסך. אותה לוגיקה בדיוק. */
export const syncOrdersNow = onCall({ secrets: SECRETS }, async (request) => {
  const uid = requireUid(request.auth);
  const summary = await syncOrdersForUser(uid, {
    db,
    tokens: makeTokenStore(),
    makeClient: (accessToken) => new GmailClient({ accessToken }),
    trigger: 'manual',
  });
  return {
    messagesRead: summary.messagesRead,
    readSources: summary.readSources,
    written: summary.written,
    errorHe: summary.errorHe,
  };
});

// ---------------------------------------------------------------------------
// ★★ A7 / B9 — המחיקה
// ---------------------------------------------------------------------------

/**
 * ★★ **הפונקציה שהופכת את מדיניות המחיקה לנכונה.**
 *
 * ההערה ב-`Output/hachzarei-mas/functions/src/index.ts:302-317` מתעדת בדיוק
 * את הכשל ההפוך: `purgeAfter` נכתב ואיש לא קרא אותו, כלומר המדיניות הצהירה
 * על מחיקה שלא קרתה. זה נתפס בשער המשפטי ולא בקוד — ולכן שלוש הבטחות כאן:
 *
 *  1. **ההיגיון מיוצא ונבדק** — `runPurge` ב-`shared/lib/purgePolicy.ts`,
 *     עם מבחן מקצה-לקצה ב-`tests/purgeOrders.test.ts`. פונקציה מתוזמנת אי
 *     אפשר לקרוא ישירות, ולכן היגיון שיושב בתוכה הוא היגיון לא-נבדק.
 *  2. **הריצה נרשמת ל-Firestore**, גם כשלא נמחק דבר. ריצה שלא מדווחת נראית
 *     כמו ריצה שלא קרתה.
 *  3. ★★ **מסמך "ההזמנות של היום" בסכימה** — `PURGE_SCOPE`, פלוס סריקה
 *     עיוורת של שמות שדות. ראה 8א.2(ב).
 */
export const purgeOrders = onSchedule(
  { schedule: 'every day 03:15', timeZone: 'Asia/Jerusalem' },
  async () => {
    const now = new Date();
    const summary = await runPurge(new FirestorePurgeStore(db), now);
    await purgeExpiredStates(db, now);

    // הסיכום נכתב לכל משתמשת — היא זו שצריכה לראות שהמחיקה רצה.
    const users = await db.collection('users').get();
    for (const user of users.docs) {
      await db.collection(collectionPath(user.id, COLLECTIONS.syncRuns)).add({
        userId: user.id,
        kind: 'purge',
        at: summary.ranAt,
        ordersPurged: summary.ordersPurged,
        dailyListsDeleted: summary.dailyListsDeleted,
        residueCount: summary.residue.length,
        missed: summary.missed,
        summaryHe: purgeSummaryHe(summary),
        purgeAfter: new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  },
);

/** עמוד HTML מינימלי לקולבק. RTL, בלי CSS חיצוני ובלי שום קריאת רשת. */
function page(title: string, body: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:34rem;margin:auto;line-height:1.7">
<h1 style="font-size:1.25rem">${esc(title)}</h1><p>${esc(body)}</p></body></html>`;
}
