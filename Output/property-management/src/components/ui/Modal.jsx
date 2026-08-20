import { useEffect } from "react";
import { IconClose } from "./icons.jsx";

// מודאל נגיש: role=dialog, סגירה ב-Esc, לחיצה על הרקע סוגרת.
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-deep/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl bg-white shadow-brand`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="rounded-sm p-1 text-ink-muted hover:bg-surface-sunk"
          >
            <IconClose size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
