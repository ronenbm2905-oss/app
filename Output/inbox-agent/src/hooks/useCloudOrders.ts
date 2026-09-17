// ============================================================================
// useCloudOrders.ts — צד הענן: `onSnapshot` על ההזמנות, היומן, והמצב.
//
// ---------------------------------------------------------------------------
// ★★ הבאג שהסקיל `firebase-app` קיים בגללו, ומדוע הוא כתוב כאן שוב
// ---------------------------------------------------------------------------
// **התסמין:** "טעינת הנתונים נכשלה", ואחרי login הנתונים לא נטענים.
// **הסיבה:** ה-`onSnapshot` נרשם ב-mount עם deps `[]` — כלומר **לפני**
// שההתחברות הושלמה. `request.auth` הוא `null`, הכללים חוסמים, ואין
// re-subscribe אחרי ה-login.
//
// **התיקון, והוא בשורה אחת:** ה-effect תלוי ב-`[user?.uid]`, ויוצא מוקדם
// כשאין משתמש. כך הוא ממתין ל-login ונרשם מחדש אחריו.
//
// זה כתוב כאן ולא רק בסקיל כי זה בדיוק סוג הבאג שנראה כמו בעיית הרשאות
// ושולח מתקנים לערוך את `firestore.rules` — כלומר לפתוח את מה שעובד.
//
// ---------------------------------------------------------------------------
// ★ מה **לא** נשמר כאן
// ---------------------------------------------------------------------------
// אין `localStorage` של הזמנות, בדיוק כמו במצב המקומי: מה שמגיע מהענן חי
// בזיכרון ומת עם הרענון. עותק בדפדפן היה עותק שני של אותן כתובות, שלא עובר
// את `purgeOrders`, ושאיש לא יזכור למחוק.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured } from '../firebase';
import { COLLECTIONS, collectionPath, userDocPath } from '../../shared/lib/firestorePaths';
import type { GoogleConnectionState } from '../../shared/lib/googleConnection';
import { isSupportModeActive, SUPPORT_MODE_OFF, type AccessLogEntry, type SupportModeState } from '../../shared/lib/supportMode';
import { markShipped, unmarkShipped } from '../../shared/lib/orderRetention';
import type { ReadDiagnostics } from '../../shared/lib/readDiagnostics';
import type { Order } from '../../shared/types';
import { t } from '../i18n';
import type { AppUser } from './useAuth';

/**
 * ★ מה ש-`syncOrdersNow` מחזיר. **אותם שדות בדיוק** כמו ב-
 * `functions/src/index.ts`, וזו כל הסיבה שהטיפוס יושב כאן ולא בשלד: הוא
 * החוזה של הקריאה, והקריאה היא של ה-hook הזה.
 *
 * ★★ עד עכשיו התשובה נזרקה לפח (`await call('syncOrdersNow')`), ולכן המסך
 * לא יכול היה לומר לא כמה נמצא ולא מה נכשל — גם כשהשרת אמר את שניהם.
 */
export interface SyncNowSummary {
  messagesRead: number;
  readSources: string[];
  /** ★★ המונים מהריצה הזאת. ראה `shared/lib/readDiagnostics.ts`. */
  diagnostics?: ReadDiagnostics;
  /** כמה מסמכי הזמנה נכתבו בריצה. ★ **לא** מספר ההזמנות החדשות — ראה `useRefreshOrders`. */
  written: number;
  errorHe: string | null;
}

/**
 * ★ מה ש-`markOrderShipped` מחזיר. אותם שדות בדיוק כמו
 * `MarkShippedResult` ב-`functions/src/lib/shippedMarks.ts`.
 *
 * `skippedBlocked` הוא היחיד מהשלושה שהמסך **אומר** בקול: הזמנה שסומנה
 * "צריך שתסתכלי" לא נכנסת לסימון ההמוני, ואם לא נאמר את זה — הספירה על
 * המסך תסתור את מה שהיא רואה ברשימה.
 */
export interface BulkShippedResult {
  updated: number;
  skippedMissing: number;
  skippedBlocked: number;
}

export interface CloudState {
  loading: boolean;
  orders: Order[];
  accessLog: AccessLogEntry[];
  connection: GoogleConnectionState;
  supportMode: SupportModeState;
  supportModeActive: boolean;
  /** ★ M18 — המונה שמוצג במסך. נגזר ממה שנקרא בפועל בריצה האחרונה. */
  lastReadCount: number | null;
  lastReadSources: string[];
  /**
   * ★★ המונים מהריצה האחרונה. `null` = הריצה האחרונה קדמה למדידה, ואז
   * המסך לא מציג מספרים — ולא מציג אפסים שנראים כמו מדידה שהחזירה אפס.
   */
  lastDiagnostics: ReadDiagnostics | null;
  lastSyncAt: string | null;
  /** שגיאת טעינה, בעברית. `null` = תקין. */
  errorHe: string | null;
}

const EMPTY: CloudState = {
  loading: true,
  orders: [],
  accessLog: [],
  connection: 'disconnected',
  supportMode: SUPPORT_MODE_OFF,
  supportModeActive: false,
  lastReadCount: null,
  lastReadSources: [],
  lastDiagnostics: null,
  lastSyncAt: null,
  errorHe: null,
};

export interface UseCloudOrders extends CloudState {
  /** מתחיל את זרימת ההרשאה. מחזיר URL לפתיחה. */
  connectGoogle: () => Promise<string | null>;
  /** ★ B3′ — רק הבעלים. */
  setSupportMode: (enabled: boolean) => Promise<void>;
  /**
   * ★★ בדיקה יזומה מול Gmail. מחזירה את סיכום הריצה, כדי שהמסך יוכל לומר
   * מה קרה. **חייבת להיות מחוברת לפקד במסך** — ראה
   * `scripts/check-hook-wiring.mjs`.
   */
  refreshNow: () => Promise<SyncNowSummary | null>;
  /**
   * ★ הצ׳קבוקס. הופך את המצב של הזמנה אחת — ועובר **באותה קריאה בדיוק**
   * כמו הסימון ההמוני, עם מערך באורך 1.
   */
  toggleShipped: (messageId: string) => Promise<void>;
  /**
   * ★★ סימון רבות בבת אחת, ו**ביטולו** (`shipped=false`) — שזה אותו מסלול.
   * מחזירה את מה שהשרת ספר, כדי שהמסך יוכל לומר כמה סומנו וכמה דולגו.
   */
  markManyShipped: (messageIds: string[], shipped: boolean) => Promise<BulkShippedResult | null>;
  /** כישלון שמירה של סימון, בעברית. `null` = אין. */
  shippedErrorHe: string | null;
}

export function useCloudOrders(user: AppUser | null): UseCloudOrders {
  const [state, setState] = useState<CloudState>(EMPTY);

  /**
   * ★★ **העדכון האופטימי.** מפה של `messageId` → המצב שהמשתמשת ביקשה,
   * שמונחת מעל מה שהגיע מהמסד עד שהמסד מסכים.
   *
   * למה בכלל: הכתיבה עוברת קריאה לשרת, ומרגע הלחיצה ועד שה-`onSnapshot`
   * חוזר עוברות מאות מילישניות. בלי השכבה הזאת הצ׳קבוקס נשאר ריק אחרי
   * שלחצו עליו — ומי שאורזת שישים חבילות תלחץ עליו שוב, או תדלג עליו
   * ותחשוב שהוא לא עובד.
   *
   * ★ ומה שהיא **אינה**: אחסון. שום דבר כאן לא נשמר בדפדפן. אם הקריאה
   * נכשלה, הרשומה יורדת מהמפה והמסך חוזר בדיוק למה שהמסד אומר.
   */
  const [pendingShipped, setPendingShipped] = useState<Record<string, boolean>>({});
  const [shippedErrorHe, setShippedErrorHe] = useState<string | null>(null);

  useEffect(() => {
    // ★★ יציאה מוקדמת. **בלי זה הכול נשבר** — ראה ההערה בראש הקובץ.
    if (!isFirebaseConfigured || !db || !user || user.local) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    const uid = user.uid;
    const fail = (errorHe: string) => setState((s) => ({ ...s, loading: false, errorHe }));

    const unsubUser = onSnapshot(
      doc(db, userDocPath(uid)),
      (snap) => {
        const data = (snap.data() ?? {}) as {
          googleConnection?: GoogleConnectionState;
          supportMode?: SupportModeState;
          lastReadCount?: number;
          lastReadSources?: string[];
          lastDiagnostics?: ReadDiagnostics;
          lastSyncAt?: string;
        };
        setState((s) => ({
          ...s,
          loading: false,
          errorHe: null,
          connection: data.googleConnection ?? 'disconnected',
          supportMode: data.supportMode ?? SUPPORT_MODE_OFF,
          supportModeActive: isSupportModeActive(data.supportMode, new Date()),
          lastReadCount: typeof data.lastReadCount === 'number' ? data.lastReadCount : null,
          lastReadSources: data.lastReadSources ?? [],
          lastDiagnostics: data.lastDiagnostics ?? null,
          lastSyncAt: data.lastSyncAt ?? null,
        }));
      },
      () => fail('לא הצלחתי לטעון את המצב. אם זה נמשך — רונן צריך להסתכל.'),
    );

    const unsubOrders = onSnapshot(
      query(collection(db, collectionPath(uid, COLLECTIONS.orders)), orderBy('receivedAt', 'desc')),
      (snap) => {
        const orders = snap.docs
          .map((d) => d.data() as Order & { kind?: string })
          .filter((o) => o.kind !== 'openQuestion');
        setState((s) => ({ ...s, loading: false, orders, errorHe: null }));
      },
      () => fail('לא הצלחתי לטעון את ההזמנות. אם זה נמשך — רונן צריך להסתכל.'),
    );

    // ★ B3′.2 — היומן שדורית רואה. 100 האחרונות, החדשה למעלה.
    const unsubLog = onSnapshot(
      query(
        collection(db, collectionPath(uid, COLLECTIONS.accessLog)),
        orderBy('at', 'desc'),
        limit(100),
      ),
      (snap) => {
        const accessLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccessLogEntry);
        setState((s) => ({ ...s, accessLog }));
      },
      // ★ כשל בטעינת היומן אינו מפיל את המסך, אבל **כן** נאמר: יומן שלא
      // נטען ומוצג כריק הוא הודעה שגויה ("אף אחד לא נגע"), וזו בדיוק
      // ההודעה שאסור לתת כאן.
      () => setState((s) => ({ ...s, errorHe: 'לא הצלחתי לטעון את יומן הגישה.' })),
    );

    return () => {
      unsubUser();
      unsubOrders();
      unsubLog();
    };
    // ★★ **`[user?.uid]`, ולא `[]`.**
  }, [user?.uid, user?.local]);

  const call = useCallback(async <T,>(name: string, payload: unknown = {}): Promise<T | null> => {
    if (!functions) return null;
    const fn = httpsCallable(functions, name);
    const res = await fn(payload);
    return res.data as T;
  }, []);

  const connectGoogle = useCallback(async () => {
    const res = await call<{ url: string }>('googleAuthStart');
    return res?.url ?? null;
  }, [call]);

  const setSupportMode = useCallback(
    async (enabled: boolean) => {
      await call('setSupportMode', { enabled });
    },
    [call],
  );

  const refreshNow = useCallback(async () => {
    return await call<SyncNowSummary>('syncOrdersNow');
  }, [call]);

  // ---------------------------------------------------------------------------
  // ★ הסימון "נשלח"
  // ---------------------------------------------------------------------------

  /**
   * הרשימה שהמסך רואה: מה שבמסד, עם הסימונים שעוד בדרך מונחים מעליו.
   *
   * ★ החישוב עובר ב-`markShipped` / `unmarkShipped` — **אותן פונקציות
   * שהשרת מריץ**. כך "מה שרואים עכשיו" ו"מה שיישמר בעוד רגע" אינם שני
   * חישובים שאפשר להם להיפרד, כולל תאריך המחיקה שמוצג ליד ההזמנה.
   */
  const orders = useMemo(() => {
    const ids = Object.keys(pendingShipped);
    if (ids.length === 0) return state.orders;
    const now = new Date();
    return state.orders.map((order) => {
      const want = pendingShipped[order.sourceMessageId];
      if (want === undefined) return order;
      if (want === (order.status === 'shipped')) return order;
      // ★ הזמנה שסומנה "צריך שתסתכלי" — השרת מדלג עליה, ולכן גם המסך לא
      // מראה אותה מסומנת. מסך שמקדים את השרת בדבר שהשרת יסרב לו הוא מסך
      // שמראה משהו שלא קרה.
      if (order.needsHumanReview) return order;
      return want ? markShipped(order, { now }) : unmarkShipped(order, { now });
    });
  }, [state.orders, pendingShipped]);

  /**
   * ★ ניקוי: ברגע שהמסד מסכים, הרשומה יורדת מהמפה.
   *
   * בלי זה סימון ישן היה נשאר מונח מעל הנתונים לנצח — ואז שינוי שמגיע
   * ממקום אחר (סנכרון, מחיקה מתוזמנת) היה מוסתר על ידי לחיצה מלפני שעה.
   */
  useEffect(() => {
    setPendingShipped((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const byId = new Map(state.orders.map((o) => [o.sourceMessageId, o]));
      const next = { ...prev };
      let changed = false;
      for (const key of keys) {
        const order = byId.get(key);
        if (order && (order.status === 'shipped') === prev[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state.orders]);

  const markManyShipped = useCallback(
    async (messageIds: string[], shipped: boolean): Promise<BulkShippedResult | null> => {
      const ids = Array.from(
        new Set((messageIds ?? []).filter((id) => typeof id === 'string' && id.length > 0)),
      );
      if (ids.length === 0) return null;

      setShippedErrorHe(null);
      setPendingShipped((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = shipped;
        return next;
      });

      /** החזרת המצב הקודם. הסימון יורד, והמסך חוזר למה שהמסד אומר. */
      const rollback = () => {
        setPendingShipped((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
        setShippedErrorHe(t('ordersMarkFailed'));
      };

      try {
        const res = await call<BulkShippedResult>('markOrderShipped', {
          messageIds: ids,
          shipped,
        });
        // ★ `null` = אין שכבת ענן בכלל. שום דבר לא נשמר, ולכן זה נחשב
        // כישלון ולא כהצלחה שקטה.
        if (!res) {
          rollback();
          return null;
        }
        return res;
      } catch {
        // ★★ בלי קוד שגיאה ובלי stack: מה שנאמר הוא מה שהמשתמשת צריכה
        // לדעת — שהסימון לא נשמר, ושמה שהיא רואה עכשיו נכון.
        rollback();
        return null;
      }
    },
    [call],
  );

  /** ★ הבודדת עוברת דרך המרובה. מסלול אחד, כמו בשרת. */
  const toggleShipped = useCallback(
    async (messageId: string) => {
      const current = orders.find((o) => o.sourceMessageId === messageId);
      await markManyShipped([messageId], !(current?.status === 'shipped'));
    },
    [orders, markManyShipped],
  );

  return useMemo(
    () => ({
      ...state,
      orders,
      shippedErrorHe,
      connectGoogle,
      setSupportMode,
      refreshNow,
      toggleShipped,
      markManyShipped,
    }),
    [
      state,
      orders,
      shippedErrorHe,
      connectGoogle,
      setSupportMode,
      refreshNow,
      toggleShipped,
      markManyShipped,
    ],
  );
}
