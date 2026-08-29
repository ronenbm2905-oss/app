// ============================================================================
// oauthFlow.ts — ★★ זרימת ה**הרשאה**. נפרדת מזרימת ה**זהות**, בכוונה.
//
// ---------------------------------------------------------------------------
// שתי זרימות, ולמה לא אחת
// ---------------------------------------------------------------------------
// היה אפשר לבקש את `gmail.readonly` ישירות ב-`signInWithPopup` של Firebase
// Auth ולקבל הכול בלחיצה אחת. זה עובד, וזה מקצר את הקוד בערך בחצי. **ולא
// עשינו את זה**, משלוש סיבות שכל אחת מהן לבדה מספיקה:
//
//  1. **`signInWithPopup` לא מחזיר refresh token.** הוא מחזיר access token
//     שפג בשעה. משיכה מתוזמנת ב-03:00 מחייבת גישה כשאף אחד לא מחובר, וזה
//     בדיוק מה ש-Authorization Code flow בצד שרת נותן ו-implicit לא.
//
//  2. ★★ **הפרדת המסך.** *"להיכנס לכלי"* ו*"לתת לכלי לקרוא את התיבה"* הן
//     שתי החלטות שונות לגמרי, ובמסך אחד הן נראות כמו אחת. הראשונה תמימה,
//     השנייה היא ההרשאה ה-restricted שכל מסך ההסבר של עדי נכתב עליה. מיזוגן
//     היה גורם לדורית לאשר את השנייה בזמן שהיא חושבת על הראשונה — וזו בדיוק
//     צורת ההסכמה שהסקירה קוראת לה "הסבר שתיעד הסכמה ולא השיג אותה".
//
//  3. **הטוקן לא נוגע בדפדפן.** ה-`code` נפדה בצד שרת, מול client secret
//     שיושב ב-Secret Manager, וה-refresh token נכתב מוצפן ישירות
//     ל-Firestore. אין רגע שבו המפתח לתיבה עובר במכשיר שלה.
//
// ---------------------------------------------------------------------------
// ★ ה-`state` — למה חד-פעמי ולמה TTL קצר
// ---------------------------------------------------------------------------
// `state` הוא ההגנה היחידה מפני CSRF בזרימה הזאת. בלעדיו, תוקף יכול לגרום
// לדפדפן של דורית לסיים זרימת הרשאה **שהוא** התחיל — כלומר לקשור את חשבון
// Google שלו לחיבור שלה, ואז לראות במסך שלה הזמנות שהוא שולט בהן.
//
// שלושה תנאים, וכולם נאכפים בצד שרת:
//  · **נוצר בשרת** (`randomBytes(32)`), לא בקליינט.
//  · **חד-פעמי** — נמחק בטרנזקציה בקריאה. שימוש שני נכשל.
//  · **TTL 10 דקות** — חלון שמספיק למסך ההסכמה, וקצר מכדי להיות שימושי
//    למי שהעתיק אותו מלוג.
// ============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import { OAUTH_STATES, userDocPath } from '../shared/lib/firestorePaths';
import { newOAuthState } from '../shared/lib/tokenCrypto';
import { SCOPE_PARAM } from '../shared/lib/googleScopes';
import type { TokenStore } from './tokenStore';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** ★ עשר דקות. ראה ההערה בראש הקובץ. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export class OAuthFlowError extends Error {
  readonly code:
    | 'stateMissing'
    | 'stateExpired'
    | 'stateReused'
    | 'codeExchangeFailed'
    | 'noRefreshToken'
    | 'scopeMismatch';
  constructor(code: OAuthFlowError['code']) {
    super(code);
    this.name = 'OAuthFlowError';
    this.code = code;
  }
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  /** ה-URI הרשום בקונסולה של Google. חייב להיות זהה עד התו. */
  redirectUri: string;
}

export interface OAuthDeps {
  db: Firestore;
  config: OAuthConfig;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

/**
 * ★ שלב 1 — יצירת ה-`state` ובניית ה-URL.
 *
 * `access_type=offline` + `prompt=consent`: בלי `offline` אין refresh token
 * בכלל, ובלי `prompt=consent` גוגל **לא** מחזירה refresh token חדש למשתמש
 * שכבר אישר פעם. השילוב הזה הוא מה שהופך "התחברי מחדש" אחרי `invalid_grant`
 * לפעולה שבאמת מתקנת — בלעדיו היא הייתה מסתיימת בהצלחה ומשאירה את המערכת
 * בלי טוקן.
 *
 * `include_granted_scopes` **לא** נשלח, בכוונה: הוא מבקש מגוגל לצרף לאסימון
 * את כל ההרשאות שניתנו אי-פעם לאותו client. זו בדיוק ההרחבה השקטה שהסקיל
 * הזה קיים כדי למנוע.
 */
export async function startAuthorization(uid: string, deps: OAuthDeps): Promise<string> {
  const state = newOAuthState();
  const at = (deps.now ?? (() => new Date()))();

  await deps.db.doc(`${OAUTH_STATES}/${state}`).set({
    userId: uid,
    createdAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + STATE_TTL_MS).toISOString(),
  });

  const params = new URLSearchParams({
    client_id: deps.config.clientId,
    redirect_uri: deps.config.redirectUri,
    response_type: 'code',
    // ★★ **ה-scope היחיד.** מיובא, לא מוקלד. ראה `shared/lib/googleScopes.ts`.
    scope: SCOPE_PARAM,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

/**
 * ★★ שלב 2 — הקולבק.
 *
 * הסדר קריטי: **קודם ה-`state`, אחר כך ה-`code`.** פדיית `code` לפני אימות
 * ה-`state` פירושה שתוקף יכול לגרום לשרת שלנו לפדות קוד שהוא שלט בו — כלומר
 * לקשור טוקן זר למשתמשת. הבדיקה הראשונה היא זו שאסור לדחות.
 */
export async function completeAuthorization(
  state: string,
  code: string,
  deps: OAuthDeps,
): Promise<string> {
  const now = (deps.now ?? (() => new Date()))();
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  // --- ★ 1. ה-state: קיים · לא פג · חד-פעמי. ------------------------------
  //
  // ★★ **ה-uid נקרא מהמסמך שאנחנו כתבנו, ולא מהבקשה.** זו כל ההגנה כאן:
  // גוגל מחזירה `state` ו-`code` בלבד, ואילו היינו מקבלים גם `uid` בשאילתת
  // ה-URL, כל אחד היה יכול לקרוא לקולבק עם ה-uid של דורית ולקשור אליה טוקן
  // שהוא שלט בו. ה-`state` הוא nonce שרק אנחנו הנפקנו, והוא זה שנושא את
  // הקישור לזהות.
  const ref = deps.db.doc(`${OAUTH_STATES}/${state}`);
  const doc = await ref.get();
  if (!doc.exists) throw new OAuthFlowError('stateMissing');

  const data = doc.data() as { userId?: string; expiresAt?: string };
  const uid = typeof data.userId === 'string' ? data.userId : '';
  if (uid.length === 0) throw new OAuthFlowError('stateMissing');

  // ★ מחיקה **לפני** הפדייה. אם משהו ייכשל בהמשך, ה-`state` כבר לא ניתן
  // לשימוש חוזר — וזה הכיוון הנכון לטעות בו: זרימה שנכשלה מתחילים מחדש.
  await ref.delete();

  if (typeof data.expiresAt !== 'string' || new Date(data.expiresAt).getTime() <= now.getTime()) {
    throw new OAuthFlowError('stateExpired');
  }

  // --- 2. פדיית ה-code. ---------------------------------------------------
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: deps.config.clientId,
      client_secret: deps.config.clientSecret,
      redirect_uri: deps.config.redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
  });
  if (!res.ok) throw new OAuthFlowError('codeExchangeFailed');

  const payload = (await res.json()) as { refresh_token?: unknown; scope?: unknown };
  if (typeof payload.refresh_token !== 'string' || payload.refresh_token.length === 0) {
    // קורה כשגוגל כבר נתנה refresh token לאותו client והבקשה לא כללה
    // `prompt=consent`. זו תקלה שדורשת תיקון בקוד, ולא הודעה לדורית.
    throw new OAuthFlowError('noRefreshToken');
  }

  // --- ★★ 3. מה שגוגל **באמת** אישרה. -------------------------------------
  //
  // הבדיקה כאן ולא ב-README: אם הוגדר בקונסולה scope נוסף, או אם דורית
  // אישרה מסך שכולל יותר ממה שביקשנו, זה הרגע היחיד שבו נראה את זה. חיבור
  // עם הרשאה רחבה מהמוצהר הוא בדיוק מצג השווא שמסך ההסבר נועד למנוע —
  // ולכן **מסרבים**, ולא "שומרים ומסמנים".
  const granted = typeof payload.scope === 'string' ? payload.scope.trim() : '';
  if (granted !== SCOPE_PARAM) {
    throw new OAuthFlowError('scopeMismatch');
  }

  // --- 4. שמירה. **דורסת טוקן בלבד.** -------------------------------------
  await deps.tokens.replaceTokens(uid, payload.refresh_token, granted);
  await deps.db.doc(userDocPath(uid)).set(
    {
      googleConnection: 'connected',
      connectedAt: now.toISOString(),
      // ★ הדגל שדורית רואה: "אישרתי", ולא "ראיתי את מסך ההסבר". שניים
      // שונים, וזה שנשמר כאן הוא הראשון.
      grantedScopeDescription: SCOPE_PARAM,
    },
    { merge: true },
  );
  return uid;
}

/** ניקוי `state` שפג ואיש לא השתמש בו. נקרא מ-`purgeOrders`. */
export async function purgeExpiredStates(db: Firestore, now: Date): Promise<number> {
  const snap = await db.collection(OAUTH_STATES).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    const expiresAt = (doc.data() as { expiresAt?: string }).expiresAt;
    if (typeof expiresAt !== 'string' || new Date(expiresAt).getTime() <= now.getTime()) {
      await doc.ref.delete();
      deleted++;
    }
  }
  return deleted;
}
