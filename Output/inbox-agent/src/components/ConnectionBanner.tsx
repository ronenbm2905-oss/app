// ============================================================================
// ConnectionBanner.tsx — מצב החיבור לגוגל, במשפט אחד.
//
// ---------------------------------------------------------------------------
// ★★ למה `expired` מקבל כפתור ו-`error` לא
// ---------------------------------------------------------------------------
// זו כל ההבחנה שהרכיב הזה קיים בשבילה. `invalid_grant` הוא **המצב היחיד
// שדורש פעולה ממנה**; בכל שאר המצבים אין לה מה לעשות, וכפתור שם היה שולח
// אותה ללחוץ שוב ושוב על משהו שלא עוזר.
//
// ומהכיוון השני, וזה החמור יותר: אם `expired` היה מוצג כמו כל שגיאה
// ("לא הצלחתי לקרוא הזמנות הבוקר"), היא הייתה **מחכה שזה יסתדר** — כי זה
// מה שאומרים לה. זה לא יסתדר לעולם: refresh token שנפסל לא חוזר לחיים,
// והרשימה פשוט תפסיק להתעדכן בלי שאיש ישים לב.
//
// ---------------------------------------------------------------------------
// ★★ והמשפט השלישי — *"שום דבר לא נמחק"*
// ---------------------------------------------------------------------------
// לא ריכוך. בלעדיו, ההתנהגות ההגיונית של מי שרואה "החיבור פג" היא להעתיק
// את כל ההזמנות לפנקס לפני שהיא לוחצת — כלומר לייצר עותק שלישי של אותן
// כתובות, מחוץ לכל מדיניות מחיקה. ההסבר הארוך פתוח כברירת מחדל מתחתיו.
// ============================================================================

import {
  CONNECTION_EXPIRED_DETAIL_HE,
  connectionMessageHe,
  needsUserAction,
  type GoogleConnectionState,
} from '../../shared/lib/googleConnection';
import { Banner } from './ui/Badge';

interface Props {
  state: GoogleConnectionState;
  onConnect: () => void;
  busy?: boolean;
}

export function ConnectionBanner({ state, onConnect, busy = false }: Props) {
  const message = connectionMessageHe(state);
  if (message === null) return null;

  const tone = state === 'expired' ? 'warn' : state === 'error' ? 'warn' : 'info';

  return (
    <div className="mb-4">
      <Banner tone={tone} title={message}>
        {state === 'expired' ? (
          <p className="mb-3 text-sm leading-relaxed">{CONNECTION_EXPIRED_DETAIL_HE}</p>
        ) : null}

        {needsUserAction(state) ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
          >
            {busy
              ? 'רגע…'
              : state === 'expired'
                ? 'להתחבר מחדש לגוגל'
                : 'לחבר את התיבה'}
          </button>
        ) : null}
      </Banner>
    </div>
  );
}
