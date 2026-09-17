// ============================================================================
// App.tsx — ★ האפליקציה היא מסך אחד: ההזמנות של היום.
//
// ---------------------------------------------------------------------------
// למה אין כאן לשוניות
// ---------------------------------------------------------------------------
// היו כאן חמש: דוח בוקר, הזמנות, חשבוניות, "מה עומד לקרות", ולוח משימות.
// דורית אמרה שמה שמעניין אותה זה מודול ההזמנות. לשונית "מסך אחד שחשוב וארבעה
// שלא" היא לא פשרה — היא מסך שבו הדבר החשוב הוא אחד מחמישה דברים שווי-מראה.
//
// לכן: היא פותחת ורואה את ההזמנות. השאר עבר ל-`frozen/`, מחוץ לבנייה.
//
// ---------------------------------------------------------------------------
// ★ מה שלא נמצא כאן, ולמה זה העיקר
// ---------------------------------------------------------------------------
// אין `useTriage`, אין `useInvoices`, ואין `runPipeline`. כלומר אין בקובץ
// הזה — ובשום דבר שהוא מייבא — נתיב שמגיע למודל. זו לא הצהרה: הבדיקה
// ב-`scripts/check-no-model.mjs` הולכת על גרף הייבוא מ-`main.tsx` ומפילה את
// ה-build אם נוצרה קשת כזאת.
//
// ---------------------------------------------------------------------------
// ★ `canEdit` נשאר, גם כשהוא תמיד `true`
// ---------------------------------------------------------------------------
// ברגע שיש הרשאות אמיתיות, `OrdersView` כבר יודע להסתיר כפתורים — ואין צורך
// לעבור עליו ולזכור מה בדיוק צריך להיחסם.
// ============================================================================

// ---------------------------------------------------------------------------
// ⇄ פרוסה 1 — שני מצבים, ומצב אחד מהם לא השתנה
// ---------------------------------------------------------------------------
// `isFirebaseConfigured === false` → **בדיוק מה שהיה**: fixtures, localStorage,
// בלי גוגל ובלי ענן. ההדגמה שרונן מראה לדורית עוברת באותו מסלול קוד, ולכן
// היא לא יכולה להישבר בגלל שינוי בענן.
//
// `true` → כניסה עם Google (זהות בלבד), ואז ההזמנות מגיעות מ-Firestore
// ב-`onSnapshot`. **החיבור לתיבה הוא החלטה שלישית ונפרדת**, אחרי מסך ההסבר.
//
// ★ שלוש ההחלטות מופרדות בכוונה, ובסדר הזה:
//   1. להיכנס לכלי        — `signInWithPopup`
//   2. לקרוא את ההסבר     — `ExplainerScreen`
//   3. לתת גישה לתיבה     — `googleAuthStart` (scope אחד, בצד שרת)
// מיזוג 1 ו-3 היה חוסך לחיצה ומייצר הסכמה שתועדה ולא הושגה (סקירה, 5.2).
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { ExplainerScreen } from './components/ExplainerScreen';
import { OrdersView } from './components/OrdersView';
import { ConnectionBanner } from './components/ConnectionBanner';
import { RefreshOrders } from './components/RefreshOrders';
import { SupportModePanel } from './components/SupportModePanel';
import { Banner } from './components/ui/Badge';
import { FriendlyError } from './components/ui/FriendlyError';
import { useOrders } from './hooks/useOrders';
import { useAuth } from './hooks/useAuth';
import { useCloudOrders } from './hooks/useCloudOrders';
import { useRefreshOrders } from './hooks/useRefreshOrders';
import { cloudRunResult } from './utils/cloudView';
import { isFirebaseConfigured } from './firebase';
import { STORAGE_KEYS } from './constants';
import { t } from './i18n';

export function App() {
  const localOrders = useOrders();
  const auth = useAuth();
  const cloud = useCloudOrders(auth.user);

  /**
   * ★★ **הפקד שלא היה.**
   *
   * `cloud.refreshNow` היה מוגדר, מיוצא, ולא נקרא מאף מקום — ולכן דורית
   * חיברה את התיבה ולא ראתה כלום עד 06:30 למחרת. שתי השורות האלה הן
   * התיקון: ההרצה האוטומטית שמיד אחרי החיבור, והפקד שמאפשר לה לשאול שוב.
   *
   * ה-hook נקרא **תמיד** ולא רק במסלול הענן, כי חוקי ה-hooks. במצב המקומי
   * הוא אינרטי: `connection` הוא `disconnected` ולכן אין הרצה אוטומטית,
   * והרכיב עצמו לא מרונדר.
   */
  const refresh = useRefreshOrders({
    refreshNow: cloud.refreshNow,
    orders: cloud.orders,
    connection: cloud.connection,
    lastSyncAt: cloud.lastSyncAt,
    loading: cloud.loading,
  });

  const [connecting, setConnecting] = useState(false);

  const orders = localOrders;

  /**
   * ★ `null` = "עוד לא יודעים", ולא `false`.
   *
   * הקריאה מ-`localStorage` יושבת ב-effect, ולכן ברינדור הראשון עוד אין
   * תשובה. ברירת מחדל `false` הייתה מהבהבת את מסך ההסבר למי שכבר קראה
   * אותו, ו-`true` הייתה מדלגת עליו לרגע למי שלא — כלומר בדיוק הפוך ממה
   * שצריך. במצב `null` לא מרונדר אף אחד מהשניים.
   */
  const [seenExplainer, setSeenExplainer] = useState<boolean | null>(null);

  /** פתיחה יזומה של המסך מתוך הרשימה. */
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    try {
      setSeenExplainer(localStorage.getItem(STORAGE_KEYS.explainerSeen) === '1');
    } catch {
      // דפדפן שחוסם אחסון. מציגים את ההסבר — הכיוון הבטוח הוא להראות, לא
      // לדלג.
      setSeenExplainer(false);
    }
  }, []);

  const dismissExplainer = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.explainerSeen, '1');
    } catch {
      /* לא נשמר — המסך פשוט יופיע שוב. זה הכיוון הבטוח. */
    }
    setSeenExplainer(true);
    setReopened(false);
  };

  const showExplainer = seenExplainer === false || reopened;

  /**
   * ★ ההבחנה בין "אין מה לארוז" לבין "לא הצלחתי לטעון".
   *
   * רשימה ריקה היא מצב תקין ונפוץ — `OrdersView` אומר את זה יפה בעצמו.
   * `scanned === 0` הוא משהו אחר לגמרי: לא נסרקה אף הודעה, כלומר משהו
   * נשבר. שתי המצבים נראים על המסך אותו דבר, ולכן ההפרדה חייבת להיות כאן.
   */
  const loadFailed = !orders.loading && orders.result.stats.scanned === 0;

  // ---------------------------------------------------------------------------
  // ★ מצב ענן
  // ---------------------------------------------------------------------------
  const cloudResult = cloudRunResult(cloud.orders, {
    messagesRead: cloud.lastReadCount,
    readSources: cloud.lastReadSources,
  });

  const openConnect = async () => {
    setConnecting(true);
    try {
      const url = await cloud.connectGoogle();
      // ★ ניווט בחלון הנוכחי ולא `window.open`: חוסמי-פופאפ הורגים את
      // הזרימה בשקט, והמשתמשת רואה כפתור שלא עושה כלום.
      if (url) window.location.assign(url);
    } finally {
      setConnecting(false);
    }
  };

  if (isFirebaseConfigured) {
    // --- כניסה --------------------------------------------------------------
    if (auth.authLoading) {
      return <div className="p-8 text-center text-slate-500">רגע…</div>;
    }

    if (!auth.user) {
      return (
        <div className="mx-auto min-h-screen w-full max-w-md px-4 py-16 text-center">
          <h1 className="mb-2 text-xl font-bold text-slate-900">{t('appTitle')}</h1>
          <p className="mb-6 text-sm text-slate-600">{t('appSubtitle')}</p>
          <button
            type="button"
            onClick={auth.signIn}
            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            כניסה עם חשבון Google
          </button>
          {/* ★ המשפט שמפריד בין שתי ההחלטות. בלעדיו הכניסה נראית כמו
              נתינת ההרשאה, וזו בדיוק ההחלפה שמסך ההסבר נועד למנוע. */}
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            הכניסה הזאת היא רק כדי להיכנס לכלי. היא <strong>לא</strong> נותנת לו
            גישה לתיבת הדואר — על זה תישאלי בנפרד, אחרי הסבר.
          </p>
          {auth.authError ? (
            <p className="mt-4 text-sm text-red-700">{auth.authError}</p>
          ) : null}
        </div>
      );
    }

    // --- מסך ההסבר, לפני החיבור ---------------------------------------------
    //
    // ★★ הוא עולה **בכל פעם** שהתיבה אינה מחוברת, בלי קשר לדגל
    // `explainerSeen`. זה מה שנכתב ב-README של פרוסה 0: הדגל שומר שהיא
    // **קראה**, ואינו רישום הסכמה.
    const mustExplain = cloud.connection === 'disconnected' || showExplainer;

    return (
      <div className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('appTitle')}</h1>
            <p className="text-sm text-slate-500">{t('appSubtitle')}</p>
          </div>
          {!mustExplain ? (
            <button
              type="button"
              onClick={() => setReopened(true)}
              className="min-h-[44px] rounded-lg border border-slate-400 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {t('explainerReopen')}
            </button>
          ) : null}
        </header>

        <ConnectionBanner
          state={cloud.connection}
          onConnect={openConnect}
          busy={connecting}
        />

        {/* ★ מעל הרשימה ולא מתחתיה: זו השאלה שנשאלת **לפני** שמסתכלים על
            מה שיש, ובמובייל "מתחת לרשימה" הוא מקום שלא רואים. */}
        {!mustExplain ? (
          <RefreshOrders
            phase={refresh.phase}
            newCount={refresh.newCount}
            errorHe={refresh.errorHe}
            lastSyncAt={cloud.lastSyncAt}
            onRefresh={() => {
              void refresh.run();
            }}
          />
        ) : null}

        <main>
          {mustExplain ? (
            <ExplainerScreen onContinue={dismissExplainer} reopened={reopened} />
          ) : cloud.loading ? (
            <div className="p-8 text-center text-slate-500">רגע…</div>
          ) : cloud.errorHe ? (
            <FriendlyError whatHappened={cloud.errorHe} whatToDo={null} />
          ) : (
            <OrdersView
              result={cloudResult}
              canEdit
              onToggleShipped={() => {
                /* ★ הסימון עובר ב-onCall — הקליינט אינו כותב ל-Firestore.
                   ראה `firestore.rules`: אין `allow write` לאף אוסף.
                   מסלול הכתיבה הזה נכנס בסבב הבא — ראה README. */
              }}
              onPurgeRequest={() =>
                'המחיקה לבקשת לקוחה עוברת דרך השרת, והיא עוד לא חוברה במסך הזה. בינתיים — לבקש מרונן.'
              }
            />
          )}
        </main>

        {/* ★★ B3′ — המתג, הבאנר והיומן. */}
        {!mustExplain ? (
          <SupportModePanel
            state={cloud.supportMode}
            active={cloud.supportModeActive}
            entries={cloud.accessLog}
            onToggle={cloud.setSupportMode}
            canToggle
          />
        ) : null}

        {/* ★ "עודכן לאחרונה" ירד מכאן. אותו נתון מוצג עכשיו ליד הכפתור
            כ"בדקתי לאחרונה ב-08:14" — במקום שבו שואלים אותו, ובניסוח אחד
            במקום שניים. */}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ★ מצב מקומי — **לא נגעתי בו.** זה המסלול של ההדגמה.
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('appTitle')}</h1>
          <p className="text-sm text-slate-500">{t('appSubtitle')}</p>
        </div>

        {/* ★ ההסבר נשאר בהישג יד תמיד. מסך שנקרא פעם אחת ונעלם הוא מסך
            שאי אפשר לחזור אליו כשעולה השאלה — וזה בדיוק הרגע שבו היא
            תשאל את רונן במקום לקרוא. */}
        {!showExplainer ? (
          <button
            type="button"
            onClick={() => setReopened(true)}
            className="min-h-[44px] rounded-lg border border-slate-400 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {t('explainerReopen')}
          </button>
        ) : null}
      </header>

      {/* הבאנר קבוע ולא ניתן לסגירה. משתמשת שתשכח שאלה נתוני דוגמה עלולה
          להסיק מהמסך מסקנות על התיבה האמיתית שלה. */}
      <div className="mb-4">
        <Banner tone="info" title={t('demoBannerTitle')}>
          {t('demoBannerBody')}
        </Banner>
      </div>

      <main>
        {seenExplainer === null ? null : showExplainer ? (
          <ExplainerScreen onContinue={dismissExplainer} reopened={reopened} />
        ) : loadFailed ? (
          <FriendlyError whatHappened="לא הצלחתי לטעון את נתוני הדוגמה." whatToDo={null} />
        ) : (
          <OrdersView
            result={orders.result}
            canEdit={orders.canEdit}
            onToggleShipped={orders.toggleShipped}
            onPurgeRequest={orders.purgeForDataSubject}
          />
        )}
      </main>

      <footer className="mt-8 text-center text-xs text-slate-400">{t('footerNote')}</footer>
    </div>
  );
}
