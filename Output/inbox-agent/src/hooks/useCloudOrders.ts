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
import type { Order } from '../../shared/types';
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
  /** כמה מסמכי הזמנה נכתבו בריצה. ★ **לא** מספר ההזמנות החדשות — ראה `useRefreshOrders`. */
  written: number;
  errorHe: string | null;
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
}

export function useCloudOrders(user: AppUser | null): UseCloudOrders {
  const [state, setState] = useState<CloudState>(EMPTY);

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

  return useMemo(
    () => ({ ...state, connectGoogle, setSupportMode, refreshNow }),
    [state, connectGoogle, setSupportMode, refreshNow],
  );
}
