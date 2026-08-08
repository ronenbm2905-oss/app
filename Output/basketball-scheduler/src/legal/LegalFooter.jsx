import { useState } from "react";
import { LegalModal, LEGAL_DOCS } from "./LegalModal";

const ORDER = ["privacy", "terms", "accessibility"];

// Self-contained footer with the three legal links + separators. Reused on the
// login screen and at the bottom of the app. Opens each document in a modal.
// Note: text is stone-600 (never stone-400) to satisfy WCAG AA contrast, and the
// "·" separators are aria-hidden so screen readers skip them.
// `data` supplies the club's legal details. It is absent on the login screen (club
// data can only be read after sign-in), where the documents fall back to the default
// operator — see the note in utils/club.js about pre-auth branding.
export function LegalFooter({ className = "", data }) {
  const [openDoc, setOpenDoc] = useState(null);

  return (
    <>
      <div className={className}>
        <nav aria-label="קישורים משפטיים" className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-xs text-stone-600">
          {ORDER.map((id, idx) => (
            <span key={id} className="flex items-center gap-x-2">
              <button
                onClick={() => setOpenDoc(id)}
                className="underline underline-offset-2 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
              >
                {LEGAL_DOCS[id].label}
              </button>
              {idx < ORDER.length - 1 && <span aria-hidden="true" className="text-stone-600">·</span>}
            </span>
          ))}
        </nav>
        <p className="text-center text-xs text-stone-500 mt-2">© כל הזכויות שמורות לרונן בן מאיר</p>
      </div>
      {openDoc && <LegalModal docId={openDoc} onClose={() => setOpenDoc(null)} data={data} />}
    </>
  );
}
