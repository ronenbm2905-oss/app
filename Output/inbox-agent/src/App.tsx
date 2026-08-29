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

import { useEffect, useState } from 'react';
import { ExplainerScreen } from './components/ExplainerScreen';
import { OrdersView } from './components/OrdersView';
import { Banner } from './components/ui/Badge';
import { FriendlyError } from './components/ui/FriendlyError';
import { useOrders } from './hooks/useOrders';
import { STORAGE_KEYS } from './constants';
import { t } from './i18n';

export function App() {
  const orders = useOrders();

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
