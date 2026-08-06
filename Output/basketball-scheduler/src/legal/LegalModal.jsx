import { useEffect, useRef } from "react";
import { Markdown } from "./Markdown";
import { IconX } from "../components/ui/icons";
import privacyMd from "./content/privacy-policy.md?raw";
import termsMd from "./content/terms-of-use.md?raw";
import accessibilityMd from "./content/accessibility-statement.md?raw";

export const LEGAL_DOCS = {
  privacy: { label: "מדיניות פרטיות", source: privacyMd },
  terms: { label: "תנאי שימוש", source: termsMd },
  accessibility: { label: "הצהרת נגישות", source: accessibilityMd },
};

export function LegalModal({ docId, onClose }) {
  const closeRef = useRef(null);
  const doc = LEGAL_DOCS[docId];

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4 py-6"
      dir="rtl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.label}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-stone-200 shrink-0">
          <h2 className="text-base font-bold text-stone-900">{doc.label}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="סגור"
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <Markdown source={doc.source} />
        </div>
      </div>
    </div>
  );
}
