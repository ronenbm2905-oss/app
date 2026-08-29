// ============================================================================
// accessLog.ts — ★★ B3′.2 + M15. התיעוד שדורית רואה.
//
// ---------------------------------------------------------------------------
// למה זה Firestore ולא Cloud Logging
// ---------------------------------------------------------------------------
// מהסקירה, B3′ פריט 2, והמשפט האחרון הוא הכל:
//
// > *"תיעוד גישה שהיא יכולה לראות — **לא Cloud Audit Logs בקונסולה שרק הוא
// > נכנס אליה.** רשומה ב-Firestore שהאפליקציה מציגה לה בעברית: 'ב-3.9 בשעה
// > 14:20 רונן פתח פנייה אחת כדי לבדוק תקלה'. **תיעוד שנושא המידע לא יכול
// > לקרוא אינו תיעוד עבורו.**"*
//
// Cloud Logging הוא תיעוד **מצוין** — ורונן יראה שם הכול. הוא פשוט לא עונה
// על הדרישה, כי הדרישה אינה "שיהיה תיעוד" אלא "שהיא תראה".
//
// ---------------------------------------------------------------------------
// ★★ הכתיבה קודמת לקריאה. זו ההכרעה המרכזית בקובץ.
// ---------------------------------------------------------------------------
// `logThenRead` כותב את הרשומה, ורק אם הכתיבה **הצליחה** מריץ את הפעולה.
// הסדר ההפוך — לקרוא ואז לרשום — נראה זהה ברוב הזמן, ונבדל בדיוק ברגע
// שמעניין: אם הפעולה נכשלה באמצע, או שהפונקציה נהרגה, נשארה קריאה שאיש לא
// יודע עליה. יומן שנעדר בדיוק כשמשהו השתבש הוא לא יומן.
//
// המחיר: רשומה על קריאה שבסוף נכשלה. זה הכיוון הנכון לטעות בו — "נרשם
// שנפתח ולא נפתח" מטריד את דורית ומסתדר בשאלה; ההפך לא מסתדר בכלל.
// ============================================================================

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, collectionPath, userDocPath } from '../shared/lib/firestorePaths';
import {
  enableSupportMode,
  isSupportModeActive,
  SUPPORT_MODE_OFF,
  type AccessAction,
  type AccessActor,
  type SupportModeState,
} from '../shared/lib/supportMode';

export class AccessDeniedError extends Error {
  readonly code = 'supportModeOff';
  constructor() {
    super('supportModeOff');
    this.name = 'AccessDeniedError';
  }
}

export interface AccessLogDeps {
  db: Firestore;
  now?: () => Date;
}

/** ★ 400 ימים. היומן שורד את ההזמנות שהוא מתעד — אחרת אין מה להצליב מולו. */
export const ACCESS_LOG_RETENTION_DAYS = 400;

export class AccessLog {
  private readonly db: Firestore;
  private readonly now: () => Date;

  constructor(deps: AccessLogDeps) {
    this.db = deps.db;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * ★ M15 — רשומה **מובנית**, לא מחרוזת.
   *
   * הניסוח העברי נגזר בקליינט (`describeAccessEntryHe`) מהשדות האלה. הסיבה
   * בסקירה: זה הפריט היחיד שקשה לרטרו-פיט אם ייחצה סף ה-10,000 — תיעוד
   * שנאסף כטקסט חופשי לא ניתן לייצא כטבלה בדיעבד, ותיעוד שלא נאסף בכלל
   * אי אפשר להמציא.
   *
   * ⚠️ שים לב מה **אין** בפרמטרים: אין `subject`, אין שם, ואין תוכן. מה
   * שנרשם הוא **מי · מתי · על מה מסוג · כמה**. יומן שמעתיק את מה שנצפה הוא
   * עותק שני של אותו מידע.
   */
  async record(
    uid: string,
    action: AccessAction,
    actor: AccessActor,
    target: { kind: 'order' | 'supportMode' | 'none'; count?: number; sourceMessageId?: string },
  ): Promise<void> {
    const at = this.now();
    await this.db.collection(collectionPath(uid, COLLECTIONS.accessLog)).add({
      userId: uid,
      at: at.toISOString(),
      actor,
      action,
      targetKind: target.kind,
      targetCount: target.count ?? 1,
      sourceMessageId: target.sourceMessageId ?? null,
      purgeAfter: new Date(
        at.getTime() + ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  /** מצב המתג כפי שהוא נשמר. `SUPPORT_MODE_OFF` כשמעולם לא הודלק. */
  async readSupportMode(uid: string): Promise<SupportModeState> {
    const snap = await this.db.doc(userDocPath(uid)).get();
    const data = snap.data() as { supportMode?: SupportModeState } | undefined;
    return data?.supportMode ?? SUPPORT_MODE_OFF;
  }

  /**
   * ★ הדלקה/כיבוי. **נקראת רק מה-`onCall` שדורש שהקורא הוא הבעלים.**
   *
   * הפקיעה מחושבת בשרת (`enableSupportMode`) ולא מתקבלת מהקליינט. שעון של
   * דפדפן, או ערך שהגיע בבקשה, הופכים "פג בסוף היום" לדבר שאפשר לבקש
   * שיפוג מאוחר יותר.
   */
  async setSupportMode(uid: string, enabled: boolean, actor: AccessActor): Promise<SupportModeState> {
    const at = this.now();
    const next = enabled
      ? enableSupportMode(at)
      : { ...SUPPORT_MODE_OFF, enabledAt: null, expiresAt: null };

    await this.db.doc(userDocPath(uid)).set({ supportMode: next }, { merge: true });
    await this.record(uid, enabled ? 'supportModeEnabled' : 'supportModeDisabled', actor, {
      kind: 'supportMode',
    });
    return next;
  }

  /**
   * ★★ השער לכל קריאת תוכן בידי המחזיק.
   *
   * שלושה שלבים, ובסדר הזה בדיוק:
   *   1. המתג נבדק **עכשיו** (כולל פקיעה — `isSupportModeActive` בודק זמן,
   *      ולא סומך על תהליך שיכבה את הדגל).
   *   2. אם כבוי — נרשם `accessDenied` **ואז** נזרקת שגיאה. ניסיון שנחסם
   *      הוא בדיוק מה שהיא צריכה לראות; יומן שרושם רק הצלחות מספר חצי סיפור.
   *   3. אם דלוק — נרשם `orderContentOpened`, **ורק אחר כך** רצה הפעולה.
   */
  async logThenRead<T>(
    uid: string,
    actor: AccessActor,
    target: { kind: 'order'; count?: number; sourceMessageId?: string },
    read: () => Promise<T>,
  ): Promise<T> {
    // הבעלים אינו זקוק למתג כדי לראות את המידע של עצמה. המתג הוא הגבול מול
    // **המחזיק**, ולא מנגנון נעילה עצמית.
    if (actor === 'owner') {
      await this.record(uid, 'orderContentOpened', actor, target);
      return read();
    }

    const state = await this.readSupportMode(uid);
    if (!isSupportModeActive(state, this.now())) {
      await this.record(uid, 'accessDenied', actor, { ...target, kind: 'order' });
      throw new AccessDeniedError();
    }

    await this.record(uid, 'orderContentOpened', actor, target);
    return read();
  }
}
