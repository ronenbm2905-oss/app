import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";

// ============================================================================
// Sheet — מגירה: bottom-sheet במובייל, פאנל צד במסך רחב.
//
// דרישה מפורשת מהאפיון: "הסינון חייב לעבוד טוב במובייל (drawer/bottom-sheet,
// לא סיידבר דחוס)". זה הרכיב שמממש אותה, וגם בורר האבנים משתמש בו.
//
// הנגישות כאן היא לא קישוט — מגירה בלי זה היא מלכודת מקלדת:
//   • role="dialog" + aria-modal + aria-labelledby
//   • Escape סוגר
//   • פוקוס נכנס פנימה בפתיחה, וחוזר למפעיל בסגירה
//   • Tab מסתובב בתוך המגירה (focus trap)
//   • גלילת הרקע ננעלת
// ============================================================================

export default function Sheet({ open, onClose, title, children, footer, side = "bottom" }) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    // מיקוד ראשוני על הפאנל עצמו — לא על הכפתור הראשון, כדי שקורא מסך
    // יקריא את כותרת המגירה ולא ישר "סגירה".
    panelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelPos =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl animate-sheetUp sm:inset-x-auto sm:bottom-0 sm:top-0 sm:end-0 sm:max-h-none sm:w-[26rem] sm:rounded-t-none sm:rounded-s-3xl"
      : "inset-y-0 end-0 w-full max-w-md rounded-s-3xl";

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className={`absolute flex flex-col bg-ivory shadow-sheet outline-none ${panelPos}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="sheet-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand"
            aria-label={t("common.close")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>

        {footer ? <div className="border-t border-line bg-white px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
