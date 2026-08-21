import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ============================================================================
// Modal — דיאלוג עם **ניהול פוקוס אמיתי** (A3 בהכוונת הנגישות של עדי, 17.8).
//
// מה היה חסר, ולמה זה P0 ולא ליטוש:
//   • **אין פוקוס התחלתי** — הדיאלוג נפתח והפוקוס נשאר על הכפתור שמאחוריו,
//     כלומר משתמש מקלדת/קורא-מסך "עדיין נמצא במסך הקודם" בזמן שהתוכן השתנה;
//   • **אין מלכודת פוקוס** — Tab יוצא מהדיאלוג אל הדף שמאחור, שהוא inert
//     ויזואלית אבל לא טכנית. משתמש מקלדת מאבד את מקומו ולא יודע לחזור;
//   • **אין החזרת פוקוס** — בסגירה הפוקוס קופץ ל-<body>, והניווט מתחיל מחדש
//     מראש הדף;
//   • **`aria-label="close"` מחרוזת אנגלית קשיחה** (A4) — באפליקציה עברית,
//     קורא מסך הכריז "close". זה גם הבאג היחיד כאן שהיה נראה בעין.
//
// ⚠️ `aria-labelledby` ולא `aria-label`: הכותרת כבר מרונדרת כ-<h2>, וכפילות
// שלה כמחרוזת הייתה מייצרת שני מקורות שם שעלולים להיפרד.
// ============================================================================
export function Modal({ open, onClose, title, children, footer, wide }) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const returnToRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    // למי מחזירים את הפוקוס בסגירה — נלכד **לפני** שהדיאלוג לוקח אותו.
    returnToRef.current = typeof document !== "undefined" ? document.activeElement : null;

    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      // מלכודת הפוקוס: מהאחרון קדימה → לראשון, ומהראשון אחורה → לאחרון.
      if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnToRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-md bg-white shadow-xl focus:outline-none`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {/* A11 — יעד מגע 24×24 מינימום (WCAG 2.2, SC 2.5.8). */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label={t("common.close")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
