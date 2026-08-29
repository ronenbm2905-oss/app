// ============================================================================
// SupportModePanel.tsx — ★★ B3′. המתג, הבאנר, והיומן — במסך אחד.
//
// ---------------------------------------------------------------------------
// למה שלושת החלקים יושבים ברכיב אחד
// ---------------------------------------------------------------------------
// כי הם טענה אחת. המתג בלי היומן הוא הבטחה בלי ראיה; היומן בלי המתג הוא
// רשימה שאי אפשר לעשות איתה כלום. הסקירה מנסחת אותם כשלושה פריטים של אותו
// חוסם, וההפרדה בין מסכים הייתה מזמינה מצב שבו אחד מהם קיים והשני "עוד לא".
//
// ---------------------------------------------------------------------------
// ★★ הניסוח — מה שהיא צריכה להבין, לא מה שנכון פורמלית
// ---------------------------------------------------------------------------
// מסעיף 5.2 בסקירה:
//
// > *"הסבר שנכון משפטית ואינו מובן לה **לא השיג הסכמה מדעת — הוא רק תיעד
// > אותה**. המבחן היחיד שיש לי להציע: אחרי ההסבר, היא צריכה להיות מסוגלת
// > לומר במילים שלה מה רונן יכול לראות."*
//
// ולכן אין כאן `scope`, אין `grant`, ואין "הרשאת גישה זמנית". יש: מתג,
// "נכבה לבד בסוף היום", ורשימה של מה שקרה.
//
// ---------------------------------------------------------------------------
// ⚠️ ומה שכתוב כאן במפורש, כי אסור שיישמע כמו יותר ממה שהוא
// ---------------------------------------------------------------------------
// המתג **מתעד, לא חוסם.** רונן בנה את הכלי ומחזיק את פרויקט Firebase, ולכן
// הוא יכול להגיע למידע גם כשהמתג כבוי. זה בדיוק מה שכתוב לה במסמך ההסכמה:
// *"אין הגדרה שאפשר להדליק שתמנע ממנו את זה."* פאנל שיטען אחרת יהיה מצג
// שווא — ולכן המשפט מופיע על המסך, ולא רק בקוד.
// ============================================================================

import { useState } from 'react';
import {
  describeAccessEntryHe,
  formatAccessWhen,
  SUPPORT_MODE_BANNER_HE,
  type AccessLogEntry,
  type SupportModeState,
} from '../../shared/lib/supportMode';
import { Banner } from './ui/Badge';

interface Props {
  state: SupportModeState;
  active: boolean;
  entries: AccessLogEntry[];
  onToggle: (enabled: boolean) => Promise<void>;
  canToggle: boolean;
}

export function SupportModePanel({ state, active, entries, onToggle, canToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await onToggle(!active);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-slate-300 bg-white p-4" aria-label="מצב תמיכה">
      {/* ★★ הבאנר. גלוי כל עוד המתג דלוק, ולא ניתן לסגירה. */}
      {active ? (
        <div className="mb-4">
          <Banner tone="warn" title="מצב תמיכה דלוק">
            {SUPPORT_MODE_BANNER_HE}
            {state.expiresAt ? (
              <div className="mt-1 text-xs">נכבה ב-{formatAccessWhen(state.expiresAt)}.</div>
            ) : null}
          </Banner>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-slate-900">
            אם יש תקלה ורונן צריך להסתכל
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            כברירת מחדל הוא רואה רק מספרים — כמה הודעות נכנסו ומה נכשל.
            כדי שיוכל לפתוח הזמנה ולראות מה בה, צריך שתדליקי את המתג הזה.
            <strong> הוא נכבה לבד בסוף היום</strong>, וכל פתיחה נרשמת ברשימה שלמטה.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={busy || !canToggle}
          aria-pressed={active}
          className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 ${
            active
              ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200'
              : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {busy ? 'רגע…' : active ? 'לכבות עכשיו' : 'להדליק מצב תמיכה'}
        </button>
      </div>

      {/* ⚠️ המשפט שאסור שייעדר. ראה ההערה בראש הקובץ. */}
      <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
        חשוב שתדעי: המתג הזה <strong>מתעד, הוא לא חוסם</strong>. רונן בנה את הכלי ולכן
        הוא יכול להגיע למידע גם בלעדיו — אין הגדרה שאפשר להדליק שתמנע ממנו את זה.
        מה שהמתג עושה: הוא הופך כל פתיחה כזאת לדבר שאת רואה.
      </p>

      {/* ★ היומן. */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-[44px] text-sm font-medium text-slate-700 underline hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {open ? 'לסגור את הרשימה' : `מה קרה עד עכשיו (${entries.length})`}
        </button>

        {open ? (
          entries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              עדיין לא נרשם כלום. אף אחד לא פתח הזמנה.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
                >
                  {describeAccessEntryHe(e)}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
}
