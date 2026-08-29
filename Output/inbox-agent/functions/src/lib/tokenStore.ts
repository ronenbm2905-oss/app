// ============================================================================
// tokenStore.ts — ★★ **מודול הגישה היחיד.** B3′.1, והוא החוסם.
//
// ---------------------------------------------------------------------------
// מה זה אומר בפועל
// ---------------------------------------------------------------------------
// מהסקירה, סעיף 5.1 — B3′, פריט 1:
//
// > *"מודול גישה יחיד — כל קוד Admin שקורא נתוני משתמשת או מפענח טוקן עובר
// > דרכו. **+ בדיקת CI** שקריאה ישירה ל-`oauthTokens` מחוץ למודול מפילה
// > build. **זה החוסם.** בלעדיו לכל שאר הסעיף אין משמעות."*
//
// ולכן, מכנית:
//  · המחרוזת `oauthTokens` מופיעה בקוד ה-Functions **רק כאן** (דרך
//    `COLLECTIONS.oauthTokens`), ו-`scripts/check-token-access.mjs` מפיל
//    build אם היא מופיעה בקובץ אחר.
//  · `decryptToken` מיובא **רק כאן**. אותה בדיקה אוכפת גם את זה.
//  · שום פונקציה בקובץ הזה לא מחזירה את ה-refresh token עצמו. מה שיוצא
//    החוצה הוא `access_token` קצר-מועד בלבד — ראה `getAccessToken`.
//
// ההבחנה האחרונה היא העיקר: מודול שמחזיר את הטוקן המוצפן, או אפילו את
// המפוענח, הוא "מודול גישה יחיד" בשמו בלבד. **מה שהופך אותו לשער הוא שהערך
// הרגיש לא עובר את הגבול שלו.**
//
// ---------------------------------------------------------------------------
// ★ ומה שהמודול הזה **לא** מתיימר לעשות
// ---------------------------------------------------------------------------
// הוא לא מונע מרונן לקרוא את המסמך דרך הקונסולה של Firebase. שום דבר לא
// מונע את זה, וזה כתוב לדורית במילים האלה: *"אין הגדרה שאפשר להדליק שתמנע
// ממנו את זה."* מה שהמודול כן עושה: הוא מונע שקוד **אחר במוצר** ייגע
// בטוקן, ולכן הוא הופך את "רק המקום הזה נוגע" מהצהרה לדבר שנשבר ב-build.
// ============================================================================

import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, docPath } from '../shared/lib/firestorePaths';
import { decryptToken, encryptToken, parseKey } from '../shared/lib/tokenCrypto';
import { isInvalidGrant } from '../shared/lib/googleConnection';
import { SCOPE_PARAM } from '../shared/lib/googleScopes';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * ★ הרשומה כפי שהיא נשמרת.
 *
 * ⚠️ **`refreshToken` הוא ה-envelope המוצפן, לא הטוקן.** השם קצר בכוונה —
 * `encryptedRefreshTokenEnvelope` היה נכון יותר ומסורבל, וקוד מסורבל
 * מעתיקים. הטיפוס והתיעוד כאן הם מה שמונע מלכתוב לשם ערך גולמי.
 */
interface StoredTokens {
  /** `v1.<iv>.<tag>.<ciphertext>` — ראה `tokenCrypto.ts`. */
  refreshToken: string;
  /** ה-scopes שגוגל אישרה בפועל. נשמר כדי לזהות סטייה, לא כדי לסמוך עליו. */
  grantedScopes: string;
  connectedAt: string;
  updatedAt: string;
}

export interface TokenStoreDeps {
  db?: Firestore;
  /** `TOKEN_ENC_KEY` — base64 של 32 בתים. */
  encryptionKey: string;
  clientId: string;
  clientSecret: string;
  /** מוזרק במבחנים. בפרודקשן `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class TokenStoreError extends Error {
  readonly code: 'noTokens' | 'refreshFailed' | 'invalidGrant';
  constructor(code: 'noTokens' | 'refreshFailed' | 'invalidGrant') {
    super(code);
    this.name = 'TokenStoreError';
    this.code = code;
  }
}

/**
 * ★★ השער.
 *
 * מחלקה ולא פונקציות חופשיות, כדי שהתלויות (מפתח, סודות, `fetch`) ייכנסו
 * במקום אחד ולא ייקראו מסביבת הריצה בכל פונקציה. פונקציה שקוראת בעצמה
 * `process.env.TOKEN_ENC_KEY` היא פונקציה שאפשר להעתיק לקובץ אחר והיא
 * תמשיך לעבוד — כלומר בדיוק מה שאנחנו מונעים.
 */
export class TokenStore {
  private readonly db: Firestore;
  private readonly key: Buffer;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(deps: TokenStoreDeps) {
    this.db = deps.db ?? getFirestore();
    this.key = parseKey(deps.encryptionKey);
    this.clientId = deps.clientId;
    this.clientSecret = deps.clientSecret;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch;
    this.now = deps.now ?? (() => new Date());
  }

  private ref(uid: string) {
    return this.db.doc(docPath(uid, COLLECTIONS.oauthTokens, 'google'));
  }

  /**
   * ★ כותבת/דורסת את הטוקן. **מסמך אחד, ולא נוגעת בשום אוסף אחר.**
   *
   * זה מה שהופך את המשפט בבאנר — *"שום דבר לא נמחק"* — לנכון ולא למרגיע:
   * חיבור מחדש הוא `set` על מסמך בודד. `orders` אינו נגזר ממנו.
   */
  async replaceTokens(uid: string, refreshToken: string, grantedScopes: string): Promise<void> {
    const at = this.now().toISOString();
    const existing = await this.ref(uid).get();
    const doc: StoredTokens = {
      refreshToken: encryptToken(refreshToken, this.key, uid),
      grantedScopes,
      connectedAt: (existing.data() as StoredTokens | undefined)?.connectedAt ?? at,
      updatedAt: at,
    };
    await this.ref(uid).set(doc);
  }

  async hasTokens(uid: string): Promise<boolean> {
    return (await this.ref(uid).get()).exists;
  }

  /** ניתוק. מוחקת את המסמך — ורק אותו. */
  async revoke(uid: string): Promise<void> {
    await this.ref(uid).delete();
  }

  /**
   * ★★ הפונקציה היחידה שיוצאת ממנה גישה — ו**רק כ-access token**.
   *
   * ה-refresh token מפוענח, נשלח לגוגל, ומת בתוך הפונקציה. מה שחוזר לקורא
   * הוא אסימון שפג בעוד שעה. גם אם קוד קורא ישלוף אותו ללוג בטעות —
   * וב-`syncOrders` אין `console.` בכלל, נאכף ב-CI — הנזק חסום בזמן.
   *
   * ★ `invalid_grant` נתפס **כאן** ומתורגם לקוד משלו. ראה `googleConnection.ts`:
   * הוא המצב היחיד שדורש פעולה מדורית, וכל שאר השגיאות נראות לה אחרת.
   */
  async getAccessToken(uid: string): Promise<string> {
    const snap = await this.ref(uid).get();
    if (!snap.exists) throw new TokenStoreError('noTokens');
    const stored = snap.data() as StoredTokens;

    // ★★ הפענוח היחיד בכל המוצר. ה-AAD הוא ה-uid — מסמך שהועתק בין
    // משתמשים פשוט לא ייפתח.
    const refreshToken = decryptToken(stored.refreshToken, this.key, uid);

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    let res: Response;
    try {
      res = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      // תקלת רשת. **לא** `invalid_grant` — לא מבקשים ממנה להתחבר מחדש.
      throw new TokenStoreError('refreshFailed');
    }

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (isInvalidGrant(payload)) throw new TokenStoreError('invalidGrant');
      throw new TokenStoreError('refreshFailed');
    }

    const payload = (await res.json()) as { access_token?: unknown; scope?: unknown };
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new TokenStoreError('refreshFailed');
    }

    // ★ סטייה ב-scopes אינה נבלעת. אם גוגל מחזירה יותר ממה שביקשנו — משהו
    // הוגדר אחרת בקונסולה, וזה בדיוק מה שאיש לא היה מבחין בו.
    if (typeof payload.scope === 'string' && payload.scope.trim() !== SCOPE_PARAM) {
      await this.ref(uid).set({ grantedScopes: payload.scope }, { merge: true });
    }

    return payload.access_token;
  }
}
