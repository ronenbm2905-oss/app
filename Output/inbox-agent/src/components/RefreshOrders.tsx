// ============================================================================
// RefreshOrders.tsx — ★★ "לבדוק אם הגיעו הזמנות חדשות".
//
// ---------------------------------------------------------------------------
// למה הרכיב הזה קיים, ולמה הוא לא רק כפתור
// ---------------------------------------------------------------------------
// `refreshNow` היה קיים ב-`useCloudOrders` ולא נקרא מאף מסך. כלומר: מהרגע
// שדורית חיברה את התיבה ועד 06:30 למחרת — **שום דבר לא קרה, ולא הייתה שום
// דרך לגרום לו לקרות.** התיקון העיקרי הוא ההרצה האוטומטית שאחרי החיבור
// (`useRefreshOrders`); הכפתור כאן הוא הגיבוי, והוא גם מה שמאפשר לה לשאול
// את השאלה מתי שהיא רוצה.
//
// ---------------------------------------------------------------------------
// ★★ שלושת המצבים — וההסבר למה כפתור בלעדיהם גרוע מכלום
// ---------------------------------------------------------------------------
//  1. **בזמן ריצה** — `disabled` + `aria-busy` + טקסט שמשתנה. אין כאן ספינר
//     דקורטיבי: מה שצריך לקרות זה שלחיצה שנייה **לא תיהפך לקריאה שנייה**
//     ל-Gmail. בכלי שסופר את מספר ההודעות שקרא ומציג אותו למשתמשת (M18),
//     קריאה כפולה היא לא רק בזבוז — היא מספר שגוי במסך.
//  2. **הצלחה, כולל אפס** — משפט מפורש תמיד. משתמשת שלוחצת ורואה מסך שלא
//     השתנה מסיקה שהכפתור שבור; זו התגובה הנכונה למה שהיא רואה.
//  3. **כישלון** — עברית של בן אדם. `invalid_grant` **אינו** מוצג כאן:
//     הוא מפיל את `googleConnection` ל-`expired`, ו-`ConnectionBanner` כבר
//     אומר את המשפט הנכון עם הכפתור הנכון. שתי הודעות על אותה תקלה, שרק
//     אחת מהן מובילה לפעולה, גרועות מהודעה אחת.
//
// ---------------------------------------------------------------------------
// ★ "בדקתי לאחרונה ב-08:14" — הפרט שמונע חוסר אמון
// ---------------------------------------------------------------------------
// בלעדיו אי אפשר לדעת אם הרשימה שעל המסך היא המצב עכשיו או תמונה מהבוקר.
// זה נכתב **תמיד**, גם כשלא לחצה כלום, כי הוא נגזר מ-`lastSyncAt` שהשרת
// כותב אחרי כל ריצה שהצליחה — כולל הריצה המתוזמנת של 06:30.
//
// ---------------------------------------------------------------------------
// ★ הרכיב טהור — כל ה-state יושב ב-`useRefreshOrders`
// ---------------------------------------------------------------------------
// אין כאן `useState` ואין `useEffect`. זה מה שמאפשר לרנדר אותו ישירות
// במבחן, ומה שמשאיר החלטה אחת בלבד בקובץ הזה: **מה נראה על המסך בכל מצב.**
// ============================================================================

import { t } from '../i18n';
import { lastCheckedHe, refreshResultHe } from '../utils/refreshCopy';
import type { RefreshPhase } from '../hooks/useRefreshOrders';

interface Props {
  phase: RefreshPhase;
  newCount: number | null;
  errorHe: string | null;
  /** `lastSyncAt` מהענן — הריצה האחרונה שהצליחה, מתוזמנת או יזומה. */
  lastSyncAt: string | null;
  onRefresh: () => void;
  /** מוזרק במבחנים כדי ש"היום" יהיה קבוע. */
  now?: Date;
}

export function RefreshOrders({
  phase,
  newCount,
  errorHe,
  lastSyncAt,
  onRefresh,
  now,
}: Props) {
  const running = phase === 'running';

  // ★ הודעה אחת, ולפי הסדר: כישלון גובר על הצלחה, והצלחה נאמרת גם כשהיא אפס.
  const message =
    phase === 'failed'
      ? errorHe
      : phase === 'done'
        ? refreshResultHe(newCount ?? 0)
        : running
          ? t('refreshRunning')
          : null;

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={running}
          aria-busy={running}
          className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? t('refreshRunning') : t('refreshButton')}
        </button>

        {/* ★ תמיד מוצג, גם כשלא נלחץ כלום. */}
        <p className="text-xs text-slate-500">{lastCheckedHe(lastSyncAt, now ?? new Date())}</p>
      </div>

      {/* `role="status"` — הקורא-מסך מכריז על התוצאה בלי להזיז את הפוקוס
          מהכפתור, כך שאפשר ללחוץ שוב. */}
      <div role="status" aria-live="polite" className="min-h-[1.25rem]">
        {message ? (
          <p
            className={`mt-2 text-sm ${phase === 'failed' ? 'text-red-700' : 'text-slate-600'}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
