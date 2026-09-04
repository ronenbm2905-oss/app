// ============================================================================
// useRefreshOrders.ts — ★★ הבדיקה היזומה: אוטומטית מיד אחרי החיבור, וידנית.
//
// ---------------------------------------------------------------------------
// ★★ הבאג שהקובץ הזה נכתב בגללו
// ---------------------------------------------------------------------------
// `refreshNow` היה **מוגדר ומיוצא מ-`useCloudOrders` — ולא נקרא מאף רכיב.**
// `grep -rn "refreshNow" src/` החזיר את ההגדרה, את הטיפוס ואת ה-`useMemo`,
// ותו לא. TypeScript לא תופס את זה, כי ה-`useMemo` **כן** משתמש בערך.
//
// **התוצאה בפועל, וזה החלק החשוב:** דורית מחברת את התיבה — ואז לא קורה
// כלום עד 06:30 למחרת (`syncOrders`, `onSchedule`). המסך הראשון שהיא רואה
// אחרי שנתנה גישה לתיבת הדואר שלה הוא מסך ריק. זה הרגע שבו כלי זוכה לאמון
// או מאבד אותו, והוא היה ריק.
//
// זו אותה משפחת כשלים שנתפסה כאן כבר שלוש פעמים — **הקוד קיים, נראה תקין,
// ופשוט לא רץ**: כלל הארכוב, מסלול ההזמנות, ו-`purgeAfter` שנכתב ואיש לא
// קרא אותו. ולכן, כמו שם, יש עליה בדיקה שמפילה build
// (`scripts/check-hook-wiring.mjs`) ומבחן שלוחץ על הכפתור באמת
// (`tests/refreshControl.test.tsx`).
//
// ---------------------------------------------------------------------------
// ★ ההרצה האוטומטית — התנאי, ולמה דווקא הוא
// ---------------------------------------------------------------------------
// `connection === 'connected'` **וגם** `lastSyncAt === null`.
//
// זה בדיוק המצב "התיבה חוברה ומעולם לא נקראה": `completeAuthorization` כותב
// `googleConnection: 'connected'` ואינו כותב `lastSyncAt`; רק ריצת סנכרון
// שהצליחה כותבת אותו (`orderSync.ts`). כלומר התנאי מזהה את הרגע שאחרי
// החיבור, **ולא** כל פתיחה של האפליקציה.
//
// למה לא "כשהמצב עבר מ-disconnected ל-connected": כי ברינדור הראשון המצב
// ההתחלתי הוא `disconnected` ואז מגיע ה-snapshot — כלומר כל טעינת דף הייתה
// נראית כמו חיבור חדש, ומייצרת קריאה ל-Gmail. בכלי שסופר קריאות ומציג את
// המספר הזה למשתמשת (M18), קריאה מיותרת היא לא רק בזבוז.
//
// ★ `loading` נבדק לפני הכול, כדי לא להחליט על סמך מצב ההתחלה הריק.
// ★ `ranRef` — **פעם אחת לכל mount**, בלי קשר לתוצאה.
//
// ---------------------------------------------------------------------------
// ★ "כמה נמצאו" — למה זה לא `written`
// ---------------------------------------------------------------------------
// `syncOrdersNow` מחזיר `written`, וזה **לא** מספר ההזמנות החדשות: הריצה
// כותבת מחדש (merge) כל הודעה בחלון השאילתה, כך ש-`written` הוא בערך אותו
// מספר בכל ריצה. הצגתו כ"נמצאו 12 הזמנות חדשות" הייתה שקר חוזר.
//
// מה שכן נכון: להשוות את מזהי ההזמנות שברשימה לפני הריצה ואחריה. הרשימה
// מגיעה מ-`onSnapshot`, שמתעדכן **אחרי** שהקריאה חוזרת — ולכן יש כאן המתנה
// קצרה, ורק כאשר `written > 0`. כש-`written === 0` לא נכתב דבר, ואין על מה
// לחכות: התשובה היא מיד "לא הגיעו הזמנות חדשות".
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Order } from '../../shared/types';
import type { GoogleConnectionState } from '../../shared/lib/googleConnection';
import type { SyncNowSummary } from './useCloudOrders';
import { HE } from '../i18n';

export type RefreshPhase = 'idle' | 'running' | 'done' | 'failed';

export interface RefreshState {
  phase: RefreshPhase;
  /** כמה הזמנות חדשות נכנסו לרשימה בריצה האחרונה. `null` = טרם רצה/נכשלה. */
  newCount: number | null;
  /** הודעת כישלון בעברית. `null` = אין. */
  errorHe: string | null;
}

export interface UseRefreshOrders extends RefreshState {
  /** הבדיקה היזומה. בטוחה ללחיצה כפולה — ראה `busyRef`. */
  run: () => Promise<void>;
  /** ★ האם הריצה שאחרי החיבור כבר יצאה לדרך במחזור החיים הזה. */
  autoRan: boolean;
}

/**
 * ★ הקידומת של הודעת "החיבור פג" כפי שהיא מגיעה מ-`orderSync.ts`.
 *
 * הצמדה למחרוזת אינה יפה, והחלופה גרועה יותר: להציג את ההודעה הזאת בתוך
 * פאנל הבדיקה במקביל לבאנר שכבר אומר את אותו דבר עם כפתור — כלומר לתת
 * לדורית שתי הודעות שונות על אותה תקלה, שרק אחת מהן מובילה לפעולה.
 *
 * ★ **המקור הוא `functions/src/lib/orderSync.ts`.** שינוי הנוסח שם מבטל את
 * ההפניה כאן (ואז מוצגת ההודעה המקורית — לא נורא, אבל כפולה).
 */
const EXPIRED_PREFIX_HE = 'החיבור לגוגל פג';

const IDLE: RefreshState = { phase: 'idle', newCount: null, errorHe: null };

export interface RefreshDeps {
  refreshNow: () => Promise<SyncNowSummary | null>;
  /** הרשימה החיה מ-`onSnapshot`. משמשת להשוואת "מה נוסף". */
  orders: readonly Order[];
  connection: GoogleConnectionState;
  lastSyncAt: string | null;
  /** מצב הטעינה של הענן. אין החלטות לפני שהוא `false`. */
  loading: boolean;
  /** כמה לחכות ל-`onSnapshot` אחרי ריצה שכתבה. נדרך במבחנים. */
  settleMs?: number;
  /** מוזרק במבחנים כדי לא להמתין באמת. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useRefreshOrders(deps: RefreshDeps): UseRefreshOrders {
  const { refreshNow, orders, connection, lastSyncAt, loading } = deps;
  const settleMs = deps.settleMs ?? 4000;
  const sleep = deps.sleep ?? defaultSleep;

  const [state, setState] = useState<RefreshState>(IDLE);
  const [autoRan, setAutoRan] = useState(false);

  /** הרשימה העדכנית ביותר, לקריאה מתוך ה-`await`. */
  const ordersRef = useRef<readonly Order[]>(orders);
  ordersRef.current = orders;

  /** ★ מונע ריצה שנייה במקביל. `state.phase` אינו מספיק — הוא אסינכרוני. */
  const busyRef = useRef(false);
  /** ★ האם הרכיב עדיין מותקן. בלעדיו `setState` אחרי unmount. */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * ממתין ל-`onSnapshot` וסופר מה נוסף. יוצא מוקדם ברגע שנראה משהו חדש,
   * ומחזיר `0` אם לא נוסף כלום עד `settleMs`.
   */
  const countNewSince = useCallback(
    async (before: ReadonlySet<string>): Promise<number> => {
      const deadline = Date.now() + settleMs;
      for (;;) {
        const added = ordersRef.current.filter((o) => !before.has(o.id)).length;
        if (added > 0) return added;
        if (Date.now() >= deadline) return 0;
        await sleep(150);
      }
    },
    [settleMs, sleep],
  );

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ phase: 'running', newCount: null, errorHe: null });

    const before = new Set(ordersRef.current.map((o) => o.id));

    try {
      const summary = await refreshNow();

      // `null` = אין שכבת ענן זמינה. זה כישלון, ולא "בדקתי ולא מצאתי כלום":
      // ההבדל בין השניים הוא ההבדל בין "אין הזמנות" ל"לא בדקתי".
      if (!summary) {
        if (aliveRef.current) {
          setState({ phase: 'failed', newCount: null, errorHe: HE.refreshFailed });
        }
        return;
      }

      if (summary.errorHe) {
        const expired = summary.errorHe.startsWith(EXPIRED_PREFIX_HE);
        if (aliveRef.current) {
          setState({
            phase: 'failed',
            newCount: null,
            // ★ `invalid_grant` מופנה לבאנר ואינו מוצג כאן פעמיים.
            errorHe: expired ? HE.refreshExpired : summary.errorHe,
          });
        }
        return;
      }

      const written = typeof summary.written === 'number' ? summary.written : 0;
      const newCount = written > 0 ? await countNewSince(before) : 0;
      if (aliveRef.current) setState({ phase: 'done', newCount, errorHe: null });
    } catch {
      // ★ בלי קוד שגיאה ובלי `err.message`. מה שנזרק כאן הוא טקסט של SDK
      // באנגלית, והוא לא עוזר לה — הוא רק מוכיח שמשהו נשבר.
      if (aliveRef.current) {
        setState({ phase: 'failed', newCount: null, errorHe: HE.refreshFailed });
      }
    } finally {
      busyRef.current = false;
    }
  }, [refreshNow, countNewSince]);

  // --- ★★ ההרצה שאחרי החיבור. התנאי מוסבר בראש הקובץ. ---------------------
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    if (loading) return;
    if (connection !== 'connected') return;
    if (lastSyncAt !== null) return;

    ranRef.current = true;
    setAutoRan(true);
    void run();
  }, [loading, connection, lastSyncAt, run]);

  return { ...state, run, autoRan };
}
